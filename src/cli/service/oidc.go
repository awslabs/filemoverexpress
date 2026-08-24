package service

import (
	"errors"

	"github.com/awslabs/filemoverexpress/core/auth"
)

var (
	// oidcProvider holds the package-level OIDC provider for RPC handlers.
	oidcProvider          *auth.OIDCProvider
	errOIDCNotInitialized = errors.New("OIDC provider not initialized")
	errProfileNotOIDC     = errors.New("transfer profile is not configured for OIDC authentication")
	errMissingOIDCConfig  = errors.New("transfer profile has OIDC auth method but missing oidc_config")
)

// SetOIDCProvider sets the OIDC provider used by the service RPC handlers.
func SetOIDCProvider(provider *auth.OIDCProvider) {
	oidcProvider = provider
}
