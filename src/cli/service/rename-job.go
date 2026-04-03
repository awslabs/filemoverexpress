package service

import (
    "context"
    "fmt"

    "connectrpc.com/connect"

    "github.com/awslabs/filemoverexpress/core/job_manager"
    "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func (*FileMoverServer) RenameJob(
    _ context.Context,
    req *connect.Request[fmev1.RenameJobRequest],
) (*connect.Response[fmev1.RenameJobResponse], error) {
    jm := job_manager.GetInstance()
    jobId := req.Msg.JobId
    newName := req.Msg.JobName
    job := jm.GetJob(req.Msg.JobId)
    if job == nil {
        return connect.NewResponse(
            &fmev1.RenameJobResponse{
                JobId:        jobId,
                Success:      false,
                ErrorMessage: fmt.Sprintf(strJobDoesNotExist, jobId),
            },
        ), nil
    }

    job.SetName(newName)

    return connect.NewResponse(&fmev1.RenameJobResponse{
        JobId:        jobId,
        Success:      true,
        ErrorMessage: "",
    }), nil
}
