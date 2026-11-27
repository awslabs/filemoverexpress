package hot_folder

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"time"

	"github.com/aws/smithy-go"

	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
)

// processRetries drives automatic, bounded retry of hot folder uploads that
// failed for a transient reason (a brief credential or network outage), so an
// unattended daemon recovers on its own without a restart. Each cycle it:
//
//  1. checks every watched job for a terminal outcome and, per file and transfer
//     profile, either schedules a backed-off retry (transient failure, within the
//     attempt cap) or gives up (permanent error, or cap reached), leaving the job
//     in its terminal error state for the operator to Resubmit;
//  2. promotes any file whose backoff has elapsed by starting a fresh upload for
//     only the profile that failed; and
//  3. ages out any in-flight entry no job ever reported an outcome for.
//
// now is passed in so the backoff schedule is deterministic in tests.
func processRetries(now time.Time) {
	mtx.Lock()
	watched := make(map[string]*jobWatch, len(watchedJobs))
	for jobId, w := range watchedJobs {
		watched[jobId] = w
	}
	mtx.Unlock()

	for jobId, w := range watched {
		status, known := deps.JobState(jobId)
		if known {
			mtx.Lock()
			w.everKnown = true
			mtx.Unlock()
			if !isTerminalStatus(status) {
				continue
			}
		}

		var outcomes []TaskOutcome
		if known {
			outcomes = deps.UploadTaskOutcomes(jobId)
		}

		mtx.Lock()
		delete(watchedJobs, jobId)
		if known {
			resolveTerminalJobLocked(w, status, outcomes, now)
		} else {
			resolveUnregisteredJobLocked(w, now)
		}
		mtx.Unlock()
	}

	mtx.Lock()
	promoteReadyRetriesLocked(now)
	sweepStaleRetriesLocked(now)
	mtx.Unlock()
}

// resolveUnregisteredJobLocked handles a job the manager never reported. If we
// never saw it known, the Uploader returned early before registering it (e.g. the
// session or credentials could not be set up at launch), a transient job-level
// failure, so its launched files are retried. If we did see it earlier, it
// reached a terminal state we already handled and was then cleared, so there is
// nothing to do. The caller must hold mtx.
func resolveUnregisteredJobLocked(w *jobWatch, now time.Time) {
	if !w.everKnown {
		retryLaunchedFilesLocked(w, nil, now)
	}
}

// resolveTerminalJobLocked turns a resolved (terminal) job into per-file retry
// decisions. The caller must hold mtx.
func resolveTerminalJobLocked(w *jobWatch, status jobmanagertypes.JobStatus,
	outcomes []TaskOutcome, now time.Time) {
	// A cancelled job is an operator action, not a failure: clear any retry state
	// for its files and never reschedule them.
	if status == jobmanagertypes.JobStatusCancelled {
		clearRetriesForPathsLocked(uploadPaths(outcomes))
		return
	}

	seen := make(map[string]struct{}, len(outcomes))
	for _, outcome := range outcomes {
		seen[outcome.Path] = struct{}{}
		key := retryKey{path: outcome.Path, hotFolderName: w.hotFolderName, profileName: w.profileName}
		// Only a completed or cleanly-skipped task is a success. A task left
		// non-terminal (Queued/InProgress) because the job errored before it ran -
		// the credential-outage case this retry targets - is a failure, not a
		// success.
		if outcome.Status == jobmanagertypes.TaskStatusCompleted ||
			outcome.Status == jobmanagertypes.TaskStatusSkipped {
			delete(fileRetries, key)
			continue
		}
		handleFailedFileLocked(key, w, outcome.Err, now)
	}

	// An errored job can finish before some launched files ever became tasks (the
	// session failed after the job registered). Retry those files too; the sweep's
	// "." key names no single file and is skipped inside retryLaunchedFilesLocked.
	if status == jobmanagertypes.JobStatusError {
		retryLaunchedFilesLocked(w, seen, now)
	}
}

// retryLaunchedFilesLocked schedules a transient retry for each of the job's
// launched files that was not already handled via a task outcome (in seen). Used
// for jobs that errored or never registered before creating per-file tasks. The
// caller must hold mtx.
func retryLaunchedFilesLocked(w *jobWatch, seen map[string]struct{}, now time.Time) {
	for _, relKey := range w.keys {
		if relKey == "." {
			// Whole-folder sweep key: it names no single file, so there is nothing
			// to re-queue by path. The per-file tasks (if any) are handled above.
			continue
		}
		path := filepath.Join(w.sourceFolder, relKey)
		if _, done := seen[path]; done {
			continue
		}
		key := retryKey{path: path, hotFolderName: w.hotFolderName, profileName: w.profileName}
		// A job-level failure carries no per-file error, so it is treated as
		// transient (nil err below), which is exactly the credential/session case.
		handleFailedFileLocked(key, w, nil, now)
	}
}

// handleFailedFileLocked records a transient failure for a (file, profile) and
// schedules the next attempt with exponential backoff, or gives up when the error
// is permanent or the attempt cap is reached. A nil error is a job-level failure
// (the file never got its own error), which is treated as transient. The caller
// must hold mtx.
func handleFailedFileLocked(key retryKey, w *jobWatch, err error, now time.Time) {
	if isPermanentError(err) {
		delete(fileRetries, key)
		events.Events.Warn(strRetryPermanent, key.path, errString(err))
		return
	}

	entry := fileRetries[key]
	if entry == nil {
		entry = &fileRetry{}
		fileRetries[key] = entry
	}
	// Refresh the restart context in case the hot folder's destination changed.
	entry.sourceFolder = w.sourceFolder
	entry.destination = w.destination

	if entry.attempts >= maxRetryAttempts {
		delete(fileRetries, key)
		events.Events.Warn(strRetryExhausted, key.path, maxRetryAttempts)
		return
	}
	entry.attempts++
	delay := retryDelay(entry.attempts)
	entry.readyAt = now.Add(delay)
	entry.promotedAt = time.Time{}
	events.Events.Info(strRetryScheduled, key.path, entry.attempts, maxRetryAttempts, delay)
}

// promoteReadyRetriesLocked starts a fresh single-profile upload for every file
// whose backoff has elapsed, grouping files by (hot folder, profile, destination)
// so one job carries all the ready files for a profile. Promoted entries are
// marked in-flight (zero readyAt, promotedAt stamped). If the profile can no
// longer be started, the entries are dropped rather than left to leak. The caller
// must hold mtx.
func promoteReadyRetriesLocked(now time.Time) {
	type group struct {
		sourceFolder  string
		hotFolderName string
		profileName   string
		destination   string
		keys          []string
		paths         []string
	}
	groups := map[retryKey]*group{} // keyed by a representative, grouping field below
	order := []*group{}

	for key, entry := range fileRetries {
		if entry.readyAt.IsZero() || now.Before(entry.readyAt) {
			continue
		}
		relKey, err := filepath.Rel(entry.sourceFolder, key.path)
		if err != nil {
			// Cannot express the path under the source folder; drop it.
			delete(fileRetries, key)
			continue
		}
		groupID := retryKey{path: entry.destination, hotFolderName: key.hotFolderName, profileName: key.profileName}
		g := groups[groupID]
		if g == nil {
			g = &group{
				sourceFolder:  entry.sourceFolder,
				hotFolderName: key.hotFolderName,
				profileName:   key.profileName,
				destination:   entry.destination,
			}
			groups[groupID] = g
			order = append(order, g)
		}
		g.keys = append(g.keys, relKey)
		g.paths = append(g.paths, key.path)
		entry.readyAt = time.Time{}
		entry.promotedAt = now
	}

	for _, g := range order {
		launch, ok := startProfileUpload(profileUpload{
			hotFolderName:     g.hotFolderName,
			sourceFolder:      g.sourceFolder,
			profileName:       g.profileName,
			destinationFolder: g.destination,
			jobName:           buildJobName(g.paths),
			keys:              g.keys,
			force:             true,
		})
		if !ok {
			// The profile could not be resolved or the job could not be built;
			// drop the entries so they do not sit in-flight forever.
			for _, p := range g.paths {
				delete(fileRetries, retryKey{path: p, hotFolderName: g.hotFolderName, profileName: g.profileName})
			}
			continue
		}
		watchedJobs[launch.jobId] = launch.watch
	}
}

// sweepStaleRetriesLocked drops in-flight entries (promoted, zero readyAt) that no
// job ever reported an outcome for within retryInFlightTTL - e.g. the hot folder
// was removed, or discovery found no task - so the bookkeeping cannot leak. The
// caller must hold mtx.
func sweepStaleRetriesLocked(now time.Time) {
	for key, entry := range fileRetries {
		if entry.readyAt.IsZero() && !entry.promotedAt.IsZero() &&
			now.Sub(entry.promotedAt) > retryInFlightTTL {
			delete(fileRetries, key)
		}
	}
}

// ClearRetries drops any pending hot folder retry for the given absolute source
// paths, across every hot folder and profile. Called when a job is resubmitted so
// a manual Resubmit and a pending automatic retry do not both upload the file.
func ClearRetries(paths []string) {
	if mtx == nil || len(paths) == 0 {
		return
	}
	set := make(map[string]struct{}, len(paths))
	for _, p := range paths {
		set[p] = struct{}{}
	}
	mtx.Lock()
	defer mtx.Unlock()
	clearRetriesForPathsLocked(pathsFromSet(set))
}

// clearRetriesForPathsLocked removes every retry entry whose path is in paths,
// regardless of hot folder or profile. The caller must hold mtx.
func clearRetriesForPathsLocked(paths []string) {
	if len(paths) == 0 {
		return
	}
	set := make(map[string]struct{}, len(paths))
	for _, p := range paths {
		set[p] = struct{}{}
	}
	for key := range fileRetries {
		if _, ok := set[key.path]; ok {
			delete(fileRetries, key)
		}
	}
}

func pathsFromSet(set map[string]struct{}) []string {
	paths := make([]string, 0, len(set))
	for p := range set {
		paths = append(paths, p)
	}
	return paths
}

func uploadPaths(outcomes []TaskOutcome) []string {
	paths := make([]string, 0, len(outcomes))
	for _, o := range outcomes {
		paths = append(paths, o.Path)
	}
	return paths
}

// retryDelay is the exponential backoff for the nth attempt (1-based):
// retryBaseDelay doubled for each prior attempt, capped at retryMaxDelay.
func retryDelay(attempt int) time.Duration {
	delay := retryBaseDelay
	for i := 1; i < attempt && delay < retryMaxDelay; i++ {
		delay *= 2
	}
	return min(delay, retryMaxDelay)
}

// isTerminalStatus reports whether a job has reached a terminal state (completed,
// completed-with-warnings, errored, or cancelled). NEEDS_REVIEW, paused, and the
// in-progress phases are not terminal and are left to be rechecked next cycle.
func isTerminalStatus(status jobmanagertypes.JobStatus) bool {
	return status.IsCompleted() ||
		status == jobmanagertypes.JobStatusError ||
		status == jobmanagertypes.JobStatusCancelled
}

// isPermanentError reports whether a failed upload must NOT be retried. A nil
// error is a job-level failure with no per-file cause (e.g. session setup), which
// is transient. Local filesystem problems (missing, unreadable, permission-denied
// source) and a cancellation are permanent, as are S3 service errors that no
// amount of retrying fixes (access denied, missing bucket, a disabled KMS key).
// Credential-retrieval and expired-token errors are deliberately left transient,
// since they are the outage this retry targets.
func isPermanentError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.Canceled) {
		return true
	}
	if errors.Is(err, os.ErrNotExist) || errors.Is(err, os.ErrPermission) {
		return true
	}
	var apiErr smithy.APIError
	if errors.As(err, &apiErr) {
		switch apiErr.ErrorCode() {
		case "AccessDenied", "AllAccessDisabled", "NoSuchBucket", "NoSuchKey",
			"InvalidBucketName", "KMS.DisabledException", "KMSInvalidStateException",
			"KMS.AccessDeniedException":
			return true
		}
	}
	return false
}

func errString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}
