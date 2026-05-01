package service

import (
	"context"
	"errors"
	"fmt"

	"connectrpc.com/connect"

	"github.com/awslabs/filemoverexpress/core/download"
	"github.com/awslabs/filemoverexpress/core/job_manager"
	"github.com/awslabs/filemoverexpress/core/upload"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
	"github.com/awslabs/filemoverexpress/types/transfertypes"
)

func (*FileMoverServer) ResubmitJob(
	_ context.Context,
	req *connect.Request[fmev1.ResubmitJobRequest],
) (*connect.Response[fmev1.ResubmitJobResponse], error) {
	jobId := req.Msg.JobId
	jm := job_manager.GetInstance()
	job := jm.GetJob(jobId)
	if job == nil {
		return connect.NewResponse(&fmev1.ResubmitJobResponse{
			Success: false,
			JobId:   jobId,
		}), connect.NewError(connect.CodeInvalidArgument, fmt.Errorf(strJobDoesNotExist, jobId))
	}
	jobStatus := job.Status()
	if jobStatus != jobmanagertypes.JobStatusCompleted &&
		jobStatus != jobmanagertypes.JobStatusCancelled &&
		jobStatus != jobmanagertypes.JobStatusError {
		return connect.NewResponse(&fmev1.ResubmitJobResponse{
			Success: false,
			JobId:   jobId,
		}), connect.NewError(connect.CodeInvalidArgument, fmt.Errorf(strUnableToResubmitJob, jobId, jobStatus))
	}
	transferProfile := job.TransferProfile()
	newJob, err := jobmanagertypes.NewJob(jobmanagertypes.JobConfig{
		Direction:       job.Direction(),
		Name:            job.Name(),
		TransferProfile: &transferProfile,
		Sources:         job.Sources(),
		S3PrefixToTrim:  job.S3PrefixToTrim(),
		Force:           job.Force(),
		UploadBasePath:  job.UploadBasePath(),
		Destination:     job.Destination(),
	})
	if err != nil {
		return connect.NewResponse(&fmev1.ResubmitJobResponse{
			Success: false,
			JobId:   jobId,
		}), connect.NewError(connect.CodeInvalidArgument, errors.New(strFailedToCreateJob))
	}

	if job.Direction() == transfertypes.Upload {
		upload.Uploader(newJob)
	} else {
		download.Downloader(newJob)
	}

	return connect.NewResponse(&fmev1.ResubmitJobResponse{
		Success: true,
		JobId:   jobId,
	}), nil
}
