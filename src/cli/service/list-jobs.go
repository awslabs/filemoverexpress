package service

import (
	"context"

	"connectrpc.com/connect"

	"github.com/awslabs/filemoverexpress/core/job_manager"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func (*FileMoverServer) ListJobs(
	_ context.Context,
	_ *connect.Request[fmev1.ListJobsRequest],
) (*connect.Response[fmev1.ListJobsResponse], error) {
	jm := job_manager.GetInstance()

	res := &fmev1.ListJobsResponse{
		Jobs: jm.GetJobs(),
	}

	return connect.NewResponse(res), nil
}
