package service

import (
	"context"

	"connectrpc.com/connect"

	fmev1 "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func (*FileMoverServer) GetOIDCStatus(
	_ context.Context,
	req *connect.Request[fmev1.OIDCStatusRequest],
) (*connect.Response[fmev1.OIDCStatusResponse], error) {
	if oidcProvider == nil {
		return nil, connect.NewError(connect.CodeInternal, errOIDCNotInitialized)
	}

	profileName := req.Msg.TransferProfile
	status := oidcProvider.GetStatus(profileName)

	return connect.NewResponse(&fmev1.OIDCStatusResponse{
		Authenticated: status.Authenticated,
		Identity:      status.Identity,
		ExpiresAt:     status.ExpiresAt,
		Error:         status.LastError,
	}), nil
}
