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

// ResolveVerificationGate resolves a job paused in NEEDS_REVIEW because a supplied
// ASC MHL manifest failed verification. proceed=true uploads anyway (the job
// finishes with warnings); proceed=false stops and cancels the job without
// uploading. Only valid while the job is in NEEDS_REVIEW.
func (*FileMoverServer) ResolveVerificationGate(
	_ context.Context,
	req *connect.Request[fmev1.ResolveVerificationGateRequest],
) (*connect.Response[fmev1.ResolveVerificationGateResponse], error) {
	jobId := req.Msg.JobId
	jm := job_manager.GetInstance()
	job := jm.GetJob(jobId)
	if job == nil {
		return connect.NewResponse(&fmev1.ResolveVerificationGateResponse{
			Success: false,
			JobId:   jobId,
		}), connect.NewError(connect.CodeInvalidArgument, fmt.Errorf(strJobDoesNotExist, jobId))
	}
	if !job.TryResolveGate(req.Msg.Proceed) {
		return connect.NewResponse(&fmev1.ResolveVerificationGateResponse{
			Success: false,
			JobId:   jobId,
		}), connect.NewError(connect.CodeInvalidArgument, fmt.Errorf(strJobNotAwaitingReview, jobId))
	}

	if req.Msg.Proceed {
		// The claim is delivered; the parked UploadJob goroutine continues into the
		// transfer, logs the override, and the job finishes COMPLETED_WITH_WARNINGS.
		events.Events.Info("Resuming job %s after ASC MHL review (upload anyway)", job.Name())
	} else {
		// Stop: cancel the job. No transfer tasks have been queued yet at the gate,
		// so there is no WaitGroup to unwind. The claim already unblocked the waiter.
		job.SetStatus(jobmanagertypes.JobStatusCancelled)
		job.CancelFunc(fmeErrors.ErrJobCancelled)
		events.Events.Info("Stopped job %s after ASC MHL review", job.Name())
	}

	return connect.NewResponse(&fmev1.ResolveVerificationGateResponse{
		Success: true,
		JobId:   jobId,
	}), nil
}
