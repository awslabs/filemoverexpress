package service

import (
    "context"
    "errors"

    "connectrpc.com/connect"

    "github.com/awslabs/filemoverexpress/globals"
    "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func (*FileMoverServer) SetConfiguration(
    _ context.Context,
    req *connect.Request[fmev1.FmeConfig],
) (*connect.Response[fmev1.SetConfigurationResponse], error) {
    cfg := globals.GetInstance().GetCfg()
    allowConfigEdit := cfg.APIServer.Permissions.AllowUIConfiguration
    if !isLocalClient(req.Peer()) && !allowConfigEdit {
        return connect.NewResponse(&fmev1.SetConfigurationResponse{
            Success: false,
            Message: strConfigurationDisabled,
        }), connect.NewError(connect.CodeResourceExhausted, errors.New(strUnableToWriteConfig))
    }

    err := cfg.GRPCUpdate(req.Msg)
    if err != nil {
        return connect.NewResponse(&fmev1.SetConfigurationResponse{
            Success: false,
            Message: strUnableToWriteConfig,
        }), connect.NewError(connect.CodeInternal, errors.New(strUnableToWriteConfig))
    }

    return connect.NewResponse(&fmev1.SetConfigurationResponse{
        Success: true,
        Message: strSuccessFullyUpdatedConfig,
    }), nil
}
