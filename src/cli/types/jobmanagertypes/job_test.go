package jobmanagertypes

import (
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/types/transfertypes"
)

func newASCMHLTestJob(t *testing.T) *Job {
	t.Helper()
	job, err := NewJob(JobConfig{
		Name:      "asc-mhl-job",
		Direction: transfertypes.Upload,
		TransferProfile: &configtypes.TransferProfile{
			Name:         "test-profile",
			Bucket:       "test-bucket",
			Region:       "us-west-2",
			Profile:      "test-profile",
			StorageClass: "standard",
		},
	})
	require.NoError(t, err)
	return job
}

// A job with no supplied manifest reports zero ASC MHL verification, and the
// protobuf carries the zero values.
func TestJob_ASCMHLResultDefaultsEmpty(t *testing.T) {
	job := newASCMHLTestJob(t)

	assert.Equal(t, 0, job.ASCMHLVerified())
	assert.Equal(t, 0, job.ASCMHLListed())
	assert.Equal(t, 0, job.ASCMHLProblems())
	assert.Equal(t, "", job.ASCMHLAlgorithm())

	pb := job.ToProtobuf()
	assert.Equal(t, int32(0), pb.GetAscMhlVerified())
	assert.Equal(t, int32(0), pb.GetAscMhlListed())
	assert.Equal(t, int32(0), pb.GetAscMhlProblems())
	assert.Equal(t, "", pb.GetAscMhlAlgorithm())
}

// SetASCMHLResult records the verification outcome, readable through the getters
// and carried onto the protobuf the GUI consumes.
func TestJob_SetASCMHLResult(t *testing.T) {
	job := newASCMHLTestJob(t)

	job.SetASCMHLResult(3, 4, 1, "xxhash64")

	assert.Equal(t, 3, job.ASCMHLVerified())
	assert.Equal(t, 4, job.ASCMHLListed())
	assert.Equal(t, 1, job.ASCMHLProblems())
	assert.Equal(t, "xxhash64", job.ASCMHLAlgorithm())

	pb := job.ToProtobuf()
	assert.Equal(t, int32(3), pb.GetAscMhlVerified())
	assert.Equal(t, int32(4), pb.GetAscMhlListed())
	assert.Equal(t, int32(1), pb.GetAscMhlProblems())
	assert.Equal(t, "xxhash64", pb.GetAscMhlAlgorithm())
}

// NEEDS_REVIEW is a non-terminal pause with a human-readable label.
func TestJobStatus_NeedsReviewRoundTrip(t *testing.T) {
	assert.Equal(t, "Needs Review", JobStatusNeedsReview.String())
	assert.Equal(t, JobStatusNeedsReview, JobStatusFromString("NEEDS_REVIEW"))
	assert.False(t, JobStatusNeedsReview.IsCompleted())
}

// Proceeding at the gate resolves to true (upload anyway).
func TestJob_GateResolution_Proceed(t *testing.T) {
	job := newASCMHLTestJob(t)
	job.ResolveGate(true)
	assert.True(t, job.AwaitGateResolution())
}

// Stopping at the gate resolves to false.
func TestJob_GateResolution_StopViaResolveFalse(t *testing.T) {
	job := newASCMHLTestJob(t)
	job.ResolveGate(false)
	assert.False(t, job.AwaitGateResolution())
}

// A cancel while parked at the gate resolves to false without an explicit decision.
func TestJob_GateResolution_StopViaCancel(t *testing.T) {
	job := newASCMHLTestJob(t)
	job.CancelFunc(errors.New("cancelled"))
	assert.False(t, job.AwaitGateResolution())
}

// TryResolveGate claims the NEEDS_REVIEW decision exactly once: a second resolve
// is rejected even while the status is still NEEDS_REVIEW (the winning goroutine
// has not transitioned it yet). This is what stops a GUI proceed and a CLI stop
// from both winning.
func TestJob_TryResolveGate_SingleWinner(t *testing.T) {
	job := newASCMHLTestJob(t)
	job.SetStatus(JobStatusNeedsReview)

	assert.True(t, job.TryResolveGate(true))
	assert.False(t, job.TryResolveGate(false))
	assert.True(t, job.AwaitGateResolution())
}

// An unreadable manifest produces problems with nothing listed. The event payload
// must still be sent (so the gate dialog and jobs-table mark have data), not
// suppressed by the listed==0 guard.
func TestJob_ASCMHLEventData_ProblemsWithoutListed(t *testing.T) {
	job := newASCMHLTestJob(t)
	job.SetASCMHLResult(0, 0, 1, "")
	job.SetASCMHLFailures([]string{"ascmhl/0001_x.mhl (manifest unreadable)"})

	data := job.ASCMHLEventData()
	require.NotNil(t, data)
	assert.Equal(t, int32(1), data.Problems)
	assert.Equal(t, int32(0), data.Listed)
	assert.Equal(t, []string{"ascmhl/0001_x.mhl (manifest unreadable)"}, data.Failures)
}

// A job with no manifest and no problems carries no ASC MHL payload at all.
func TestJob_ASCMHLEventData_NilWhenEmpty(t *testing.T) {
	job := newASCMHLTestJob(t)
	assert.Nil(t, job.ASCMHLEventData())
}

// The retained failure list is capped so it does not ride unbounded on every
// event; Problems still carries the true total.
func TestJob_SetASCMHLFailures_Capped(t *testing.T) {
	job := newASCMHLTestJob(t)
	many := make([]string, maxGateFailures+150)
	for i := range many {
		many[i] = fmt.Sprintf("file%d (hash mismatch)", i)
	}
	job.SetASCMHLFailures(many)
	assert.Len(t, job.ASCMHLFailures(), maxGateFailures)
}
