package service

import (
	"context"
	"testing"

	"connectrpc.com/connect"
	"github.com/stretchr/testify/assert"

	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

// Pausing a job parked at the pre-upload gate (NEEDS_REVIEW) must be rejected: the
// gate reads a context cancel as "stop", so a pause would strand the job with no
// terminal event and a resume that re-queues nothing. Regression for the
// pause-at-gate strand.
func TestPauseJob_RejectsNeedsReview(t *testing.T) {
	job := newGateTestJob(t)
	job.SetStatus(jobmanagertypes.JobStatusNeedsReview)

	srv := &FileMoverServer{}
	resp, err := srv.PauseJob(context.Background(),
		connect.NewRequest(&fmev1.PauseJobRequest{JobId: job.JobId()}))

	assert.Error(t, err)
	assert.False(t, resp.Msg.Success)
	// Still parked at the gate, not flipped to PAUSED.
	assert.Equal(t, jobmanagertypes.JobStatusNeedsReview, job.Status())
}
