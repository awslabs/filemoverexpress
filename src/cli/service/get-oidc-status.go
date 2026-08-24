package service

import (
	"context"

	"connectrpc.com/connect"

	"github.com/awslabs/filemoverexpress/core/auth"
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
	cfg := getOIDCConfigForProfile(profileName)
	status := oidcProvider.GetStatus(profileName, cfg)

	return connect.NewResponse(&fmev1.OIDCStatusResponse{
		Authenticated: status.Authenticated,
		Identity:      status.Identity,
		ExpiresAt:     status.ExpiresAt,
		Error:         status.LastError,
	}), nil
}

// getOIDCConfigForProfile returns the OIDC config for a profile, or nil if not available.
func getOIDCConfigForProfile(profileName string) *auth.OIDCConfig {
	tp, err := getOIDCTransferProfile(profileName)
	if err != nil {
		return nil
	}
	return &auth.OIDCConfig{
		IssuerURL:              tp.OIDCConfig.IssuerURL,
		ClientID:               tp.OIDCConfig.ClientID,
		RoleARN:                tp.OIDCConfig.RoleARN,
		Scopes:                 tp.OIDCConfig.Scopes,
		PersistSession:         tp.OIDCConfig.PersistSession,
		CustomCABundle:         tp.OIDCConfig.CustomCABundle,
		SessionDurationSeconds: tp.OIDCConfig.SessionDurationSeconds,
	}
}
