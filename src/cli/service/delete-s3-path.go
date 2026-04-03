package service

import (
    "context"

    "connectrpc.com/connect"

    transferapi "github.com/awslabs/filemoverexpress/core/transfer-api"
    "github.com/awslabs/filemoverexpress/globals"
    "github.com/awslabs/filemoverexpress/types/pbtypes/s3_shared/v1"
)

func (*FileMoverServer) DeleteS3Path(
    _ context.Context,
    req *connect.Request[s3_sharedv1.DeleteS3PathRequest],
) (*connect.Response[s3_sharedv1.DeleteS3PathResponse], error) {
    resp := &s3_sharedv1.DeleteS3PathResponse{
        Success: false,
        Message: "",
    }

    cfg := globals.GetInstance().GetCfg()

    allowRemoteRenameDelete := cfg.APIServer.Permissions.AllowRemoteRenameDelete
    if !isLocalClient(req.Peer()) && !allowRemoteRenameDelete {
        resp.Success = false
        resp.Message = strRemoteDeleteNotAllowed
        return connect.NewResponse(resp), nil
    }

    txp, err := cfg.GetTransferProfile(req.Msg.TransferProfile)
    if err != nil {
        resp.Success = false
        resp.Message = err.Error()
        return connect.NewResponse(resp), nil
    }

    s3m, err := transferapi.NewS3Manager(transferapi.S3ManagerConfig{
        AwsProfile: txp.Profile,
        Bucket:     txp.Bucket,
        Region:     txp.Region,
        Endpoint:   txp.Endpoint,
    })
    if err != nil {
        resp.Success = false
        resp.Message = err.Error()
        return connect.NewResponse(resp), nil
    }

    err = s3m.DeletePrefix(req.Msg.PathToDelete)
    if err != nil {
        resp.Success = false
        resp.Message = err.Error()
        return connect.NewResponse(resp), nil
    }

    resp.Success = true
    resp.Message = ""
    return connect.NewResponse(resp), nil
}
