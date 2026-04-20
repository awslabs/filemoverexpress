package service

import (
	"context"
	"errors"
	"runtime"

	"connectrpc.com/connect"

	"github.com/awslabs/filemoverexpress/core/upload"
	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/globals"
	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/types/pbtypes/s3_shared/v1"
	transfer "github.com/awslabs/filemoverexpress/types/transfertypes"
	"github.com/awslabs/filemoverexpress/utils/fs"
)

func (*FileMoverServer) UploadPrefixes(
	_ context.Context,
	req *connect.Request[s3_sharedv1.UploadPrefixRequest],
) (*connect.Response[s3_sharedv1.UploadPrefixResponse], error) {
	var (
		transferProfile configtypes.TransferProfile
		basePath        string
		sources         = req.Msg.Prefixes
		destination     = req.Msg.Destination
		force           = req.Msg.Force
		err             error
		jobName         = req.Msg.JobName
	)

	if runtime.GOOS == "windows" {
		basePath, err = fs.ConvertPathToWindows(req.Msg.BasePath)
		if err != nil {
			return nil, connect.NewError(connect.CodeInternal, err)
		}
	} else {
		basePath = req.Msg.BasePath
	}

	if len(sources) == 0 {
		return connect.NewResponse(&s3_sharedv1.UploadPrefixResponse{
			Success:  false,
			Response: strUploadMissingSources,
			Status:   s3_sharedv1.UploadPrefixStatusCode_UPLOAD_PREFIX_STATUS_CODE_QUEUED_UPLOAD_FAILURE,
		}), connect.NewError(connect.CodeInvalidArgument, errors.New(strUploadMissingSources))
	}

	transferProfile, err = globals.GetInstance().GetCfg().GetTransferProfile(req.Msg.GetTransferProfile())
	if err != nil {
		return connect.NewResponse(&s3_sharedv1.UploadPrefixResponse{
			Success:  false,
			Response: strUploadMissingTransferProfiles,
			Status:   s3_sharedv1.UploadPrefixStatusCode_UPLOAD_PREFIX_STATUS_CODE_QUEUED_UPLOAD_FAILURE,
		}), connect.NewError(connect.CodeInvalidArgument, errors.New(strUploadMissingTransferProfiles))
	}
	job, err := jobmanagertypes.NewJob(jobmanagertypes.JobConfig{
		Name:            jobName,
		Direction:       transfer.Upload,
		TransferProfile: &transferProfile,
		Sources:         sources,
		Destination:     destination,
		Force:           force,
		UploadBasePath:  basePath,
	})
	if err != nil {
		events.Events.Error("Error creating job: %s", err)
		return connect.NewResponse(&s3_sharedv1.UploadPrefixResponse{
			Success:  false,
			Response: strFailedToCreateJob,
			Status:   s3_sharedv1.UploadPrefixStatusCode_UPLOAD_PREFIX_STATUS_CODE_QUEUED_UPLOAD_FAILURE,
		}), connect.NewError(connect.CodeInvalidArgument, errors.New(strFailedToCreateJob))
	}

	go upload.Uploader(job)
	return connect.NewResponse(&s3_sharedv1.UploadPrefixResponse{
		Success:  true,
		Response: "",
		Status:   s3_sharedv1.UploadPrefixStatusCode_UPLOAD_PREFIX_STATUS_CODE_QUEUED_UPLOAD_SUCCESS,
		JobId:    job.JobId(),
	}), nil
}
