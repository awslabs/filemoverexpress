package service

import (
	"context"
	"errors"
	"fmt"

	"connectrpc.com/connect"

	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/core/auth/staticcreds"
	transferapi "github.com/awslabs/filemoverexpress/core/transfer-api"
	fmev1 "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

var (
	errCredsEditNotAllowed = errors.New("credential editing is not permitted for remote clients")
	errCredsMissingFields  = errors.New("transfer_profile, access_key_id and secret_access_key are required")
	errCredsTestFields     = errors.New("access_key_id, secret_access_key, bucket and region are required")
)

// credEditAllowed authorizes every credential-writing RPC (Create/Update/Delete/TestStaticCredentials).
// Access-key auth is deliberately LOOPBACK-ONLY: a remote daemon does not support API keys. The
// credential store is a single shared store with no per-user profile access control yet (the "user A
// may see profiles 1,2,3 but user B only 2,3" model is future work), so exposing credential edits
// over a remote listener would let any authorized remote caller read or tamper with another user's
// stored keys. Until per-user controls exist, only a loopback client may touch stored credentials;
// the AllowUIConfiguration toggle (which still gates non-secret SetConfiguration) does not widen this.
func credEditAllowed(peer connect.Peer) bool {
	return isLocalClient(peer)
}

// CreateStaticCredentials validates the supplied access key (fail closed) and stores it encrypted.
func (*FileMoverServer) CreateStaticCredentials(
	_ context.Context,
	req *connect.Request[fmev1.CreateStaticCredentialsRequest],
) (*connect.Response[fmev1.StaticCredentialsResponse], error) {
	if !credEditAllowed(req.Peer()) {
		return nil, connect.NewError(connect.CodePermissionDenied, errCredsEditNotAllowed)
	}
	msg := req.Msg
	if msg.TransferProfile == "" || msg.AccessKeyId == "" || msg.SecretAccessKey == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errCredsMissingFields)
	}

	// Fail closed: when connection context is supplied, the credentials must actually work before
	// we persist them. The GUI always sends bucket+region, so a bad key never reaches the store.
	if msg.Bucket != "" && msg.Region != "" {
		testInput := transferapi.StaticCredentialsTestInput{
			AccessKeyID:     msg.AccessKeyId,
			SecretAccessKey: msg.SecretAccessKey,
			SessionToken:    msg.SessionToken,
			Bucket:          msg.Bucket,
			Region:          msg.Region,
			Endpoint:        msg.Endpoint,
		}
		if err := transferapi.TestStaticCredentials(testInput); err != nil {
			return connect.NewResponse(&fmev1.StaticCredentialsResponse{
				Success: false,
				Message: "credential validation failed: " + err.Error(),
			}), connect.NewError(connect.CodeFailedPrecondition, err)
		}
	}

	if err := staticcreds.NewManager().Create(msg.TransferProfile, staticcreds.StaticCredentials{
		AccessKeyID:     msg.AccessKeyId,
		SecretAccessKey: msg.SecretAccessKey,
		SessionToken:    msg.SessionToken,
	}); err != nil {
		return connect.NewResponse(&fmev1.StaticCredentialsResponse{
			Success: false,
			Message: err.Error(),
		}), connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&fmev1.StaticCredentialsResponse{Success: true}), nil
}

// UpdateStaticCredentials replaces the stored secret for an existing access-key profile.
func (*FileMoverServer) UpdateStaticCredentials(
	_ context.Context,
	req *connect.Request[fmev1.UpdateStaticCredentialsRequest],
) (*connect.Response[fmev1.StaticCredentialsResponse], error) {
	if !credEditAllowed(req.Peer()) {
		return nil, connect.NewError(connect.CodePermissionDenied, errCredsEditNotAllowed)
	}
	msg := req.Msg
	if msg.TransferProfile == "" || msg.AccessKeyId == "" || msg.SecretAccessKey == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errCredsMissingFields)
	}

	if err := staticcreds.NewManager().Update(msg.TransferProfile, staticcreds.StaticCredentials{
		AccessKeyID:     msg.AccessKeyId,
		SecretAccessKey: msg.SecretAccessKey,
		SessionToken:    msg.SessionToken,
	}); err != nil {
		return connect.NewResponse(&fmev1.StaticCredentialsResponse{
			Success: false,
			Message: err.Error(),
		}), connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&fmev1.StaticCredentialsResponse{Success: true}), nil
}

// DeleteStaticCredentials removes a profile's stored secret (on switch-away or explicit delete).
func (*FileMoverServer) DeleteStaticCredentials(
	_ context.Context,
	req *connect.Request[fmev1.DeleteStaticCredentialsRequest],
) (*connect.Response[fmev1.StaticCredentialsResponse], error) {
	if !credEditAllowed(req.Peer()) {
		return nil, connect.NewError(connect.CodePermissionDenied, errCredsEditNotAllowed)
	}
	if req.Msg.TransferProfile == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errCredsMissingFields)
	}

	if err := staticcreds.NewManager().Delete(req.Msg.TransferProfile); err != nil {
		return connect.NewResponse(&fmev1.StaticCredentialsResponse{
			Success: false,
			Message: err.Error(),
		}), connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&fmev1.StaticCredentialsResponse{Success: true}), nil
}

// TestStaticCredentials validates credentials and returns pass/fail without storing anything. It
// works two ways: with a typed secret (pre-save check on add/replace), using the caller-supplied
// bucket/region/endpoint; or — when secret_access_key is empty but transfer_profile is set — by
// vending the profile's already-stored secret, so an existing access-key profile can be re-tested
// without the user re-entering a secret they can't see. See resolveTestCredentials for the security
// reason the stored-secret path ignores caller-supplied connection context.
func (*FileMoverServer) TestStaticCredentials(
	_ context.Context,
	req *connect.Request[fmev1.TestStaticCredentialsRequest],
) (*connect.Response[fmev1.TestStaticCredentialsResponse], error) {
	if !credEditAllowed(req.Peer()) {
		return nil, connect.NewError(connect.CodePermissionDenied, errCredsEditNotAllowed)
	}

	testInput, err := resolveTestCredentials(req.Msg)
	if err != nil {
		if errors.Is(err, errCredsTestFields) {
			return nil, connect.NewError(connect.CodeInvalidArgument, errCredsTestFields)
		}
		// Could-not-resolve (no stored credentials, no such profile): report as a failed test.
		return connect.NewResponse(&fmev1.TestStaticCredentialsResponse{Ok: false, Error: err.Error()}), nil
	}

	if err := transferapi.TestStaticCredentials(testInput); err != nil {
		return connect.NewResponse(&fmev1.TestStaticCredentialsResponse{Ok: false, Error: err.Error()}), nil
	}

	return connect.NewResponse(&fmev1.TestStaticCredentialsResponse{Ok: true}), nil
}

// resolveTestCredentials builds the credentials + connection context to test. With a typed secret
// it uses the caller-supplied values. With an empty secret it vends the profile's stored secret AND
// uses the profile's OWN persisted bucket/region/endpoint, deliberately ignoring any caller-supplied
// connection context: otherwise an authorized-but-untrusted local caller could point endpoint at an
// attacker-controlled server and have the daemon sign a SigV4 request with the victim profile's real
// keys, leaking the access key id in the Authorization header. Returns errCredsTestFields for
// invalid arguments; other errors mean the stored secret or profile could not be resolved.
func resolveTestCredentials(msg *fmev1.TestStaticCredentialsRequest) (transferapi.StaticCredentialsTestInput, error) {
	in := transferapi.StaticCredentialsTestInput{
		AccessKeyID:     msg.AccessKeyId,
		SecretAccessKey: msg.SecretAccessKey,
		SessionToken:    msg.SessionToken,
		Bucket:          msg.Bucket,
		Region:          msg.Region,
		Endpoint:        msg.Endpoint,
	}

	if msg.SecretAccessKey == "" {
		if msg.TransferProfile == "" {
			return in, errCredsTestFields
		}
		stored, err := staticcreds.NewManager().Vend(msg.TransferProfile)
		if err != nil {
			return in, fmt.Errorf("no stored credentials to test: %w", err)
		}
		profile, err := config.LoadConfiguration().GetTransferProfile(msg.TransferProfile)
		if err != nil {
			return in, err
		}
		in.AccessKeyID = stored.AccessKeyID
		in.SecretAccessKey = stored.SecretAccessKey
		in.SessionToken = stored.SessionToken
		// Connection context comes from the profile, NOT the caller (see doc comment).
		in.Bucket = profile.Bucket
		in.Region = profile.Region
		in.Endpoint = profile.Endpoint
	} else if msg.AccessKeyId == "" {
		return in, errCredsTestFields
	}

	if in.Bucket == "" || in.Region == "" {
		return in, errCredsTestFields
	}
	return in, nil
}
