package service

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func (*FileMoverServer) SetConfiguration(
	_ context.Context,
	req *connect.Request[fmev1.FmeConfig],
) (*connect.Response[fmev1.SetConfigurationResponse], error) {
	cfg := config.LoadConfiguration()
	allowConfigEdit := cfg.APIServer.Permissions.AllowUIConfiguration
	if !isLocalClient(req.Peer()) && !allowConfigEdit {
		return connect.NewResponse(&fmev1.SetConfigurationResponse{
			Success: false,
			Message: strConfigurationDisabled,
		}), connect.NewError(connect.CodeResourceExhausted, errors.New(strUnableToWriteConfig))
	}

	newConfig := configtypes.FromProtobuf(req.Msg, cfg.APIServer)
	err := config.SaveConfig(&newConfig)
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
