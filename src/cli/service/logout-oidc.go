package service

import (
	"context"

	"connectrpc.com/connect"

	fmev1 "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func (*FileMoverServer) LogoutOIDC(
	_ context.Context,
	req *connect.Request[fmev1.OIDCLogoutRequest],
) (*connect.Response[fmev1.OIDCLogoutResponse], error) {
	if oidcProvider == nil {
		return nil, connect.NewError(connect.CodeInternal, errOIDCNotInitialized)
	}

	profileName := req.Msg.TransferProfile
	if err := oidcProvider.Logout(profileName); err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&fmev1.OIDCLogoutResponse{}), nil
}
