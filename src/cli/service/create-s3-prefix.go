package service

import (
    "context"
    "strings"

    "connectrpc.com/connect"
    "github.com/aws/aws-sdk-go-v2/service/s3"

    "github.com/awslabs/filemoverexpress/core/job_manager"
    "github.com/awslabs/filemoverexpress/globals"
    "github.com/awslabs/filemoverexpress/types/pbtypes/s3_shared/v1"
)

func (*FileMoverServer) CreateS3Prefix(
    _ context.Context,
    req *connect.Request[s3_sharedv1.CreateS3PrefixRequest],
) (*connect.Response[s3_sharedv1.CreateS3PrefixResponse], error) {
    resp := &s3_sharedv1.CreateS3PrefixResponse{
        Success: false,
        Message: "",
    }

    jm := job_manager.GetInstance()
    cfg := globals.GetInstance().GetCfg()
    txp, err := cfg.GetTransferProfile(req.Msg.GetTransferProfile())
    if err != nil {
        resp.Success = false
        resp.Message = err.Error()

        return connect.NewResponse(resp), nil
    }

    s3m, err := jm.GetS3Manager(txp.Profile, txp.Bucket, txp.Region, txp.Endpoint)
    if err != nil {
        resp.Success = false
        resp.Message = err.Error()

        return connect.NewResponse(resp), nil
    }

    var prefix = strings.TrimPrefix(req.Msg.PrefixKey, "/")
    if prefix == "" {
        resp.Success = false
        resp.Message = "Directory name cannot be empty"

        return connect.NewResponse(resp), nil
    }

    _, err = s3m.Client.PutObject(context.TODO(), &s3.PutObjectInput{
        Bucket: &txp.Bucket,
        Key:    &prefix,
        Body:   nil,
    })
    if err != nil {
        resp.Success = false
        resp.Message = err.Error()

        return connect.NewResponse(resp), nil
    }

    resp.Success = true
    resp.Message = ""

    return connect.NewResponse(resp), nil
}
