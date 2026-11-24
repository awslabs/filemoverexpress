package service

import (
	"context"
	"testing"

	"connectrpc.com/connect"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/awslabs/filemoverexpress/core/job_manager"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

// A job parked at the pre-upload gate (NEEDS_REVIEW) has only skipped tasks
// registered - filtered files like .DS_Store, recorded via AddSkippedTasks, which
// never WaitGroup.Add. Cancelling such a job must NOT call WaitGroup.Done on them
// (that panics with a negative counter). Regression for the gate-cancel panic.
func TestCancelJob_SkippedTaskAtGate_NoPanic(t *testing.T) {
	job := newGateTestJob(t)
	jm := job_manager.GetInstance()

	task, err := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
		JobId:     job.JobId(),
		LocalFile: jobmanagertypes.LocalFile{Path: "/tmp/.DS_Store"},
	})
	require.NoError(t, err)
	task.SetStatus(jobmanagertypes.TaskStatusSkipped)
	jm.AddSkippedTasks([]*jobmanagertypes.Task{task}, job)
	job.SetStatus(jobmanagertypes.JobStatusNeedsReview)

	srv := &FileMoverServer{}
	resp, err := srv.CancelJob(context.Background(),
		connect.NewRequest(&fmev1.CancelJobRequest{JobId: job.JobId()}))

	require.NoError(t, err)
	assert.True(t, resp.Msg.Success)
	assert.Equal(t, jobmanagertypes.JobStatusCancelled, job.Status())
	// The skipped task is left skipped (it was never queued), not cancelled.
	assert.Equal(t, jobmanagertypes.TaskStatusSkipped, task.Status())
}
