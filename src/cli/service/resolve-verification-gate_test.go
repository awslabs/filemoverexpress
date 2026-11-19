package service

import (
	"context"
	"testing"

	"connectrpc.com/connect"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/awslabs/filemoverexpress/core/job_manager"
	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
	"github.com/awslabs/filemoverexpress/types/transfertypes"
)

func newGateTestJob(t *testing.T) *jobmanagertypes.Job {
	t.Helper()
	job, err := jobmanagertypes.NewJob(jobmanagertypes.JobConfig{
		Name:      "gate-job",
		Direction: transfertypes.Upload,
		TransferProfile: &configtypes.TransferProfile{
			Name:         "gate-profile",
			Bucket:       "test-bucket",
			Region:       "us-west-2",
			Profile:      "gate-profile",
			StorageClass: "standard",
		},
	})
	require.NoError(t, err)
	require.NoError(t, job_manager.GetInstance().AddJob(job))
	return job
}

func TestResolveVerificationGate_UnknownJob(t *testing.T) {
	srv := &FileMoverServer{}
	resp, err := srv.ResolveVerificationGate(context.Background(),
		connect.NewRequest(&fmev1.ResolveVerificationGateRequest{JobId: "does-not-exist", Proceed: true}))
	assert.Error(t, err)
	assert.False(t, resp.Msg.Success)
}

func TestResolveVerificationGate_NotAwaitingReview(t *testing.T) {
	job := newGateTestJob(t)
	srv := &FileMoverServer{}
	// Job is CREATED, not NEEDS_REVIEW.
	resp, err := srv.ResolveVerificationGate(context.Background(),
		connect.NewRequest(&fmev1.ResolveVerificationGateRequest{JobId: job.JobId(), Proceed: true}))
	assert.Error(t, err)
	assert.False(t, resp.Msg.Success)
}

func TestResolveVerificationGate_Proceed(t *testing.T) {
	job := newGateTestJob(t)
	job.SetStatus(jobmanagertypes.JobStatusNeedsReview)
	srv := &FileMoverServer{}

	resp, err := srv.ResolveVerificationGate(context.Background(),
		connect.NewRequest(&fmev1.ResolveVerificationGateRequest{JobId: job.JobId(), Proceed: true}))

	require.NoError(t, err)
	assert.True(t, resp.Msg.Success)
	// The parked goroutine would receive the proceed decision.
	assert.True(t, job.AwaitGateResolution())
}

func TestResolveVerificationGate_Stop(t *testing.T) {
	job := newGateTestJob(t)
	job.SetStatus(jobmanagertypes.JobStatusNeedsReview)
	srv := &FileMoverServer{}

	resp, err := srv.ResolveVerificationGate(context.Background(),
		connect.NewRequest(&fmev1.ResolveVerificationGateRequest{JobId: job.JobId(), Proceed: false}))

	require.NoError(t, err)
	assert.True(t, resp.Msg.Success)
	assert.Equal(t, jobmanagertypes.JobStatusCancelled, job.Status())
}
