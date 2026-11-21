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
