package hot_folder

import (
	"os"
	"path/filepath"
	"reflect"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/radovskyb/watcher"

	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/core/job_manager"
	"github.com/awslabs/filemoverexpress/core/upload"
	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/types/transfertypes"
)

var (
	fileWatcher *watcher.Watcher
	// lastUpdated tracks the most recent filesystem activity per hot folder source folder,
	// so debouncing can be evaluated independently for each hot folder.
	lastUpdated        map[string]time.Time
	pendingUploads     []string
	mtx                *sync.Mutex
	fileUpdateWaitTime = 10 * time.Second
	hotFolders         map[string]*HotFolder
	// deps is the injectable seam for StartHotFolderUpload's collaborators. Production uses
	// realUploadDeps; tests swap in a testify/mock fake and restore this via t.Cleanup.
	deps uploadDeps = realUploadDeps{}

	// watchedJobs holds the hot folder upload jobs that have been started and not
	// yet resolved, keyed by jobId. Each cycle they are checked for a terminal
	// outcome so a file that failed transiently (a brief credential or network
	// outage) can be re-queued without a daemon restart. The watch carries the
	// context needed to re-key and restart a per-profile retry. Guarded by mtx.
	watchedJobs = map[string]*jobWatch{}
	// fileRetries tracks files awaiting a backoff before their next hot folder
	// upload attempt after a transient failure, keyed by (path, hot folder,
	// profile) so a failure on one transfer profile never clobbers or re-uploads a
	// success on another. Guarded by mtx. An entry with a zero readyAt is
	// queued/in-flight (not waiting); the attempts count persists across re-queues
	// so the backoff and the attempt cap are honored. Cleared when the file finally
	// succeeds, is given up on, a Resubmit supersedes it, or a fresh filesystem
	// event replaces the file.
	fileRetries = map[retryKey]*fileRetry{}

	// Retry tuning. Vars (not consts) so tests can shorten them. maxRetryAttempts
	// bounds how many times a transiently-failed file is re-queued before the
	// daemon gives up and leaves the job in its terminal error state (visible to
	// monitoring, and recoverable by the operator via Resubmit). The backoff is
	// exponential from retryBaseDelay, capped at retryMaxDelay:
	// 30s, 1m, 2m, 4m, 5m(cap) across the default 5 attempts (~12 minute window).
	// retryInFlightTTL drops a promoted (in-flight) entry no job ever reports an
	// outcome for - e.g. the hot folder was removed after the retry was scheduled -
	// so the bookkeeping cannot leak.
	maxRetryAttempts = 5
	retryBaseDelay   = 30 * time.Second
	retryMaxDelay    = 5 * time.Minute
	retryInFlightTTL = time.Hour
)

type (
	HotFolder struct {
		Name         string
		Enabled      bool
		SourceFolder string
		// ForceInitialUpload re-uploads the whole source folder with Force on daemon start / reconfigure.
		ForceInitialUpload bool
		// key: transfer profile name, value: destination folder
		TransferProfilesAndDestinationFolders map[string]string
	}

	// uploadDeps abstracts the package-level collaborators that StartHotFolderUpload calls out to,
	// so tests can inject a fake (see hot_folder_test.go) without patching the Go runtime. The
	// production seam is the deps package var above, which is restored by callers via t.Cleanup.
	uploadDeps interface {
		// GetTransferProfile resolves a transfer profile by name from the current configuration.
		GetTransferProfile(profileName string) (configtypes.TransferProfile, error)
		// NewJob builds an upload job from the given config.
		NewJob(cfg jobmanagertypes.JobConfig) (*jobmanagertypes.Job, error)
		// Uploader enqueues the job for transfer.
		Uploader(job *jobmanagertypes.Job)
		// JobState returns a launched job's current status and whether the job is
		// still known to the job manager (false once it has been cleared). Used to
		// detect that a watched hot folder upload has reached a terminal state.
		JobState(jobId string) (status jobmanagertypes.JobStatus, known bool)
		// UploadTaskOutcomes returns the per-file outcome of a job's upload tasks:
		// the absolute local path, the task's terminal status, and the error (for
		// transient-vs-permanent retry classification).
		UploadTaskOutcomes(jobId string) []TaskOutcome
	}

	// TaskOutcome is the resolved outcome of a single upload task, used to decide
	// whether its file should be re-queued for a transient-failure retry. Status
	// is the raw task status so a task left non-terminal because its job errored
	// before it ran (e.g. a credential failure) can be told apart from a success.
	TaskOutcome struct {
		Path   string
		Status jobmanagertypes.TaskStatus
		Err    error
	}

	// jobWatch is the context recorded for a launched hot folder upload job so a
	// transient failure can be re-keyed and retried against the same profile.
	jobWatch struct {
		hotFolderName string
		sourceFolder  string
		profileName   string
		destination   string
		// keys are the S3-relative sources launched in this job, used to retry
		// files when the job ended in error but produced no per-file task (its
		// tasks were never created, e.g. session setup failed). The whole-folder
		// sweep key "." is skipped since it names no single file.
		keys []string
		// everKnown records whether the job manager knew this job. It is set at
		// launch (right after Uploader returns, see startProfileUpload) and again on
		// any poll that sees the job, so an "unknown" result is read as a
		// never-registered early-return failure only when the job never registered -
		// not merely because it finished and was cleared before the first poll.
		everKnown bool
	}

	// retryKey identifies a file's retry state uniquely per hot folder and transfer
	// profile, so a failure on one profile never clobbers a success on another.
	retryKey struct {
		path          string
		hotFolderName string
		profileName   string
	}

	// jobLaunch is a started job plus the watch context the caller registers so
	// the job is tracked for transient-failure retry.
	jobLaunch struct {
		jobId string
		watch *jobWatch
	}

	// profileUpload is the request for a single-profile hot folder upload.
	profileUpload struct {
		hotFolderName     string
		sourceFolder      string
		profileName       string
		destinationFolder string
		jobName           string
		keys              []string
		force             bool
	}

	// fileRetry is the backoff bookkeeping for one file awaiting re-upload after a
	// transient failure. readyAt is the earliest time to re-queue it; a zero readyAt
	// means the file is already queued or in flight (not waiting). sourceFolder and
	// destination are the context needed to restart a single-profile upload, and
	// promotedAt stamps when the entry went in-flight so a leaked entry can be aged
	// out.
	fileRetry struct {
		attempts     int
		readyAt      time.Time
		sourceFolder string
		destination  string
		promotedAt   time.Time
	}

	// realUploadDeps is the production uploadDeps implementation, delegating to the real
	// config, jobmanagertypes, and upload package functions.
	realUploadDeps struct{}
)

func (realUploadDeps) GetTransferProfile(profileName string) (configtypes.TransferProfile, error) {
	return config.LoadConfiguration().GetTransferProfile(profileName)
}

func (realUploadDeps) NewJob(cfg jobmanagertypes.JobConfig) (*jobmanagertypes.Job, error) {
	return jobmanagertypes.NewJob(cfg)
}

func (realUploadDeps) Uploader(job *jobmanagertypes.Job) {
	upload.Uploader(job)
}

func (realUploadDeps) JobState(jobId string) (jobmanagertypes.JobStatus, bool) {
	job := job_manager.GetInstance().GetJob(jobId)
	if job == nil {
		return jobmanagertypes.JobStatusUnknown, false
	}
	return job.Status(), true
}

func (realUploadDeps) UploadTaskOutcomes(jobId string) []TaskOutcome {
	tasks := job_manager.GetInstance().GetTasks(jobId)
	outcomes := make([]TaskOutcome, 0, len(tasks))
	for _, task := range tasks {
		if task.TaskDirection() != jobmanagertypes.TaskDirectionUpload {
			continue
		}
		outcomes = append(outcomes, TaskOutcome{
			Path:   task.LocalFile().Path,
			Status: task.Status(),
			Err:    task.Err(),
		})
	}
	return outcomes
}

// Init creates a new Watcher, initializes its hotFolders map, and starts goroutines that process filesystem events
func Init() {
	hotFolders = make(map[string]*HotFolder)
	lastUpdated = make(map[string]time.Time)
	mtx = &sync.Mutex{}

	fileWatcher = watcher.New()
	fileWatcher.FilterOps(watcher.Rename, watcher.Move, watcher.Create, watcher.Write)
	configureHotFolders()

	go waitForFileSystemEvents()
	go processFileUpdates()
}

// configureHotFolders reads the hot folders from the config, and updates the local hot folder map
func configureHotFolders() {
	cfgHotFolders := config.LoadConfiguration().UploadHotFolders
	for _, cfgHotFolder := range cfgHotFolders {
		hotFolderTransferConfigs := cfgHotFolder.RemoteConfigurations
		hotFolderTxMap := make(map[string]string)
		for _, cfg := range hotFolderTransferConfigs {
			hotFolderTxMap[cfg.RemoteConfigurationName] = cfg.S3DestinationFolder
		}

		hotFolder := HotFolder{
			Name:                                  cfgHotFolder.Name,
			Enabled:                               cfgHotFolder.Enabled,
			SourceFolder:                          cfgHotFolder.LocalSourceFolder,
			ForceInitialUpload:                    cfgHotFolder.ForceInitialUpload,
			TransferProfilesAndDestinationFolders: hotFolderTxMap,
		}
		ConfigureHotFolderWatcher(hotFolder)
	}
}

// RemoveOldHotFolders gets rid of any cached hot folders that are no longer in the config
func RemoveOldHotFolders() {
	configHotFolders := config.LoadConfiguration().UploadHotFolders
	for _, cachedHotFolder := range hotFolders {
		removed := true
		for _, configHotFolder := range configHotFolders {
			if configHotFolder.Name == cachedHotFolder.Name {
				removed = false
				break
			}
		}
		if removed {
			delete(hotFolders, cachedHotFolder.Name)
		}
	}
}

// IsSourceFolderStillUsed returns true if the source folder is still being used by another hot folder
func IsSourceFolderStillUsed(sourceFolder string) bool {
	for _, hotFolder := range config.LoadConfiguration().UploadHotFolders {
		if sourceFolder == hotFolder.LocalSourceFolder {
			return true
		}
	}
	return false
}

// ConfigureHotFolderWatcher updates the hot folder cache, and adds/removes filepath watchers as needed.
// Returns true if a new watcher was added
func ConfigureHotFolderWatcher(newHotFolder HotFolder) bool {
	duplicates := removeDuplicateNamedHotFolders()
	if slices.Contains(duplicates, newHotFolder.Name) {
		return false
	}
	if !isSourceFolderValid(newHotFolder) {
		return false
	}

	if cachedHotFolder, found := hotFolders[newHotFolder.Name]; found {
		if reflect.DeepEqual(newHotFolder, *cachedHotFolder) {
			return false
		}
		if !IsSourceFolderStillUsed(cachedHotFolder.SourceFolder) {
			err := fileWatcher.RemoveRecursive(cachedHotFolder.SourceFolder)
			if err != nil {
				events.Events.Warn(strErrorRemovingHotFolder, cachedHotFolder.SourceFolder, err)
			}
		}
	}

	if err := fileWatcher.AddRecursive(newHotFolder.SourceFolder); err != nil {
		events.Events.Warn(strErrorAddingHotFolder, newHotFolder.Name, err.Error())
		return false
	}
	hotFolders[newHotFolder.Name] = &newHotFolder
	return true
}

// waitForFileSystemEvents sits and reads filesystem events that are sent by the Watcher. Upon a new event,
// it records the activity against every hot folder that contains the changed file and queues the file for
// upload. Note that one file being dragged into the hot folder may cause multiple filesystem events if it
// is large enough.
func waitForFileSystemEvents() {
	for {
		select {
		case evt := <-fileWatcher.Event:
			if evt.IsDir() {
				continue
			}
			recordFileEvent(evt.Path)
		case err := <-fileWatcher.Error:
			events.Events.Error(strErrorRunningHotFolder, err.Error())
		case <-fileWatcher.Closed:
			return
		default:
			time.Sleep(100 * time.Millisecond)
		}
	}
}

// recordFileEvent registers a filesystem event: it stamps the current time against every hot folder
// whose source folder contains the changed file (so each hot folder can be debounced on its own
// activity) and adds the file to the pending uploads if it is not already queued.
func recordFileEvent(path string) {
	now := time.Now()
	mtx.Lock()
	defer mtx.Unlock()
	for _, hotFolder := range hotFolders {
		if pathWithinFolder(path, hotFolder.SourceFolder) {
			lastUpdated[hotFolder.SourceFolder] = now
		}
	}
	if !slices.Contains(pendingUploads, path) {
		pendingUploads = append(pendingUploads, path)
	}
	// A fresh filesystem event means the file was (re)written, e.g. the operator
	// replaced a corrupt or half-copied file. Clear any pending retry backoff for
	// this path (across every hot folder and profile) so the new contents are
	// treated as a first attempt rather than waiting out a stale backoff.
	for key := range fileRetries {
		if key.path == path {
			delete(fileRetries, key)
		}
	}
}

// processFileUpdates periodically checks whether there are any pending hot folder uploads.
// Debouncing is evaluated per hot folder: a hot folder's pending files are only uploaded once
// that hot folder has had no filesystem activity for fileUpdateWaitTime. Files belonging to a
// hot folder that is still active are left queued for a later cycle, so a file is never scheduled
// while it (or any other file in the same hot folder) is still being written.
func processFileUpdates() {
	for {
		// Resolve any watched jobs and promote retries whose backoff has elapsed
		// back onto the pending queue. Manages its own locking.
		processRetries(time.Now())

		mtx.Lock()
		if len(pendingUploads) > 0 {
			processPendingUploadsLocked()
		}
		mtx.Unlock()
		time.Sleep(time.Second)
	}
}

// processPendingUploadsLocked evaluates each hot folder independently. A hot folder whose files
// changed within the debounce window is skipped entirely for this cycle; otherwise its pending
// files are uploaded as a single job and removed from the pending queue. The caller must hold mtx.
func processPendingUploadsLocked() {
	consumed := make(map[string]struct{})
	for _, hotFolder := range hotFolders {
		if !hotFolder.Enabled {
			continue
		}
		// Skip the whole hot folder if any of its files changed within the debounce window.
		if lastWrite, ok := lastUpdated[hotFolder.SourceFolder]; ok &&
			time.Since(lastWrite) <= fileUpdateWaitTime {
			continue
		}
		keys, matched := keysForHotFolder(hotFolder.SourceFolder, pendingUploads)
		if len(keys) == 0 {
			continue
		}
		// Files here were just detected by the live watcher, so always force the upload
		// regardless of the hot folder's ForceInitialUpload setting (that flag only governs
		// the startup/reload full-folder sweep, not newly-arrived files).
		launches := startHotFolderUpload(hotFolder, keys, buildJobName(keys), true)
		// Watch each launched job so a transient failure can be re-queued without a
		// daemon restart (see processRetries).
		for _, launch := range launches {
			watchedJobs[launch.jobId] = launch.watch
		}
		for _, file := range matched {
			consumed[file] = struct{}{}
		}
	}
	if len(consumed) == 0 {
		return
	}
	remaining := pendingUploads[:0]
	for _, file := range pendingUploads {
		if _, ok := consumed[file]; !ok {
			remaining = append(remaining, file)
		}
	}
	pendingUploads = remaining
}

// keysForHotFolder returns the S3-relative upload keys for the pending files that belong to the
// given source folder, along with the absolute paths that matched so they can be dequeued.
func keysForHotFolder(sourceFolder string, files []string) (keys []string, matched []string) {
	for _, file := range files {
		if !pathWithinFolder(file, sourceFolder) {
			continue
		}
		key := strings.TrimPrefix(file, sourceFolder)
		key = strings.TrimPrefix(key, string(filepath.Separator))
		key = filepath.Clean(key)
		keys = append(keys, key)
		matched = append(matched, file)
	}
	return keys, matched
}

// pathWithinFolder reports whether path is contained within folder. It guards against prefix
// collisions (e.g. source folder "/media/hotA" must not match "/media/hotAB/clip.mov") by
// requiring a path-separator boundary after folder rather than a raw string prefix.
func pathWithinFolder(path, folder string) bool {
	prefix := folder
	if !strings.HasSuffix(prefix, string(filepath.Separator)) {
		prefix += string(filepath.Separator)
	}
	return strings.HasPrefix(path, prefix)
}

// buildJobName builds the hot folder job name based on the files that will be uploaded by the hot folder
func buildJobName(filesToUpload []string) string {
	jobName := "Hot Folder - "
	if len(filesToUpload) > 0 {
		fileParts := strings.Split(filesToUpload[0], string(filepath.Separator))
		fileName := fileParts[len(fileParts)-1]
		jobName += fileName
	}
	if len(filesToUpload) > 1 {
		jobName += " & others"
	}
	return jobName
}

// startHotFolderUpload creates and starts an upload job for each transfer profile in the hot
// folder. When force is true the upload ignores the already-exists filters and re-uploads every
// file. It returns a jobLaunch per created job so the caller can register it for transient-failure
// retry (see processRetries); a profile that fails to resolve or build a job is skipped and
// contributes no launch.
func startHotFolderUpload(hotFolder *HotFolder, keys []string, jobName string, force bool) []jobLaunch {
	var launches []jobLaunch
	for transferProfileName, destinationFolder := range hotFolder.TransferProfilesAndDestinationFolders {
		if launch, ok := startProfileUpload(profileUpload{
			hotFolderName:     hotFolder.Name,
			sourceFolder:      hotFolder.SourceFolder,
			profileName:       transferProfileName,
			destinationFolder: destinationFolder,
			jobName:           jobName,
			keys:              keys,
			force:             force,
		}); ok {
			launches = append(launches, launch)
		}
	}
	return launches
}

// startProfileUpload starts a single upload job for one transfer profile and returns the launch to
// watch. It is the shared seam for both the initial multi-profile fan-out and a per-profile retry,
// so a retry re-runs only the profile that failed rather than every profile on the hot folder.
func startProfileUpload(req profileUpload) (jobLaunch, bool) {
	transferProfile, err := deps.GetTransferProfile(req.profileName)
	if err != nil {
		events.Events.Warn(strErrorGenericUpload, req.hotFolderName, err)
		return jobLaunch{}, false
	}
	destination := trimHotFolderDestinationPath(req.destinationFolder, transferProfile.Bucket)
	job, err := deps.NewJob(jobmanagertypes.JobConfig{
		Direction:       transfertypes.Upload,
		Name:            req.jobName,
		TransferProfile: &transferProfile,
		Sources:         req.keys,
		Destination:     destination,
		Force:           req.force,
		UploadBasePath:  req.sourceFolder,
	})
	if err != nil {
		events.Events.Warn(strErrorUploadWithRemoteConfig, transferProfile.Name, req.hotFolderName, err)
		return jobLaunch{}, false
	}
	deps.Uploader(job)
	jobId := job.JobId()
	// Decide everKnown at launch, not at poll time. Uploader is synchronous, so by
	// the time the first poll runs the job may already have finished and been
	// cleared ("Clear completed"), which a poll would misread as a never-registered
	// early-return failure and re-upload files that already succeeded. Checking
	// JobState right after Uploader returns tells us truthfully whether the job
	// registered: unknown here means it never did (the session/credentials failed
	// before AddJob), which is the only case resolveUnregisteredJobLocked retries.
	_, known := deps.JobState(jobId)
	return jobLaunch{
		jobId: jobId,
		watch: &jobWatch{
			hotFolderName: req.hotFolderName,
			sourceFolder:  req.sourceFolder,
			profileName:   req.profileName,
			destination:   req.destinationFolder,
			keys:          append([]string(nil), req.keys...),
			everKnown:     known,
		},
	}, true
}

// HotFolderUploadSourceDirectory Starts an upload for the entire source directory of a hot folder.
// Whether already-uploaded files are re-sent is controlled by the hot folder's ForceInitialUpload flag.
// The launched jobs are watched for transient-failure retry too, so a headless daemon that boots
// before its network or credentials are ready recovers the startup sweep without another restart.
func HotFolderUploadSourceDirectory(hotFolder *HotFolder) {
	fileParts := strings.Split(hotFolder.SourceFolder, string(filepath.Separator))
	hotFolderDir := fileParts[len(fileParts)-1]
	launches := startHotFolderUpload(hotFolder, []string{"."},
		strings.Join([]string{"Hot Folder", hotFolderDir}, " - "), hotFolder.ForceInitialUpload)
	registerWatchedJobs(launches)
}

// registerWatchedJobs records launched jobs for retry watching under mtx. Safe to call before the
// watcher loop is running (mtx nil) - there is nothing to race with yet, so registration is skipped.
func registerWatchedJobs(launches []jobLaunch) {
	if mtx == nil {
		return
	}
	mtx.Lock()
	defer mtx.Unlock()
	for _, launch := range launches {
		watchedJobs[launch.jobId] = launch.watch
	}
}

// InitialHotFolderUpload is called when the daemon starts, and uploads the source directory of each hot folder
func InitialHotFolderUpload() {
	for _, hotFolder := range hotFolders {
		if hotFolder.Enabled {
			HotFolderUploadSourceDirectory(hotFolder)
		}
	}
}

// StartWatcher will initialize the file watcher with the configured interval
func StartWatcher(interval time.Duration) error {
	return fileWatcher.Start(interval)
}

// removeDuplicateNamedHotFolders checks for any duplicate-named hot folders from the config. If there is a duplicate,
// it deletes the entry from the hotfolder map and removes the listener if no other hot folders are using the same source folder.
// Returns a list of all hot folder names that had duplicates
func removeDuplicateNamedHotFolders() (duplicates []string) {
	hotFolderNamesCount := make(map[string]int)
	for _, hotFolder := range config.LoadConfiguration().UploadHotFolders {
		if _, alreadyExists := hotFolderNamesCount[hotFolder.Name]; alreadyExists {
			events.Events.Error(strDuplicateHotFolderName, hotFolder.Name)
			hotFolderNamesCount[hotFolder.Name]++
		} else {
			hotFolderNamesCount[hotFolder.Name] = 1
		}
	}
	for hotFolderName, count := range hotFolderNamesCount {
		if count != 1 {
			duplicates = append(duplicates, hotFolderName)
			// the entry will not exist when this function is ran for the first time
			if hotFolder, entryExists := hotFolders[hotFolderName]; entryExists {
				sourceFolder := hotFolder.SourceFolder
				delete(hotFolders, hotFolderName)
				if !IsSourceFolderStillUsed(sourceFolder) {
					err := fileWatcher.RemoveRecursive(sourceFolder)
					if err != nil {
						events.Events.Warn(strErrorRemovingHotFolder, sourceFolder, err)
					}
				}
			}
		}
	}
	return duplicates
}

// trimHotFolderDestinationPath trims common mistakes off of the hot folder destination path, so that it is in an acceptable format
func trimHotFolderDestinationPath(prefix string, bucket string) string {
	prefixTrims := []string{
		strings.Join([]string{"s3://", bucket, "/"}, ""),
		strings.Join([]string{"S3://", bucket, "/"}, ""),
		"s3://",
		"S3://",
		"/",
	}
	for _, prefixTrim := range prefixTrims {
		if strings.HasPrefix(prefix, prefixTrim) {
			events.Events.Info(strTrimmingHotFolder, prefixTrim, prefix)
			prefix = strings.TrimPrefix(prefix, prefixTrim)
		}
	}
	return prefix
}

func isSourceFolderValid(hotFolder HotFolder) bool {
	if hotFolder.SourceFolder == "" {
		events.Events.Error(strEmptySourceFolder, hotFolder.Name)
		return false
	}

	if !filepath.IsAbs(hotFolder.SourceFolder) {
		events.Events.Error(strSourceFolderNotAbsolute, hotFolder.Name, hotFolder.SourceFolder)
		return false
	}

	isAccessible, err := isBasePathAccessible(hotFolder.SourceFolder)
	if err != nil {
		events.Events.Error(strSourceFolderInaccessible, hotFolder.Name)
		return false
	}
	return isAccessible
}

func isBasePathAccessible(sourceFolder string) (bool, error) {
	info, err := os.Stat(sourceFolder)
	if err != nil {
		return false, err
	}

	if info == nil || !info.IsDir() {
		events.Events.Error(strSourceFolderInvalid, sourceFolder)
		return false, nil
	}
	return true, nil
}
