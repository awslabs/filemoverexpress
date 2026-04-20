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
	job.SetStatus(jobmanagertypes.JobStatusInProgress)
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
