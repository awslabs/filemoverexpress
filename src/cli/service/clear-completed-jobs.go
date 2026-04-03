package service

import (
    "context"

    "connectrpc.com/connect"

    "github.com/awslabs/filemoverexpress/core/job_manager"
    "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func (*FileMoverServer) ClearCompletedJobs(_ context.Context, _ *connect.Request[fmev1.ClearCompletedJobsRequest]) (
    *connect.Response[fmev1.ClearCompletedJobsResponse], error,
) {
    jm := job_manager.GetInstance()

    jobIds := jm.ClearCompletedJobs()

    resp := &fmev1.ClearCompletedJobsResponse{
        Success:       true,
        ClearedJobIds: jobIds,
    }
    return connect.NewResponse[fmev1.ClearCompletedJobsResponse](resp), nil
}

func (*FileMoverServer) ClearCompletedJob(_ context.Context, req *connect.Request[fmev1.ClearCompletedJobRequest]) (
    *connect.Response[fmev1.ClearCompletedJobsResponse], error,
) {
    jm := job_manager.GetInstance()

    if err := jm.ClearCompletedJob(req.Msg.JobId); err != nil {
        return nil, connect.NewError(connect.CodeNotFound, err)
    }

    resp := &fmev1.ClearCompletedJobsResponse{
        Success:       true,
        ClearedJobIds: []string{req.Msg.JobId},
    }
    return connect.NewResponse[fmev1.ClearCompletedJobsResponse](resp), nil
}
