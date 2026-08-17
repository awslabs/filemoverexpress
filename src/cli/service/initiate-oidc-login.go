package service

import (
	"context"

	"connectrpc.com/connect"

	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/core/auth"
	"github.com/awslabs/filemoverexpress/types/configtypes"
	fmev1 "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func (*FileMoverServer) InitiateOIDCLogin(
	ctx context.Context,
	req *connect.Request[fmev1.OIDCLoginRequest],
) (*connect.Response[fmev1.OIDCLoginResponse], error) {
	if oidcProvider == nil {
		return nil, connect.NewError(connect.CodeInternal, errOIDCNotInitialized)
	}

	profileName := req.Msg.TransferProfile
	tp, err := getOIDCTransferProfile(profileName)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	cfg := auth.OIDCConfig{
		IssuerURL:              tp.OIDCConfig.IssuerURL,
		ClientID:               tp.OIDCConfig.ClientID,
		RoleARN:                tp.OIDCConfig.RoleARN,
		Scopes:                 tp.OIDCConfig.Scopes,
		PersistSession:         tp.OIDCConfig.PersistSession,
		CustomCABundle:         tp.OIDCConfig.CustomCABundle,
		SessionDurationSeconds: tp.OIDCConfig.SessionDurationSeconds,
	}

	authURL, err := oidcProvider.InitiateLogin(ctx, profileName, cfg)
	if err != nil {
		return nil, connect.NewError(connect.CodeFailedPrecondition, err)
	}

	return connect.NewResponse(&fmev1.OIDCLoginResponse{
		AuthorizationUrl: authURL,
	}), nil
}

// getOIDCTransferProfile loads and validates that a profile exists and uses OIDC auth.
func getOIDCTransferProfile(profileName string) (configtypes.TransferProfile, error) {
	fmeConfig := config.LoadConfiguration()
	tp, err := fmeConfig.GetTransferProfile(profileName)
	if err != nil {
		return configtypes.TransferProfile{}, err
	}

	if tp.AuthMethod != configtypes.AuthMethodOIDC {
		return configtypes.TransferProfile{}, errProfileNotOIDC
	}

	if tp.OIDCConfig == nil {
		return configtypes.TransferProfile{}, errMissingOIDCConfig
	}

	return tp, nil
}
