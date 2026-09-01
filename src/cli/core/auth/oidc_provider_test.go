package auth

import (
	"context"
	"encoding/base64"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockSTSClient implements STSClient for testing.
type mockSTSClient struct {
	callCount        int
	lastRoleARN      string
	lastSessionName  string
	lastDuration     int32
	returnCreds      *AWSCredentials
	returnErr        error
}

func (m *mockSTSClient) AssumeRoleWithWebIdentity(
	_ context.Context,
	roleARN string,
	sessionName string,
	_ string,
	durationSeconds int32,
) (*AWSCredentials, error) {
	m.callCount++
	m.lastRoleARN = roleARN
	m.lastSessionName = sessionName
	m.lastDuration = durationSeconds
	if m.returnErr != nil {
		return nil, m.returnErr
	}
	if m.returnCreds != nil {
		return m.returnCreds, nil
	}
	return &AWSCredentials{
		AccessKeyID:    "AKIAIOSFODNN7EXAMPLE",
		SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
		SessionToken:   "FwoGZXIvYXdzE...",
		Expiration:     time.Now().Add(time.Hour),
	}, nil
}

func newTestProvider(t *testing.T, sts STSClient) *OIDCProvider {
	t.Helper()
	return NewOIDCProvider(t.TempDir(), sts)
}

func validTestConfig() OIDCConfig {
	return OIDCConfig{
		IssuerURL:  "https://auth.example.com",
		ClientID:   "test-client",
		RoleARN:    "arn:aws:iam::123456789012:role/TestRole",
		Scopes:     []string{"openid", "email", "profile", "offline_access"},
	}
}

// --- Config validation tests ---

func TestOIDCProvider_ValidateConfig_MissingIssuerURL(t *testing.T) {
	sts := &mockSTSClient{}
	p := newTestProvider(t, sts)

	cfg := validTestConfig()
	cfg.IssuerURL = ""
	_, err := p.InitiateLogin(context.Background(), "profile1", cfg)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "issuer_url is required")
}

func TestOIDCProvider_ValidateConfig_MissingClientID(t *testing.T) {
	sts := &mockSTSClient{}
	p := newTestProvider(t, sts)

	cfg := validTestConfig()
	cfg.ClientID = ""
	_, err := p.InitiateLogin(context.Background(), "profile1", cfg)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "client_id is required")
}

func TestOIDCProvider_ValidateConfig_MissingRoleARN(t *testing.T) {
	sts := &mockSTSClient{}
	p := newTestProvider(t, sts)

	cfg := validTestConfig()
	cfg.RoleARN = ""
	_, err := p.InitiateLogin(context.Background(), "profile1", cfg)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "role_arn is required")
}

func TestOIDCProvider_ValidateConfig_PersistWithoutOfflineAccess(t *testing.T) {
	sts := &mockSTSClient{}
	p := newTestProvider(t, sts)

	cfg := validTestConfig()
	cfg.PersistSession = true
	cfg.Scopes = []string{"openid", "email", "profile"} // missing offline_access
	_, err := p.InitiateLogin(context.Background(), "profile1", cfg)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "offline_access scope is required when persist_session is enabled")
}

func TestOIDCProvider_ValidateConfig_PersistWithDefaultScopes(t *testing.T) {
	// When scopes are empty, defaults include offline_access — no error
	err := validateOIDCConfig(OIDCConfig{
		IssuerURL:      "https://auth.example.com",
		ClientID:       "client",
		RoleARN:        "arn:aws:iam::123:role/R",
		PersistSession: true,
		Scopes:         nil, // empty = use defaults which include offline_access
	})
	assert.NoError(t, err)
}

func TestOIDCProvider_ValidateConfig_SessionDurationTooLow(t *testing.T) {
	err := validateOIDCConfig(OIDCConfig{
		IssuerURL:              "https://auth.example.com",
		ClientID:               "client",
		RoleARN:                "arn:aws:iam::123:role/R",
		SessionDurationSeconds: 899,
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "session_duration_seconds must be between 900 and 43200")
}

func TestOIDCProvider_ValidateConfig_SessionDurationTooHigh(t *testing.T) {
	err := validateOIDCConfig(OIDCConfig{
		IssuerURL:              "https://auth.example.com",
		ClientID:               "client",
		RoleARN:                "arn:aws:iam::123:role/R",
		SessionDurationSeconds: 43201,
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "session_duration_seconds must be between 900 and 43200")
}

func TestOIDCProvider_ValidateConfig_SessionDurationZero_OK(t *testing.T) {
	err := validateOIDCConfig(OIDCConfig{
		IssuerURL:              "https://auth.example.com",
		ClientID:               "client",
		RoleARN:                "arn:aws:iam::123:role/R",
		SessionDurationSeconds: 0, // means "use STS default"
	})
	assert.NoError(t, err)
}

func TestOIDCProvider_ValidateConfig_SessionDurationValid(t *testing.T) {
	err := validateOIDCConfig(OIDCConfig{
		IssuerURL:              "https://auth.example.com",
		ClientID:               "client",
		RoleARN:                "arn:aws:iam::123:role/R",
		SessionDurationSeconds: 7200,
	})
	assert.NoError(t, err)
}

// --- State management tests ---

func TestOIDCProvider_GetStatus_NoSession(t *testing.T) {
	sts := &mockSTSClient{}
	p := newTestProvider(t, sts)

	status := p.GetStatus("nonexistent", nil)
	assert.False(t, status.Authenticated)
	assert.Empty(t, status.Identity)
	assert.Equal(t, int64(0), status.ExpiresAt)
	assert.Empty(t, status.LastError)
}

func TestOIDCProvider_InitiateLogin_SupersedesPending(t *testing.T) {
	sts := &mockSTSClient{}
	p := newTestProvider(t, sts)

	// A prior attempt left the session Pending with a live cancel handle.
	cancelled := false
	p.mu.Lock()
	p.sessions["profile1"] = &OIDCSession{
		State:  SessionStatePending,
		cancel: func() { cancelled = true },
	}
	p.mu.Unlock()

	cfg := validTestConfig()
	// A retry must NOT be rejected as "login already in progress": it supersedes the
	// stale pending attempt and starts a fresh flow (which here only fails because the
	// test issuer is unreachable). Previously this left the user unable to retry.
	_, err := p.InitiateLogin(context.Background(), "profile1", cfg)
	if err != nil {
		assert.NotContains(t, err.Error(), "login already in progress")
	}
	assert.True(t, cancelled, "prior pending flow should have been cancelled/superseded")
}

func TestOIDCProvider_InitiateLogin_RejectedWhenAuthenticated(t *testing.T) {
	sts := &mockSTSClient{}
	p := newTestProvider(t, sts)

	// Manually set a session to authenticated state
	p.mu.Lock()
	p.sessions["profile1"] = &OIDCSession{
		State: SessionStateAuthenticated,
	}
	p.mu.Unlock()

	cfg := validTestConfig()
	_, err := p.InitiateLogin(context.Background(), "profile1", cfg)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "already authenticated")
}

func TestOIDCProvider_Logout_ClearsSession(t *testing.T) {
	sts := &mockSTSClient{}
	p := newTestProvider(t, sts)

	// Set up a session
	p.mu.Lock()
	p.sessions["profile1"] = &OIDCSession{
		State:    SessionStateAuthenticated,
		Identity: "alice@example.com",
	}
	p.mu.Unlock()

	err := p.Logout("profile1")
	require.NoError(t, err)

	status := p.GetStatus("profile1", nil)
	assert.False(t, status.Authenticated)
	assert.Empty(t, status.Identity)
	assert.Empty(t, status.LastError)
}

func TestOIDCProvider_Logout_NonexistentProfile(t *testing.T) {
	sts := &mockSTSClient{}
	p := newTestProvider(t, sts)

	err := p.Logout("no-such-profile")
	assert.NoError(t, err)
}

func TestOIDCProvider_GetCredentials_NotAuthenticated(t *testing.T) {
	sts := &mockSTSClient{}
	p := newTestProvider(t, sts)

	_, err := p.GetCredentials("nonexistent", nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not authenticated")
}

func TestOIDCProvider_GetCredentials_ReturnsCachedWhenValid(t *testing.T) {
	sts := &mockSTSClient{}
	p := newTestProvider(t, sts)

	expiry := time.Now().Add(30 * time.Minute) // Well within refresh window
	p.mu.Lock()
	p.sessions["profile1"] = &OIDCSession{
		State: SessionStateAuthenticated,
		AWSCreds: &AWSCredentials{
			AccessKeyID:    "AKIA123",
			SecretAccessKey: "secret",
			SessionToken:   "token",
			Expiration:     expiry,
		},
	}
	p.mu.Unlock()

	creds, err := p.GetCredentials("profile1", nil)
	require.NoError(t, err)
	assert.Equal(t, "AKIA123", creds.AccessKeyID)
	assert.Equal(t, 0, sts.callCount) // No STS call needed
}

// --- Helper function tests ---

func TestExtractIdentity_Email(t *testing.T) {
	// Build a minimal JWT with email claim
	claims := `{"email":"alice@example.com","sub":"sub123"}`
	token := buildTestJWT(claims)
	assert.Equal(t, "alice@example.com", extractIdentity(token))
}

func TestExtractIdentity_PreferredUsername(t *testing.T) {
	claims := `{"preferred_username":"bob","sub":"sub456"}`
	token := buildTestJWT(claims)
	assert.Equal(t, "bob", extractIdentity(token))
}

func TestExtractIdentity_Sub(t *testing.T) {
	claims := `{"sub":"sub789"}`
	token := buildTestJWT(claims)
	assert.Equal(t, "sub789", extractIdentity(token))
}

func TestExtractIdentity_MalformedToken(t *testing.T) {
	assert.Empty(t, extractIdentity("not.a.valid-jwt"))
	assert.Empty(t, extractIdentity(""))
	assert.Empty(t, extractIdentity("only-one-part"))
}

func TestAudienceContains_String(t *testing.T) {
	assert.True(t, audienceContains("my-client", "my-client"))
	assert.False(t, audienceContains("other-client", "my-client"))
}

func TestAudienceContains_Array(t *testing.T) {
	aud := []any{"client-a", "client-b", "client-c"}
	assert.True(t, audienceContains(aud, "client-b"))
	assert.False(t, audienceContains(aud, "client-d"))
}

func TestSanitizeSessionName(t *testing.T) {
	assert.Equal(t, "alice@example.com", sanitizeSessionName("alice@example.com"))
	assert.Equal(t, "user-name.test", sanitizeSessionName("user-name.test"))
	assert.Equal(t, "fme-session", sanitizeSessionName("!!!"))
	assert.Equal(t, "fme-session", sanitizeSessionName(""))

	// Test max length truncation
	long := "a@b.com" + string(make([]byte, 100))
	result := sanitizeSessionName(long)
	assert.LessOrEqual(t, len(result), 64)
}

func TestDefaultScopes_IncludesOfflineAccess(t *testing.T) {
	assert.Contains(t, defaultScopes, "offline_access")
	assert.Contains(t, defaultScopes, "openid")
	assert.Contains(t, defaultScopes, "email")
	assert.Contains(t, defaultScopes, "profile")
}

// --- Helpers ---

func buildTestJWT(claimsJSON string) string {
	header := base64RawURLEncode([]byte(`{"alg":"RS256","kid":"test-key"}`))
	payload := base64RawURLEncode([]byte(claimsJSON))
	sig := base64RawURLEncode([]byte("fake-signature"))
	return header + "." + payload + "." + sig
}

func base64RawURLEncode(data []byte) string {
	return base64.RawURLEncoding.EncodeToString(data)
}
