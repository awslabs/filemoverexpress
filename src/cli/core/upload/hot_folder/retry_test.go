package hot_folder

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/aws/smithy-go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
)

// apiErr is a minimal smithy.APIError for classifying S3 service errors.
type apiErr struct{ code string }

func (e apiErr) Error() string                 { return e.code }
func (e apiErr) ErrorCode() string             { return e.code }
func (e apiErr) ErrorMessage() string          { return e.code }
func (e apiErr) ErrorFault() smithy.ErrorFault { return smithy.FaultClient }

// resetRetryState initializes the package globals the retry logic touches and
// restores the retry tuning afterwards, so each test starts from a clean slate.
func resetRetryState(t *testing.T) {
	t.Helper()
	mtx = &sync.Mutex{}
	watchedJobs = map[string]*jobWatch{}
	fileRetries = map[retryKey]*fileRetry{}
	pendingUploads = nil

	origAttempts, origBase, origMax, origTTL := maxRetryAttempts, retryBaseDelay, retryMaxDelay, retryInFlightTTL
	t.Cleanup(func() {
		maxRetryAttempts, retryBaseDelay, retryMaxDelay, retryInFlightTTL = origAttempts, origBase, origMax, origTTL
	})
}

func withFakeDeps(t *testing.T) *mockUploadDeps {
	t.Helper()
	original := deps
	t.Cleanup(func() { deps = original })
	fake := &mockUploadDeps{}
	deps = fake
	return fake
}

func watch(hotFolder, sourceFolder, profile string, keys ...string) *jobWatch {
	return &jobWatch{hotFolderName: hotFolder, sourceFolder: sourceFolder, profileName: profile, keys: keys}
}

func TestIsPermanentError(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{name: "nil (job-level failure) is transient", err: nil, want: false},
		{name: "context canceled is permanent", err: context.Canceled, want: true},
		{name: "missing source file is permanent", err: fmt.Errorf("open: %w", os.ErrNotExist), want: true},
		{name: "permission denied is permanent", err: fmt.Errorf("open: %w", os.ErrPermission), want: true},
		{name: "access denied (S3) is permanent", err: apiErr{code: "AccessDenied"}, want: true},
		{name: "no such bucket is permanent", err: apiErr{code: "NoSuchBucket"}, want: true},
		{name: "throttling (S3) is transient", err: apiErr{code: "SlowDown"}, want: false},
		{name: "expired token is transient", err: apiErr{code: "ExpiredToken"}, want: false},
		{name: "network error is transient", err: errors.New("connection reset by peer"), want: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, isPermanentError(tt.err))
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
	assert.Equal(t, 5*time.Minute, retryDelay(5))
	assert.Equal(t, 5*time.Minute, retryDelay(9))
}

// A transient failure schedules a backed-off retry and increments the attempt
// count each time, until the cap is reached and the (file, profile) is given up.
func TestHandleFailedFile_TransientSchedulesThenGivesUp(t *testing.T) {
	resetRetryState(t)
	maxRetryAttempts = 2
	retryBaseDelay = 10 * time.Millisecond
	retryMaxDelay = time.Second
	now := time.Now()
	w := watch("hf", "/src", "profA", "clip.mov")
	key := retryKey{path: "/src/clip.mov", hotFolderName: "hf", profileName: "profA"}

	handleFailedFileLocked(key, w, errors.New("network drop"), now)
	assert.Equal(t, 1, fileRetries[key].attempts)
	assert.False(t, fileRetries[key].readyAt.IsZero())

	handleFailedFileLocked(key, w, errors.New("network drop"), now)
	assert.Equal(t, 2, fileRetries[key].attempts)

	handleFailedFileLocked(key, w, errors.New("network drop"), now)
	_, tracked := fileRetries[key]
	assert.False(t, tracked, "at the cap the entry is dropped")
}

// A permanent failure (missing/unreadable source) is never scheduled for retry.
func TestHandleFailedFile_PermanentNotRetried(t *testing.T) {
	resetRetryState(t)
	w := watch("hf", "/src", "profA", "gone.mov")
	key := retryKey{path: "/src/gone.mov", hotFolderName: "hf", profileName: "profA"}
	fileRetries[key] = &fileRetry{attempts: 1, readyAt: time.Now()}

	handleFailedFileLocked(key, w, fmt.Errorf("stat: %w", os.ErrNotExist), time.Now())
	_, tracked := fileRetries[key]
	assert.False(t, tracked)
}

// A job-level failure (nil per-file error) is treated as transient and scheduled.
func TestHandleFailedFile_NilErrorIsTransient(t *testing.T) {
	resetRetryState(t)
	retryBaseDelay = 10 * time.Millisecond
	w := watch("hf", "/src", "profA", "clip.mov")
	key := retryKey{path: "/src/clip.mov", hotFolderName: "hf", profileName: "profA"}

	handleFailedFileLocked(key, w, nil, time.Now())
	assert.NotNil(t, fileRetries[key])
	assert.Equal(t, 1, fileRetries[key].attempts)
}

// A watched job that terminates with a transient per-file error schedules that
// (file, profile) for retry and stops watching the job.
func TestProcessRetries_TerminalTransientSchedulesRetry(t *testing.T) {
	resetRetryState(t)
	retryBaseDelay = 10 * time.Millisecond
	watchedJobs["job1"] = watch("hf", "/src", "profA", "a.mov")

	fake := withFakeDeps(t)
	fake.On("JobState", "job1").Return(jobmanagertypes.JobStatusError, true)
	fake.On("UploadTaskOutcomes", "job1").Return([]TaskOutcome{
		{Path: "/src/a.mov", Status: jobmanagertypes.TaskStatusError, Err: errors.New("network drop")},
	})

	processRetries(time.Now())

	_, stillWatched := watchedJobs["job1"]
	assert.False(t, stillWatched)
	assert.NotNil(t, fileRetries[retryKey{path: "/src/a.mov", hotFolderName: "hf", profileName: "profA"}])
}

// Regression for the credential-outage case: a task left Queued because its job
// errored before it ran must be retried, not counted as a success.
func TestProcessRetries_NeverRanTaskIsRetried(t *testing.T) {
	resetRetryState(t)
	retryBaseDelay = 10 * time.Millisecond
	watchedJobs["job1"] = watch("hf", "/src", "profA", "a.mov")

	fake := withFakeDeps(t)
	fake.On("JobState", "job1").Return(jobmanagertypes.JobStatusError, true)
	fake.On("UploadTaskOutcomes", "job1").Return([]TaskOutcome{
		{Path: "/src/a.mov", Status: jobmanagertypes.TaskStatusQueued, Err: nil},
	})

	processRetries(time.Now())

	assert.NotNil(t, fileRetries[retryKey{path: "/src/a.mov", hotFolderName: "hf", profileName: "profA"}],
		"a Queued task in an errored job must be retried")
}

// Regression for the multi-profile race: a failure on one profile and a success
// on another for the same file must not clobber each other.
func TestProcessRetries_MultiProfileIndependent(t *testing.T) {
	resetRetryState(t)
	retryBaseDelay = 10 * time.Millisecond
	watchedJobs["jobA"] = watch("hf", "/src", "profA", "a.mov")
	watchedJobs["jobB"] = watch("hf", "/src", "profB", "a.mov")

	fake := withFakeDeps(t)
	fake.On("JobState", "jobA").Return(jobmanagertypes.JobStatusError, true)
	fake.On("UploadTaskOutcomes", "jobA").Return([]TaskOutcome{
		{Path: "/src/a.mov", Status: jobmanagertypes.TaskStatusError, Err: errors.New("network drop")},
	})
	fake.On("JobState", "jobB").Return(jobmanagertypes.JobStatusCompleted, true)
	fake.On("UploadTaskOutcomes", "jobB").Return([]TaskOutcome{
		{Path: "/src/a.mov", Status: jobmanagertypes.TaskStatusCompleted},
	})

	processRetries(time.Now())

	assert.NotNil(t, fileRetries[retryKey{path: "/src/a.mov", hotFolderName: "hf", profileName: "profA"}],
		"profA failure retry must survive")
	_, profBTracked := fileRetries[retryKey{path: "/src/a.mov", hotFolderName: "hf", profileName: "profB"}]
	assert.False(t, profBTracked, "profB success must not create or clobber a retry")
}

// A job still running is left on the watch list and marked everKnown.
func TestProcessRetries_NonTerminalKeepsWatching(t *testing.T) {
	resetRetryState(t)
	watchedJobs["job1"] = watch("hf", "/src", "profA", "a.mov")

	fake := withFakeDeps(t)
	fake.On("JobState", "job1").Return(jobmanagertypes.JobStatusInProgress, true)

	processRetries(time.Now())

	w, stillWatched := watchedJobs["job1"]
	assert.True(t, stillWatched)
	assert.True(t, w.everKnown)
	fake.AssertNotCalled(t, "UploadTaskOutcomes", "job1")
}

// A clean completion clears any lingering retry for its (file, profile).
func TestProcessRetries_CleanCompletionClearsRetry(t *testing.T) {
	resetRetryState(t)
	watchedJobs["job1"] = watch("hf", "/src", "profA", "b.mov")
	fileRetries[retryKey{path: "/src/b.mov", hotFolderName: "hf", profileName: "profA"}] = &fileRetry{attempts: 2}

	fake := withFakeDeps(t)
	fake.On("JobState", "job1").Return(jobmanagertypes.JobStatusCompleted, true)
	fake.On("UploadTaskOutcomes", "job1").Return([]TaskOutcome{
		{Path: "/src/b.mov", Status: jobmanagertypes.TaskStatusCompleted},
	})

	processRetries(time.Now())

	_, tracked := fileRetries[retryKey{path: "/src/b.mov", hotFolderName: "hf", profileName: "profA"}]
	assert.False(t, tracked)
}

// A cancelled job is an operator action and must not be retried.
func TestProcessRetries_CancelledNotRetried(t *testing.T) {
	resetRetryState(t)
	watchedJobs["job1"] = watch("hf", "/src", "profA", "a.mov")

	fake := withFakeDeps(t)
	fake.On("JobState", "job1").Return(jobmanagertypes.JobStatusCancelled, true)
	fake.On("UploadTaskOutcomes", "job1").Return([]TaskOutcome{
		{Path: "/src/a.mov", Status: jobmanagertypes.TaskStatusCancelled},
	})

	processRetries(time.Now())

	assert.Empty(t, fileRetries)
}

// A job that was never registered (Uploader returned early) and was never seen
// known is treated as a transient failure and its launched files are retried.
func TestProcessRetries_UnknownNeverSeenRetriesLaunchedFiles(t *testing.T) {
	resetRetryState(t)
	retryBaseDelay = 10 * time.Millisecond
	watchedJobs["job1"] = watch("hf", "/src", "profA", "a.mov")

	fake := withFakeDeps(t)
	fake.On("JobState", "job1").Return(jobmanagertypes.JobStatusUnknown, false)

	processRetries(time.Now())

	assert.NotNil(t, fileRetries[retryKey{path: "/src/a.mov", hotFolderName: "hf", profileName: "profA"}])
	fake.AssertNotCalled(t, "UploadTaskOutcomes", "job1")
}

// A job that was seen known earlier and is now gone (completed then cleared) is
// not retried.
func TestProcessRetries_UnknownSeenBeforeNotRetried(t *testing.T) {
	resetRetryState(t)
	w := watch("hf", "/src", "profA", "a.mov")
	w.everKnown = true
	watchedJobs["job1"] = w

	fake := withFakeDeps(t)
	fake.On("JobState", "job1").Return(jobmanagertypes.JobStatusUnknown, false)

	processRetries(time.Now())

	assert.Empty(t, fileRetries)
}

// A ready retry is promoted by starting a fresh single-profile upload for the
// file, which is then watched.
func TestPromoteReadyRetries_StartsSingleProfileJob(t *testing.T) {
	resetRetryState(t)
	now := time.Now()
	key := retryKey{path: filepath.Join("/src", "a.mov"), hotFolderName: "hf", profileName: "profA"}
	fileRetries[key] = &fileRetry{attempts: 1, readyAt: now.Add(-time.Second), sourceFolder: "/src", destination: "dest"}

	fake := withFakeDeps(t)
	fake.On("GetTransferProfile", "profA").Return(configtypes.TransferProfile{Name: "profA", Bucket: "bucket"}, nil)
	fake.On("NewJob", mock.Anything).Return(newTestJob(t), nil)
	fake.On("Uploader", mock.Anything).Return()

	promoteReadyRetriesLocked(now)

	assert.True(t, fileRetries[key].readyAt.IsZero(), "promoted entry is marked in-flight")
	assert.False(t, fileRetries[key].promotedAt.IsZero())
	assert.Len(t, watchedJobs, 1, "the promoted retry job is watched")
	fake.AssertCalled(t, "Uploader", mock.Anything)
}

// An in-flight entry no job ever reports on is aged out after the TTL.
func TestSweepStaleRetries(t *testing.T) {
	resetRetryState(t)
	retryInFlightTTL = time.Minute
	now := time.Now()
	stale := retryKey{path: "/src/stale.mov", hotFolderName: "hf", profileName: "profA"}
	fresh := retryKey{path: "/src/fresh.mov", hotFolderName: "hf", profileName: "profA"}
	fileRetries[stale] = &fileRetry{promotedAt: now.Add(-2 * time.Minute)}
	fileRetries[fresh] = &fileRetry{promotedAt: now.Add(-10 * time.Second)}

	sweepStaleRetriesLocked(now)

	_, staleTracked := fileRetries[stale]
	_, freshTracked := fileRetries[fresh]
	assert.False(t, staleTracked, "a leaked in-flight entry is aged out")
	assert.True(t, freshTracked, "a recent in-flight entry is kept")
}

// ClearRetries drops retries for the given paths across every profile, so a
// manual Resubmit does not double-upload with a pending automatic retry.
func TestClearRetries(t *testing.T) {
	resetRetryState(t)
	fileRetries[retryKey{path: "/src/a.mov", hotFolderName: "hf", profileName: "profA"}] = &fileRetry{attempts: 1}
	fileRetries[retryKey{path: "/src/a.mov", hotFolderName: "hf", profileName: "profB"}] = &fileRetry{attempts: 1}
	fileRetries[retryKey{path: "/src/b.mov", hotFolderName: "hf", profileName: "profA"}] = &fileRetry{attempts: 1}

	ClearRetries([]string{"/src/a.mov"})

	assert.Len(t, fileRetries, 1)
	assert.NotNil(t, fileRetries[retryKey{path: "/src/b.mov", hotFolderName: "hf", profileName: "profA"}])
}

// A fresh filesystem event clears every pending retry for that path so the
// replaced contents upload immediately as a first attempt.
func TestRecordFileEvent_ResetsRetry(t *testing.T) {
	resetRetryState(t)
	hotFolders = map[string]*HotFolder{}
	lastUpdated = map[string]time.Time{}
	path := "/src/replaced.mov"
	fileRetries[retryKey{path: path, hotFolderName: "hf", profileName: "profA"}] = &fileRetry{attempts: 3, readyAt: time.Now().Add(time.Hour)}
	fileRetries[retryKey{path: path, hotFolderName: "hf", profileName: "profB"}] = &fileRetry{attempts: 3, readyAt: time.Now().Add(time.Hour)}

	recordFileEvent(path)

	assert.Empty(t, fileRetries, "a fresh write clears the stale backoff across profiles")
	assert.Contains(t, pendingUploads, path)
}
