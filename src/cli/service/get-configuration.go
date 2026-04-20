package service

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	"github.com/awslabs/filemoverexpress/globals"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func (*FileMoverServer) GetConfiguration(
	_ context.Context,
	req *connect.Request[fmev1.GetConfigurationRequest],
) (*connect.Response[fmev1.FmeConfig], error) {
	cfg := globals.GetInstance().GetCfg()
	allowConfigEdit := cfg.APIServer.Permissions.AllowUIConfiguration
	if !isLocalClient(req.Peer()) && !allowConfigEdit {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New(strConfigurationDisabled))
	}

	return connect.NewResponse(cfg.ToProtobuf()), nil
}
