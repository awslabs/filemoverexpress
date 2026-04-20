package service

import (
	"context"
	"fmt"

	"connectrpc.com/connect"

	"github.com/awslabs/filemoverexpress/core/job_manager"
	fmeErrors "github.com/awslabs/filemoverexpress/fme-errors"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func (*FileMoverServer) PauseJob(
	_ context.Context,
	req *connect.Request[fmev1.PauseJobRequest],
) (*connect.Response[fmev1.PauseJobResponse], error) {
	jobId := req.Msg.JobId
	jm := job_manager.GetInstance()
	job := jm.GetJob(jobId)
	if job == nil {
		return connect.NewResponse(&fmev1.PauseJobResponse{
			Success: false,
			JobId:   jobId,
		}), connect.NewError(connect.CodeInvalidArgument, fmt.Errorf(strJobDoesNotExist, jobId))
	}
	jobStatus := job.Status()
	if jobStatus == jobmanagertypes.JobStatusCompleted ||
		jobStatus == jobmanagertypes.JobStatusPaused ||
		jobStatus == jobmanagertypes.JobStatusCancelled {
		return connect.NewResponse(&fmev1.PauseJobResponse{
			Success: false,
			JobId:   jobId,
		}), connect.NewError(connect.CodeInvalidArgument, fmt.Errorf(strUnableToPauseJob, jobId, jobStatus))
	}
	job.SetStatus(jobmanagertypes.JobStatusPaused)
	taskMap := jm.GetTasks(jobId)
	for _, task := range taskMap {
		taskStatus := task.Status()
		if taskStatus != jobmanagertypes.TaskStatusCompleted &&
			taskStatus != jobmanagertypes.TaskStatusError &&
			taskStatus != jobmanagertypes.TaskStatusCancelled {
			task.SetStatus(jobmanagertypes.TaskStatusPaused)
		}
	}
	job.CancelFunc(fmeErrors.ErrJobPaused)

	return connect.NewResponse(&fmev1.PauseJobResponse{
		Success: true,
		JobId:   jobId,
	}), nil
}
