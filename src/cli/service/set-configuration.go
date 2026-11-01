package service

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/core/auth/staticcreds"
	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func (*FileMoverServer) SetConfiguration(
	_ context.Context,
	req *connect.Request[fmev1.GRPCFmeConfig],
) (*connect.Response[fmev1.SetConfigurationResponse], error) {
	cfg := config.LoadConfiguration()
	allowConfigEdit := cfg.APIServer.Permissions.AllowUIConfiguration
	if !isLocalClient(req.Peer()) && !allowConfigEdit {
		return connect.NewResponse(&fmev1.SetConfigurationResponse{
			Success: false,
			Message: strConfigurationDisabled,
		}), connect.NewError(connect.CodeResourceExhausted, errors.New(strUnableToWriteConfig))
	}

	newConfig, err := configtypes.FromGRPCProtobuf(req.Msg, cfg.APIServer)
	if err != nil {
		return connect.NewResponse(&fmev1.SetConfigurationResponse{
			Success: false,
			Message: err.Error(),
		}), connect.NewError(connect.CodeInvalidArgument, err)
	}

	err = config.SaveConfig(&newConfig)
	if err != nil {
		return connect.NewResponse(&fmev1.SetConfigurationResponse{
			Success: false,
			Message: strUnableToWriteConfig,
		}), connect.NewError(connect.CodeInternal, errors.New(strUnableToWriteConfig))
	}

	// Best-effort: reclaim stored secrets for profiles that no longer use access-key auth (deleted,
	// renamed, or switched to another method). The whole-config save has no per-profile delete hook,
	// so we diff the old profile set against the new one here. Failures are logged, not fatal.
	cleanupOrphanedStaticCredentials(cfg.Protocols.S3.TransferProfiles, newConfig.Protocols.S3.TransferProfiles)

	return connect.NewResponse(&fmev1.SetConfigurationResponse{
		Success: true,
		Message: strSuccessFullyUpdatedConfig,
	}), nil
}

// cleanupOrphanedStaticCredentials deletes the encrypted secret for any profile that had access-key
// auth in the previous config but, in the new config, is gone or no longer uses access-key auth.
func cleanupOrphanedStaticCredentials(oldProfiles, newProfiles map[string]configtypes.TransferProfile) {
	mgr := staticcreds.NewManager()
	for name, oldProfile := range oldProfiles {
		if oldProfile.AuthMethod != configtypes.AuthMethodAccessKey {
			continue
		}
		newProfile, stillPresent := newProfiles[name]
		if stillPresent && newProfile.AuthMethod == configtypes.AuthMethodAccessKey {
			continue
		}
		if err := mgr.Delete(name); err != nil {
			logger.Warn("failed to delete orphaned static credentials for profile %q: %v", name, err)
		}
	}
}
