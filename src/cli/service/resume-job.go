package service

import (
	"context"
	"fmt"

	"connectrpc.com/connect"

	"github.com/awslabs/filemoverexpress/core/job_manager"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func (*FileMoverServer) ResumeJob(
	_ context.Context,
	req *connect.Request[fmev1.ResumeJobRequest],
) (*connect.Response[fmev1.ResumeJobResponse], error) {
	jobId := req.Msg.JobId
	jm := job_manager.GetInstance()
	job := jm.GetJob(jobId)
	if job == nil {
		return connect.NewResponse(&fmev1.ResumeJobResponse{
			Success: false,
			JobId:   jobId,
		}), connect.NewError(connect.CodeInvalidArgument, fmt.Errorf(strJobDoesNotExist, jobId))
	}
	if job.Status() != jobmanagertypes.JobStatusPaused {
		return connect.NewResponse(&fmev1.ResumeJobResponse{
			Success: false,
			JobId:   jobId,
		}), connect.NewError(connect.CodeInvalidArgument, fmt.Errorf(strUnableToResumeJob, jobId))
	}
	newCtx, newCancelFunc := context.WithCancelCause(context.Background())
	job.CancelCtx = newCtx
	job.CancelFunc = newCancelFunc
	// SetStatus(InProgress) re-stamps TimestampTransferring to time.Now(); preserve
	// the original transfer-start time across resume so the elapsed-time clock (and
	// any throughput/ETA derived from it) doesn't reset on every pause-resume cycle.
	// Note: SetStatus also fires SendJobStatusChange asynchronously with the just-set
	// now(), so a consumer reading TimestampTransferring in the brief window before the
	// restore below could observe the reset value. This is cosmetic — elapsed/ETA are
	// read on a much slower cadence — so we accept the write-then-restore here rather
	// than add a status-set variant that bypasses the shared broadcast path.
	startedAt := job.GetTimestampTransferring()
	job.SetStatus(jobmanagertypes.JobStatusInProgress)
	if !startedAt.IsZero() {
		job.SetTimestampTransferring(startedAt)
	}
	taskMap := jm.GetTasks(jobId)
	for _, task := range taskMap {
		taskStatus := task.Status()
		if taskStatus == jobmanagertypes.TaskStatusPaused {
			task.SetStatus(jobmanagertypes.TaskStatusQueued)
		}
	}

	return connect.NewResponse(&fmev1.ResumeJobResponse{
		Success: true,
		JobId:   jobId,
	}), nil
}
