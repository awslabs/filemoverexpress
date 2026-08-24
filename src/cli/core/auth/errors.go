package auth

import "errors"

// ErrOIDCNotAuthenticated is returned when an operation requires an authenticated
// OIDC session but none exists for the requested profile.
var ErrOIDCNotAuthenticated = errors.New("OIDC session not authenticated")
