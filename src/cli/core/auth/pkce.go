// Package auth provides OIDC-based AWS credential acquisition for FME.
package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
)

const (
	// codeVerifierLength is the length of the PKCE code verifier (128 chars, exceeding RFC 7636 minimum of 43).
	codeVerifierLength = 128

	// stateByteLength is the number of random bytes used to generate the state parameter (32 bytes = 64 hex chars).
	stateByteLength = 32

	// unreservedChars contains the unreserved URL-safe characters allowed in a PKCE code verifier per RFC 7636.
	unreservedChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
)

// GenerateCodeVerifier generates a cryptographically random PKCE code verifier
// of 128 characters using unreserved URL-safe characters per RFC 7636.
func GenerateCodeVerifier() (string, error) {
	bytes := make([]byte, codeVerifierLength)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("generate code verifier: %w", err)
	}

	result := make([]byte, codeVerifierLength)
	for i := range codeVerifierLength {
		result[i] = unreservedChars[bytes[i]%byte(len(unreservedChars))]
	}

	return string(result), nil
}

// GenerateCodeChallenge derives a PKCE code challenge from the given code verifier
// using the S256 method: BASE64URL(SHA256(verifier)) with no padding.
func GenerateCodeChallenge(verifier string) string {
	hash := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(hash[:])
}

// GenerateState generates a cryptographically random state parameter
// as a 64-character hex string (32 random bytes).
func GenerateState() (string, error) {
	bytes := make([]byte, stateByteLength)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("generate state: %w", err)
	}

	return hex.EncodeToString(bytes), nil
}
