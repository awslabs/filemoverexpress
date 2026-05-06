package service

import (
	"context"
	"fmt"

	"connectrpc.com/connect"

	"github.com/awslabs/filemoverexpress/core/job_manager"
	"github.com/awslabs/filemoverexpress/events"
	fmeErrors "github.com/awslabs/filemoverexpress/fme-errors"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func (*FileMoverServer) CancelJob(
	_ context.Context,
	req *connect.Request[fmev1.CancelJobRequest],
) (*connect.Response[fmev1.CancelJobResponse], error) {
	jobId := req.Msg.JobId
	jm := job_manager.GetInstance()
	job := jm.GetJob(jobId)
	if job == nil {
		return connect.NewResponse(&fmev1.CancelJobResponse{
			Success: false,
			JobId:   jobId,
		}), connect.NewError(connect.CodeInvalidArgument, fmt.Errorf(strJobDoesNotExist, jobId))
	}
	if job.Status() == jobmanagertypes.JobStatusCompleted || job.Status() == jobmanagertypes.JobStatusCancelled {
		return connect.NewResponse(&fmev1.CancelJobResponse{
			Success: false,
			JobId:   jobId,
		}), connect.NewError(connect.CodeInvalidArgument, fmt.Errorf(strUnableToCancelJob, jobId))
	}
	job.SetStatus(jobmanagertypes.JobStatusCancelled)
	taskMap := jm.GetTasks(jobId)
	for _, task := range taskMap {
		status := task.Status()
		if status == jobmanagertypes.TaskStatusError || status == jobmanagertypes.TaskStatusCompleted {
			continue
		}
		// In-progress tasks are owned by the transfer worker: it will finish them
		// (and call Done) once it observes the cancelled context. For tasks that
		// haven't started, the cancel path owns the Done. MarkFinished guarantees
		// the Done fires exactly once even if a worker is picking the task up right
		// now — preventing the negative-WaitGroup-counter panic.
		if status != jobmanagertypes.TaskStatusInProgress && task.MarkFinished() {
			job.WaitGroup.Done()
		}
		task.SetStatus(jobmanagertypes.TaskStatusCancelled)
	}
	job.CancelFunc(fmeErrors.ErrJobCancelled)
	events.Events.Info("Cancelled job %s", job.Name())

	return connect.NewResponse(&fmev1.CancelJobResponse{
		Success: true,
		JobId:   jobId,
	}), nil
}
