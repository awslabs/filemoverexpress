package hot_folder

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
)

// resetRetryState initializes the package globals the retry logic touches and
// restores the retry tuning afterwards, so each test starts from a clean slate.
func resetRetryState(t *testing.T) {
	t.Helper()
	mtx = &sync.Mutex{}
	watchedJobs = map[string]struct{}{}
	fileRetries = map[string]*fileRetry{}
	pendingUploads = nil

	origAttempts, origBase, origMax := maxRetryAttempts, retryBaseDelay, retryMaxDelay
	t.Cleanup(func() {
		maxRetryAttempts, retryBaseDelay, retryMaxDelay = origAttempts, origBase, origMax
	})
}

func TestIsTransientError(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{name: "nil is not transient", err: nil, want: false},
		{name: "context canceled is not transient", err: context.Canceled, want: false},
		{name: "missing source file is permanent", err: fmt.Errorf("open: %w", os.ErrNotExist), want: false},
		{name: "permission denied is permanent", err: fmt.Errorf("open: %w", os.ErrPermission), want: false},
		{name: "PathError not-exist is permanent", err: &os.PathError{Op: "open", Path: "/x", Err: os.ErrNotExist}, want: false},
		{name: "network error is transient", err: errors.New("connection reset by peer"), want: true},
		{name: "credential error is transient", err: errors.New("failed to retrieve credentials"), want: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, isTransientError(tt.err))
		})
	}
}

func TestRetryDelay(t *testing.T) {
	resetRetryState(t)
	retryBaseDelay = 30 * time.Second
	retryMaxDelay = 5 * time.Minute

	assert.Equal(t, 30*time.Second, retryDelay(1))
	assert.Equal(t, 1*time.Minute, retryDelay(2))
	assert.Equal(t, 2*time.Minute, retryDelay(3))
	assert.Equal(t, 4*time.Minute, retryDelay(4))
	// Capped from attempt 5 on.
	assert.Equal(t, 5*time.Minute, retryDelay(5))
	assert.Equal(t, 5*time.Minute, retryDelay(9))
}

// A transient failure schedules a backed-off retry and increments the attempt
// count each time, until the cap is reached and the file is given up on.
func TestHandleFailedFile_TransientSchedulesThenGivesUp(t *testing.T) {
	resetRetryState(t)
	maxRetryAttempts = 2
	retryBaseDelay = 10 * time.Millisecond
	retryMaxDelay = time.Second
	now := time.Now()
	path := "/src/clip.mov"
	transient := errors.New("network drop")

	handleFailedFileLocked(path, transient, now)
	require := assert.New(t)
	require.Equal(1, fileRetries[path].attempts)
	require.False(fileRetries[path].readyAt.IsZero())

	handleFailedFileLocked(path, transient, now)
	require.Equal(2, fileRetries[path].attempts)

	// Third failure is at the cap: give up and drop the bookkeeping.
	handleFailedFileLocked(path, transient, now)
	_, stillTracked := fileRetries[path]
	require.False(stillTracked)
}

// A permanent failure (missing/unreadable source) is never scheduled for retry.
func TestHandleFailedFile_PermanentNotRetried(t *testing.T) {
	resetRetryState(t)
	fileRetries["/src/gone.mov"] = &fileRetry{attempts: 1, readyAt: time.Now()}
	handleFailedFileLocked("/src/gone.mov", fmt.Errorf("stat: %w", os.ErrNotExist), time.Now())
	_, tracked := fileRetries["/src/gone.mov"]
	assert.False(t, tracked)
}

// A file whose backoff has elapsed is promoted back onto the pending queue and
// marked in-flight (zero readyAt); one still waiting is left alone; no dupes.
func TestPromoteReadyRetries(t *testing.T) {
	resetRetryState(t)
	now := time.Now()
	fileRetries["/ready.mov"] = &fileRetry{attempts: 1, readyAt: now.Add(-time.Second)}
	fileRetries["/waiting.mov"] = &fileRetry{attempts: 1, readyAt: now.Add(time.Minute)}
	fileRetries["/inflight.mov"] = &fileRetry{attempts: 1} // zero readyAt

	promoteReadyRetriesLocked(now)

	assert.Contains(t, pendingUploads, "/ready.mov")
	assert.NotContains(t, pendingUploads, "/waiting.mov")
	assert.True(t, fileRetries["/ready.mov"].readyAt.IsZero(), "promoted file is marked in-flight")

	// Idempotent: promoting again does not duplicate the queued file.
	promoteReadyRetriesLocked(now)
	count := 0
	for _, p := range pendingUploads {
		if p == "/ready.mov" {
			count++
		}
	}
	assert.Equal(t, 1, count)
}

func withFakeDeps(t *testing.T) *mockUploadDeps {
	t.Helper()
	original := deps
	t.Cleanup(func() { deps = original })
	fake := &mockUploadDeps{}
	deps = fake
	return fake
}

// A watched job that terminates with a transient per-file error schedules that
// file for retry and stops watching the job.
func TestProcessRetries_TerminalTransientSchedulesRetry(t *testing.T) {
	resetRetryState(t)
	retryBaseDelay = 10 * time.Millisecond
	retryMaxDelay = time.Second
	watchedJobs["job1"] = struct{}{}

	fake := withFakeDeps(t)
	fake.On("JobState", "job1").Return(jobmanagertypes.JobStatusError, true)
	fake.On("UploadTaskOutcomes", "job1").Return([]TaskOutcome{
		{Path: "/src/a.mov", Errored: true, Err: errors.New("network drop")},
	})

	now := time.Now()
	processRetries(now)

	_, stillWatched := watchedJobs["job1"]
	assert.False(t, stillWatched, "terminal job is no longer watched")
	require := assert.New(t)
	require.NotNil(fileRetries["/src/a.mov"])
	require.Equal(1, fileRetries["/src/a.mov"].attempts)
	// Not yet promoted (backoff has not elapsed).
	require.NotContains(pendingUploads, "/src/a.mov")

	// Once the backoff elapses, the next cycle promotes it onto the queue.
	processRetries(now.Add(time.Second))
	assert.Contains(t, pendingUploads, "/src/a.mov")
}

// A job that is still running is left on the watch list for the next cycle.
func TestProcessRetries_NonTerminalKeepsWatching(t *testing.T) {
	resetRetryState(t)
	watchedJobs["job1"] = struct{}{}

	fake := withFakeDeps(t)
	fake.On("JobState", "job1").Return(jobmanagertypes.JobStatusInProgress, true)

	processRetries(time.Now())

	_, stillWatched := watchedJobs["job1"]
	assert.True(t, stillWatched)
	fake.AssertNotCalled(t, "UploadTaskOutcomes", "job1")
}

// A clean terminal job clears any lingering retry bookkeeping for its files.
func TestProcessRetries_CleanCompletionClearsRetry(t *testing.T) {
	resetRetryState(t)
	watchedJobs["job1"] = struct{}{}
	fileRetries["/src/b.mov"] = &fileRetry{attempts: 2}

	fake := withFakeDeps(t)
	fake.On("JobState", "job1").Return(jobmanagertypes.JobStatusCompleted, true)
	fake.On("UploadTaskOutcomes", "job1").Return([]TaskOutcome{
		{Path: "/src/b.mov", Errored: false},
	})

	processRetries(time.Now())

	_, tracked := fileRetries["/src/b.mov"]
	assert.False(t, tracked)
	_, stillWatched := watchedJobs["job1"]
	assert.False(t, stillWatched)
}

// A job the manager no longer knows about (already cleared) is dropped from the
// watch list without scheduling anything.
func TestProcessRetries_UnknownJobDropped(t *testing.T) {
	resetRetryState(t)
	watchedJobs["job1"] = struct{}{}

	fake := withFakeDeps(t)
	fake.On("JobState", "job1").Return(jobmanagertypes.JobStatusUnknown, false)

	processRetries(time.Now())

	_, stillWatched := watchedJobs["job1"]
	assert.False(t, stillWatched)
	fake.AssertNotCalled(t, "UploadTaskOutcomes", "job1")
}

// A fresh filesystem event for a file clears its pending retry backoff so the
// replaced contents upload immediately as a first attempt.
func TestRecordFileEvent_ResetsRetry(t *testing.T) {
	resetRetryState(t)
	hotFolders = map[string]*HotFolder{}
	lastUpdated = map[string]time.Time{}
	path := "/src/replaced.mov"
	fileRetries[path] = &fileRetry{attempts: 3, readyAt: time.Now().Add(time.Hour)}

	recordFileEvent(path)

	_, tracked := fileRetries[path]
	assert.False(t, tracked, "a fresh write clears the stale backoff")
	assert.Contains(t, pendingUploads, path)
}
