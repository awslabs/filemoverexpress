package hot_folder

import (
	"context"
	"errors"
	"os"
	"slices"
	"time"

	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
)

// processRetries drives automatic, bounded retry of hot folder uploads that
// failed for a transient reason (a brief credential or network outage), so an
// unattended daemon recovers on its own without a restart. Each cycle it:
//
//  1. checks every watched job for a terminal outcome and, for each errored file,
//     either schedules a backed-off retry (transient error, within the attempt
//     cap) or gives up (permanent error, or cap reached), leaving the job in its
//     terminal error state for the operator to Resubmit; and
//  2. promotes any file whose backoff has elapsed back onto the pending queue.
//
// Files that failed for a permanent reason (the source is missing, unreadable,
// or permission-denied) are never retried: re-reading on a timer cannot help,
// and the operator fixing the source fires a fresh watcher event that supersedes
// the failure. now is passed in so the backoff schedule is deterministic in tests.
func processRetries(now time.Time) {
	mtx.Lock()
	watched := make([]string, 0, len(watchedJobs))
	for jobId := range watchedJobs {
		watched = append(watched, jobId)
	}
	mtx.Unlock()

	for _, jobId := range watched {
		// Query the job manager without holding mtx (it takes its own locks).
		status, known := deps.JobState(jobId)
		if known && !isTerminalStatus(status) {
			continue
		}
		var outcomes []TaskOutcome
		if known {
			outcomes = deps.UploadTaskOutcomes(jobId)
		}

		mtx.Lock()
		delete(watchedJobs, jobId)
		for _, outcome := range outcomes {
			if outcome.Errored {
				handleFailedFileLocked(outcome.Path, outcome.Err, now)
			} else {
				// Succeeded or cleanly skipped: clear any retry bookkeeping.
				delete(fileRetries, outcome.Path)
			}
		}
		mtx.Unlock()
	}

	mtx.Lock()
	promoteReadyRetriesLocked(now)
	mtx.Unlock()
}

// handleFailedFileLocked records a transient failure for a file and schedules the
// next attempt with exponential backoff, or gives up when the error is permanent
// or the attempt cap is reached. The caller must hold mtx.
func handleFailedFileLocked(path string, err error, now time.Time) {
	if !isTransientError(err) {
		delete(fileRetries, path)
		events.Events.Warn(strRetryPermanent, path, errString(err))
		return
	}

	entry := fileRetries[path]
	if entry == nil {
		entry = &fileRetry{}
		fileRetries[path] = entry
	}
	if entry.attempts >= maxRetryAttempts {
		delete(fileRetries, path)
		events.Events.Warn(strRetryExhausted, path, maxRetryAttempts)
		return
	}
	entry.attempts++
	delay := retryDelay(entry.attempts)
	entry.readyAt = now.Add(delay)
	events.Events.Info(strRetryScheduled, path, entry.attempts, maxRetryAttempts, delay)
}

// promoteReadyRetriesLocked moves files whose backoff has elapsed back onto the
// pending queue and marks them in-flight (zero readyAt) while keeping their
// attempt count. The caller must hold mtx.
func promoteReadyRetriesLocked(now time.Time) {
	for path, entry := range fileRetries {
		if entry.readyAt.IsZero() || now.Before(entry.readyAt) {
			continue
		}
		entry.readyAt = time.Time{}
		if !slices.Contains(pendingUploads, path) {
			pendingUploads = append(pendingUploads, path)
		}
	}
}

// retryDelay is the exponential backoff for the nth attempt (1-based):
// retryBaseDelay doubled for each prior attempt, capped at retryMaxDelay.
func retryDelay(attempt int) time.Duration {
	delay := retryBaseDelay
	for i := 1; i < attempt; i++ {
		delay *= 2
		if delay >= retryMaxDelay {
			return retryMaxDelay
		}
	}
	if delay > retryMaxDelay {
		return retryMaxDelay
	}
	return delay
}

// isTerminalStatus reports whether a job has reached a terminal state (completed,
// completed-with-warnings, errored, or cancelled). NEEDS_REVIEW, paused, and the
// in-progress phases are not terminal and are left to be rechecked next cycle.
func isTerminalStatus(status jobmanagertypes.JobStatus) bool {
	return status.IsCompleted() ||
		status == jobmanagertypes.JobStatusError ||
		status == jobmanagertypes.JobStatusCancelled
}

// isTransientError reports whether a failed upload should be retried. Local
// filesystem problems (missing, unreadable, or permission-denied source) are
// permanent: a timer cannot fix them, and the operator repairing the source
// fires a fresh watcher event that re-queues the file anyway. A cancellation is
// not a failure. Everything else (network drops, timeouts, throttling, 5xx,
// credential retrieval failures during a short outage) is treated as transient;
// the attempt cap bounds the cost of misclassifying a persistent error.
func isTransientError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.Canceled) {
		return false
	}
	if errors.Is(err, os.ErrNotExist) || errors.Is(err, os.ErrPermission) {
		return false
	}
	return true
}

func errString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}
