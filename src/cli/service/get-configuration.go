package service

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/core/auth/staticcreds"
	fmev1 "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func (*FileMoverServer) GetConfiguration(
	_ context.Context,
	req *connect.Request[fmev1.GetConfigurationRequest],
) (*connect.Response[fmev1.GRPCFmeConfig], error) {
	cfg := config.LoadConfiguration()
	allowConfigEdit := cfg.APIServer.Permissions.AllowUIConfiguration
	if !isLocalClient(req.Peer()) && !allowConfigEdit {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New(strConfigurationDisabled))
	}

	grpcCfg := cfg.ToGRPCProtobuf()
	stampAccessKeyInfo(grpcCfg)

	return connect.NewResponse(grpcCfg), nil
}

// stampAccessKeyInfo fills the read-only access-key fields on each access-key profile from the
// credentials manager - the ONLY component allowed to read the stored values. It sets
// has_secret_access_key (so the GUI can render a "secret is set" state) and OVERWRITES access_key_id
// with a MASKED form (e.g. AKIA****F3LH). This guarantees the GetConfiguration response never
// carries the full access key id: the masking happens server-side inside the manager, not on the
// client, and the full id lives only in the manager's encrypted store.
func stampAccessKeyInfo(grpcCfg *fmev1.GRPCFmeConfig) {
	if grpcCfg.Protocols == nil || grpcCfg.Protocols.S3 == nil {
		return
	}
	mgr := staticcreds.NewManager()
	for name, profile := range grpcCfg.Protocols.S3.TransferProfiles {
		if profile.AuthMethod == fmev1.AuthMethod_AUTH_METHOD_ACCESS_KEY {
			profile.HasSecretAccessKey = mgr.Has(name)
			// Replace whatever ToGRPCProtobuf produced (which could be a stale full id from an
			// older config) with the manager's masked value. Never send the full id over RPC.
			profile.AccessKeyId = mgr.MaskedAccessKeyID(name)
		}
	}
}
