package auth

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGenerateCodeVerifier_Length(t *testing.T) {
	verifier, err := GenerateCodeVerifier()
	require.NoError(t, err)
	assert.Len(t, verifier, codeVerifierLength)
}

func TestGenerateCodeVerifier_Charset(t *testing.T) {
	verifier, err := GenerateCodeVerifier()
	require.NoError(t, err)

	allowed := map[byte]bool{}
	for i := range len(unreservedChars) {
		allowed[unreservedChars[i]] = true
	}

	for i, b := range []byte(verifier) {
		assert.True(t, allowed[b], "character at index %d (%q) is not in unreserved charset", i, string(b))
	}
}

func TestGenerateCodeVerifier_Uniqueness(t *testing.T) {
	seen := make(map[string]bool, 100)
	for range 100 {
		v, err := GenerateCodeVerifier()
		require.NoError(t, err)
		assert.False(t, seen[v], "duplicate verifier generated")
		seen[v] = true
	}
}

func TestGenerateCodeChallenge_KnownVector(t *testing.T) {
	// RFC 7636 Appendix B test vector
	verifier := "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
	expected := "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

	challenge := GenerateCodeChallenge(verifier)
	assert.Equal(t, expected, challenge)
}

func TestGenerateCodeChallenge_MatchesSHA256(t *testing.T) {
	verifier := "test-verifier-string-for-validation"
	hash := sha256.Sum256([]byte(verifier))
	expected := base64.RawURLEncoding.EncodeToString(hash[:])

	challenge := GenerateCodeChallenge(verifier)
	assert.Equal(t, expected, challenge)
}

func TestGenerateCodeChallenge_NoPadding(t *testing.T) {
	verifier, err := GenerateCodeVerifier()
	require.NoError(t, err)

	challenge := GenerateCodeChallenge(verifier)
	assert.NotContains(t, challenge, "=", "challenge should not contain base64 padding")
}

func TestGenerateState_Length(t *testing.T) {
	state, err := GenerateState()
	require.NoError(t, err)
	assert.Len(t, state, stateByteLength*2) // hex encoding doubles byte count
}

func TestGenerateState_ValidHex(t *testing.T) {
	state, err := GenerateState()
	require.NoError(t, err)

	_, err = hex.DecodeString(state)
	assert.NoError(t, err, "state should be valid hex")
}

func TestGenerateState_Uniqueness(t *testing.T) {
	seen := make(map[string]bool, 100)
	for range 100 {
		s, err := GenerateState()
		require.NoError(t, err)
		assert.False(t, seen[s], "duplicate state generated")
		seen[s] = true
	}
}

// Property-based tests: run 1000 iterations to verify invariants hold across many random outputs.

func TestGenerateCodeVerifier_Property_LengthAndCharset(t *testing.T) {
	allowed := make(map[byte]bool, len(unreservedChars))
	for i := range len(unreservedChars) {
		allowed[unreservedChars[i]] = true
	}

	for range 1000 {
		v, err := GenerateCodeVerifier()
		require.NoError(t, err)
		require.Len(t, v, codeVerifierLength)

		for _, b := range []byte(v) {
			require.True(t, allowed[b])
		}
	}
}

func TestGenerateCodeVerifier_Property_Uniqueness(t *testing.T) {
	seen := make(map[string]bool, 1000)
	for range 1000 {
		v, err := GenerateCodeVerifier()
		require.NoError(t, err)
		require.False(t, seen[v], "collision detected in 1000 verifiers")
		seen[v] = true
	}
}

func TestGenerateState_Property_Uniqueness(t *testing.T) {
	seen := make(map[string]bool, 1000)
	for range 1000 {
		s, err := GenerateState()
		require.NoError(t, err)
		require.False(t, seen[s], "collision detected in 1000 states")
		seen[s] = true
	}
}

func TestGenerateCodeChallenge_Property_MatchesSHA256(t *testing.T) {
	for range 1000 {
		v, err := GenerateCodeVerifier()
		require.NoError(t, err)

		hash := sha256.Sum256([]byte(v))
		expected := base64.RawURLEncoding.EncodeToString(hash[:])

		assert.Equal(t, expected, GenerateCodeChallenge(v))
	}
}
