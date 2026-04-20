package service

import (
	"context"
	"errors"
	"runtime"

	"connectrpc.com/connect"

	"github.com/awslabs/filemoverexpress/core/download"
	"github.com/awslabs/filemoverexpress/globals"
	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/types/pbtypes/s3_shared/v1"
	transfer "github.com/awslabs/filemoverexpress/types/transfertypes"
	"github.com/awslabs/filemoverexpress/utils/fs"
)

func (*FileMoverServer) DownloadPrefixes(
	_ context.Context,
	req *connect.Request[s3_sharedv1.DownloadPrefixesRequest],
) (*connect.Response[s3_sharedv1.DownloadPrefixesResponse], error) {
	var (
		destination        string
		err                error
		transferProfile    configtypes.TransferProfile
		force              = req.Msg.Force
		jobName            = req.Msg.JobName
		s3CurrentDirectory = req.Msg.S3CurrentDirectory
		sources            = req.Msg.Prefixes
	)
	if runtime.GOOS == "windows" {
		destination, err = fs.ConvertPathToWindows(req.Msg.Destination)
		if err != nil {
			return nil, connect.NewError(connect.CodeInvalidArgument, err)
		}
	} else {
		destination = req.Msg.Destination
	}

	if destination == "" {
		resp := s3_sharedv1.DownloadPrefixesResponse{
			StatusCode: s3_sharedv1.S3DownloadPathStatusCode_S3_DOWNLOAD_PATH_STATUS_CODE_QUEUED_DOWNLOAD_FAILURE,
		}
		return connect.NewResponse(&resp), connect.NewError(connect.CodeInvalidArgument, errors.New(strDestinationMayNotBeEmpty))
	}

	transferProfile, err = globals.GetInstance().GetCfg().GetTransferProfile(req.Msg.GetTransferProfile())
	if err != nil {
		resp := s3_sharedv1.DownloadPrefixesResponse{
			StatusCode: s3_sharedv1.S3DownloadPathStatusCode_S3_DOWNLOAD_PATH_STATUS_CODE_QUEUED_DOWNLOAD_FAILURE,
		}
		return connect.NewResponse(&resp), connect.NewError(connect.CodeInvalidArgument, errors.New(strFailedToFindTransferProfile))
	}
	job, err := jobmanagertypes.NewJob(jobmanagertypes.JobConfig{
		Direction:       transfer.Download,
		Name:            jobName,
		TransferProfile: &transferProfile,
		Sources:         sources,
		S3PrefixToTrim:  s3CurrentDirectory,
		Force:           force,
		Destination:     destination,
	})
	if err != nil {
		resp := s3_sharedv1.DownloadPrefixesResponse{
			StatusCode: s3_sharedv1.S3DownloadPathStatusCode_S3_DOWNLOAD_PATH_STATUS_CODE_QUEUED_DOWNLOAD_FAILURE,
		}
		return connect.NewResponse(&resp), connect.NewError(connect.CodeInvalidArgument, errors.New(strFailedToCreateJob))
	}

	go download.Downloader(job)

	return connect.NewResponse(&s3_sharedv1.DownloadPrefixesResponse{
		StatusCode: s3_sharedv1.S3DownloadPathStatusCode_S3_DOWNLOAD_PATH_STATUS_CODE_QUEUED_DOWNLOAD_SUCCESS,
		JobId:      job.JobId(),
	}), nil
}
