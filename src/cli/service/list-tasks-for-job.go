package service

import (
    "context"

    "connectrpc.com/connect"

    "github.com/awslabs/filemoverexpress/core/job_manager"
    "github.com/awslabs/filemoverexpress/logger"
    pbtypes "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func (*FileMoverServer) ListTasksForJob(
    _ context.Context,
    req *connect.Request[pbtypes.ListTasksForJobRequest],
) (*connect.Response[pbtypes.ListTasksForJobResponse], error) {
    jm := job_manager.GetInstance()
    tasks := make([]*pbtypes.Task, 0)

    for _, task := range jm.GetTasks(req.Msg.JobId) {
        tasks = append(tasks, task.ToProtobuf())
    }

    res := &pbtypes.ListTasksForJobResponse{
        Tasks: tasks,
    }

    return connect.NewResponse(res), nil
}

func (*FileMoverServer) ListTasksForJobStream(
    _ context.Context,
    req *connect.Request[pbtypes.ListTasksForJobRequest],
    clientStream *connect.ServerStream[pbtypes.Task],
) error {
    jm := job_manager.GetInstance()
    for _, task := range jm.GetTasks(req.Msg.JobId) {
        if sendErr := clientStream.Send(task.ToProtobuf()); sendErr != nil {
            logger.Debug(strGrpcSendFailed, sendErr.Error())
            return sendErr
        }
    }
    return nil
}
