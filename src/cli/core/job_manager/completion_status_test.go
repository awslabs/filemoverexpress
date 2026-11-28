package job_manager

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/types/transfertypes"
)

func newCompletionTestJob(t *testing.T) *jobmanagertypes.Job {
	t.Helper()
	job, err := jobmanagertypes.NewJob(jobmanagertypes.JobConfig{
		Name:      "completionTest",
		Direction: transfertypes.Upload,
		TransferProfile: &configtypes.TransferProfile{
			Name:         "completion-profile",
			Bucket:       "test-bucket",
			Region:       "us-west-2",
			Profile:      "test-profile",
			StorageClass: "standard",
		},
	})
	if err != nil {
		t.Fatalf("NewJob: %v", err)
	}
	return job
}

// A job that passed (or had no) ASC MHL verification completes cleanly.
func TestCompletionStatus_CleanJobIsCompleted(t *testing.T) {
	job := newCompletionTestJob(t)
	assert.Equal(t, jobmanagertypes.JobStatusCompleted, completionStatus(job))
}

// A job whose supplied ASC MHL failed verification must complete amber, not
// green. Regression test for a verify-failed job reporting a clean COMPLETED.
func TestCompletionStatus_VerificationWarningsIsCompletedWithWarnings(t *testing.T) {
	job := newCompletionTestJob(t)
	job.SetHasVerificationWarnings(true)
	assert.Equal(t, jobmanagertypes.JobStatusCompletedWithWarnings, completionStatus(job))
}

// A job in which every file failed to transfer (errors, no successes) must be
// reported as ERROR, never COMPLETED. Regression test for issue #202/#111: a
// hot-folder batch that fails entirely (e.g. a credential outage) used to report
// a clean COMPLETED, hiding silent data loss from unattended monitoring.
func TestCompletionStatus_AllTasksFailedIsError(t *testing.T) {
	job := newCompletionTestJob(t)
	job.SetHasTaskErrors(true)
	assert.Equal(t, jobmanagertypes.JobStatusError, completionStatus(job))
}

// A job in which some files failed and some succeeded is a partial failure and
// must complete amber (COMPLETED_WITH_WARNINGS) so monitoring can detect it,
// rather than a clean COMPLETED.
func TestCompletionStatus_PartialFailureIsCompletedWithWarnings(t *testing.T) {
	job := newCompletionTestJob(t)
	job.SetHasTaskErrors(true)
	job.SetHasSuccessfulTasks(true)
	assert.Equal(t, jobmanagertypes.JobStatusCompletedWithWarnings, completionStatus(job))
}

// Transfer failures dominate the terminal status: an all-failed job is ERROR
// even if a supplied ASC MHL manifest also reported verification warnings.
func TestCompletionStatus_AllTasksFailedWithVerificationWarningsIsError(t *testing.T) {
	job := newCompletionTestJob(t)
	job.SetHasTaskErrors(true)
	job.SetHasVerificationWarnings(true)
	assert.Equal(t, jobmanagertypes.JobStatusError, completionStatus(job))
}

// A partial failure (some succeeded, some failed) combined with a verification
// warning is COMPLETED_WITH_WARNINGS: both warning causes map to the same amber
// terminal status, so their precedence does not matter once a file succeeded.
func TestCompletionStatus_PartialFailureWithVerificationWarningsIsCompletedWithWarnings(t *testing.T) {
	job := newCompletionTestJob(t)
	job.SetHasTaskErrors(true)
	job.SetHasSuccessfulTasks(true)
	job.SetHasVerificationWarnings(true)
	assert.Equal(t, jobmanagertypes.JobStatusCompletedWithWarnings, completionStatus(job))
}

// With no task errors and no successful tasks (the state completionStatus sees
// for a job whose files were all skipped), the terminal status is a clean
// COMPLETED. This pins the function's behavior on that input; the integration
// path that registers skipped tasks and takes the no-filtered-tasks early exit
// is exercised in the job_manager completion flow, not here.
func TestCompletionStatus_NoErrorsNoSuccessesIsCompleted(t *testing.T) {
	job := newCompletionTestJob(t)
	assert.False(t, job.HasTaskErrors())
	assert.False(t, job.HasSuccessfulTasks())
	assert.Equal(t, jobmanagertypes.JobStatusCompleted, completionStatus(job))
}

// Proceeding at the verification gate parks the job in NEEDS_REVIEW and returns
// true once the operator resolves it.
func TestAwaitVerificationGate_Proceed(t *testing.T) {
	job := newCompletionTestJob(t)
	done := make(chan bool, 1)
	go func() { done <- awaitVerificationGate(job, 2) }()

	require.Eventually(t, func() bool {
		return job.Status() == jobmanagertypes.JobStatusNeedsReview
	}, time.Second, 5*time.Millisecond)

	job.ResolveGate(true)
	assert.True(t, <-done)
}

// Stopping at the gate returns false so the caller aborts the upload.
func TestAwaitVerificationGate_Stop(t *testing.T) {
	job := newCompletionTestJob(t)
	done := make(chan bool, 1)
	go func() { done <- awaitVerificationGate(job, 2) }()

	require.Eventually(t, func() bool {
		return job.Status() == jobmanagertypes.JobStatusNeedsReview
	}, time.Second, 5*time.Millisecond)

	job.ResolveGate(false)
	assert.False(t, <-done)
}
