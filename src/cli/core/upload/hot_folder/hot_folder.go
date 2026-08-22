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
	"github.com/awslabs/filemoverexpress/core/upload"
	"github.com/awslabs/filemoverexpress/events"
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
)

type HotFolder struct {
	Name         string
	Enabled      bool
	SourceFolder string
	// key: transfer profile name, value: destination folder
	TransferProfilesAndDestinationFolders map[string]string
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
		if strings.HasPrefix(path, hotFolder.SourceFolder) {
			lastUpdated[hotFolder.SourceFolder] = now
		}
	}
	if !slices.Contains(pendingUploads, path) {
		pendingUploads = append(pendingUploads, path)
	}
}

// processFileUpdates periodically checks whether there are any pending hot folder uploads.
// Debouncing is evaluated per hot folder: a hot folder's pending files are only uploaded once
// that hot folder has had no filesystem activity for fileUpdateWaitTime. Files belonging to a
// hot folder that is still active are left queued for a later cycle, so a file is never scheduled
// while it (or any other file in the same hot folder) is still being written.
func processFileUpdates() {
	for {
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
	consumed := make(map[string]bool)
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
		StartHotFolderUpload(hotFolder, keys, buildJobName(keys))
		for _, file := range matched {
			consumed[file] = true
		}
	}
	if len(consumed) == 0 {
		return
	}
	remaining := pendingUploads[:0]
	for _, file := range pendingUploads {
		if !consumed[file] {
			remaining = append(remaining, file)
		}
	}
	pendingUploads = remaining
}

// keysForHotFolder returns the S3-relative upload keys for the pending files that belong to the
// given source folder, along with the absolute paths that matched so they can be dequeued.
func keysForHotFolder(sourceFolder string, files []string) (keys []string, matched []string) {
	for _, file := range files {
		if !strings.HasPrefix(file, sourceFolder) {
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

// StartHotFolderUpload Creates a job and starts an Upload for each remote configuration in the hot folder
func StartHotFolderUpload(hotFolder *HotFolder, keys []string, jobName string) {
	for transferProfileName, destinationFolder := range hotFolder.TransferProfilesAndDestinationFolders {
		transferProfile, err := config.LoadConfiguration().GetTransferProfile(transferProfileName)
		if err != nil {
			events.Events.Warn(strErrorGenericUpload, hotFolder.Name, err)
			continue
		}
		job, err := jobmanagertypes.NewJob(jobmanagertypes.JobConfig{
			Direction:       transfertypes.Upload,
			Name:            jobName,
			TransferProfile: &transferProfile,
			Sources:         keys,
			Destination:     trimHotFolderDestinationPath(destinationFolder, transferProfile.Bucket),
			Force:           true,
			UploadBasePath:  hotFolder.SourceFolder,
		})
		if err != nil {
			events.Events.Warn(strErrorUploadWithRemoteConfig, transferProfile.Name,
				hotFolder.Name, err)
			continue
		}
		upload.Uploader(job)
	}
}

// HotFolderUploadSourceDirectory Starts an upload for the entire source directory of a hot folder
func HotFolderUploadSourceDirectory(hotFolder *HotFolder) {
	fileParts := strings.Split(hotFolder.SourceFolder, string(filepath.Separator))
	hotFolderDir := fileParts[len(fileParts)-1]
	StartHotFolderUpload(hotFolder, []string{"."}, strings.Join([]string{"Hot Folder", hotFolderDir}, " - "))
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
