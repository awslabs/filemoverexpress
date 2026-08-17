package auth

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"golang.org/x/oauth2"
)

const (
	SessionStateUnauthenticated SessionState = iota
	SessionStatePending
	SessionStateAuthenticated

	defaultSessionDuration  = 3600
	credentialRefreshWindow = 5 * time.Minute
	maxSessionNameLength    = 64
	dirPermissions          = 0o700
	filePermissions         = 0o600
)

// defaultScopes are used when no scopes are explicitly configured.
var defaultScopes = []string{"openid", "email", "profile", "offline_access"}

type (
	// SessionState represents the authentication state of an OIDC session.
	SessionState int

	// OIDCConfig holds the configuration for an OIDC authentication flow.
	OIDCConfig struct {
		IssuerURL              string
		ClientID               string
		RoleARN                string
		Scopes                 []string
		PersistSession         bool
		CustomCABundle         string
		SessionDurationSeconds int32
	}

	// AWSCredentials holds temporary AWS credentials from AssumeRoleWithWebIdentity.
	AWSCredentials struct {
		AccessKeyID     string
		SecretAccessKey string
		SessionToken    string
		Expiration      time.Time
	}

	// OIDCSession holds the runtime state for a single profile's OIDC session.
	OIDCSession struct {
		Config       OIDCConfig
		State        SessionState
		IDToken      string
		AWSCreds     *AWSCredentials
		Identity     string
		LastError    string
		oauth2Token  *oauth2.Token
		oauth2Config *oauth2.Config
		discovery    *DiscoveryDocument
	}

	// STSClient is an interface for calling AssumeRoleWithWebIdentity, allowing test mocking.
	STSClient interface {
		AssumeRoleWithWebIdentity(
			ctx context.Context,
			roleARN string,
			sessionName string,
			webIdentityToken string,
			durationSeconds int32,
		) (*AWSCredentials, error)
	}

	// OIDCProvider orchestrates OIDC login, token exchange, credential acquisition, and caching.
	OIDCProvider struct {
		mu             sync.RWMutex
		sessions       map[string]*OIDCSession
		loadedProfiles map[string]bool
		tokenCache     *TokenCache
		jwksCache      *JWKSCache
		stsClient      STSClient
	}

	// OIDCStatus holds the return values from GetStatus.
	OIDCStatus struct {
		Authenticated bool
		Identity      string
		ExpiresAt     int64
		LastError     string
	}

	// awaitCallbackParams holds the parameters for the awaitCallback method.
	awaitCallbackParams struct {
		profileName string
		session     *OIDCSession
		cbServer    *CallbackServer
		verifier    string
	}

	// exchangeParams holds the parameters for the exchangeAndAssumeRole method.
	exchangeParams struct {
		profileName string
		session     *OIDCSession
		code        string
		verifier    string
	}
)

// NewOIDCProvider creates a new provider with token cache in the given directory.
func NewOIDCProvider(cacheDir string, stsClient STSClient) *OIDCProvider {
	return &OIDCProvider{
		sessions:       make(map[string]*OIDCSession),
		loadedProfiles: make(map[string]bool),
		tokenCache:     NewTokenCache(cacheDir),
		jwksCache:      NewJWKSCache(),
		stsClient:      stsClient,
	}
}

// InitiateLogin starts the OIDC login flow for the given profile.
// Returns an authorization URL to open in the browser.
func (p *OIDCProvider) InitiateLogin(
	ctx context.Context,
	profileName string,
	cfg OIDCConfig,
) (string, error) {
	if err := validateOIDCConfig(cfg); err != nil {
		return "", err
	}

	p.mu.Lock()
	session := p.sessions[profileName]
	if session != nil {
		if session.State == SessionStatePending {
			p.mu.Unlock()
			return "", fmt.Errorf("login already in progress for profile %q", profileName)
		}
		if session.State == SessionStateAuthenticated {
			p.mu.Unlock()
			return "", fmt.Errorf("already authenticated — call LogoutOIDC first")
		}
	}

	session = &OIDCSession{Config: cfg, State: SessionStatePending}
	p.sessions[profileName] = session
	p.mu.Unlock()

	authURL, err := p.buildAuthFlow(ctx, profileName, session)
	if err != nil {
		p.setSessionError(profileName, err.Error())
		return "", err
	}

	return authURL, nil
}

// GetStatus returns the current auth status for a profile (no network calls).
func (p *OIDCProvider) GetStatus(profileName string, cfg *OIDCConfig) OIDCStatus {
	p.ensureLoaded(profileName, cfg)

	p.mu.RLock()
	defer p.mu.RUnlock()

	session := p.sessions[profileName]
	if session == nil {
		return OIDCStatus{}
	}

	authenticated := session.State == SessionStateAuthenticated
	var expiresAt int64
	if session.AWSCreds != nil {
		expiresAt = session.AWSCreds.Expiration.Unix()
	}

	return OIDCStatus{
		Authenticated: authenticated,
		Identity:      session.Identity,
		ExpiresAt:     expiresAt,
		LastError:     session.LastError,
	}
}

// GetCredentials returns cached AWS credentials, refreshing if near expiry.
func (p *OIDCProvider) GetCredentials(profileName string, cfg *OIDCConfig) (*AWSCredentials, error) {
	p.ensureLoaded(profileName, cfg)

	p.mu.RLock()
	session := p.sessions[profileName]
	p.mu.RUnlock()

	if session == nil || session.State != SessionStateAuthenticated {
		return nil, fmt.Errorf(
			"not authenticated for profile %q — call InitiateOIDCLogin: %w",
			profileName,
			ErrOIDCNotAuthenticated,
		)
	}

	if session.AWSCreds != nil && time.Until(session.AWSCreds.Expiration) > credentialRefreshWindow {
		return session.AWSCreds, nil
	}

	// Credentials expiring soon — attempt refresh. A refresh failure (expired or
	// revoked refresh token, e.g. after an SSO logout) means the user must sign in
	// again, so surface it as not-authenticated rather than a generic session error.
	if err := p.refreshCredentials(profileName, session); err != nil {
		return nil, fmt.Errorf(
			"session expired for profile %q — sign in required (%v): %w",
			profileName,
			err,
			ErrOIDCNotAuthenticated,
		)
	}

	return session.AWSCreds, nil
}

// Logout clears the session and cached tokens for a profile.
func (p *OIDCProvider) Logout(profileName string) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	delete(p.sessions, profileName)
	delete(p.loadedProfiles, profileName)
	return p.tokenCache.Delete(profileName)
}

// ensureLoaded lazily restores a cached OIDC session from disk on first access.
// The write lock is held for the entire load attempt to prevent concurrent callers
// from seeing a half-loaded state. All failures are handled gracefully — the profile
// is left unauthenticated and marked as loaded so the attempt is not retried.
func (p *OIDCProvider) ensureLoaded(profileName string, cfg *OIDCConfig) {
	if cfg == nil || !cfg.PersistSession {
		return
	}

	p.mu.RLock()
	loaded := p.loadedProfiles[profileName]
	p.mu.RUnlock()

	if loaded {
		return
	}

	p.mu.Lock()
	if p.loadedProfiles[profileName] {
		p.mu.Unlock()
		return
	}
	p.loadedProfiles[profileName] = true
	p.mu.Unlock()

	// Do the network work WITHOUT holding p.mu: loadCachedSession ->
	// refreshAndAssumeRole acquires p.mu itself, and sync.RWMutex is not reentrant,
	// so holding it across the load would deadlock this goroutine — and, because the
	// write lock would never be released, every other OIDC call along with it.
	p.loadCachedSession(profileName, *cfg)
}

// loadCachedSession restores a session from cache. It must NOT be called with p.mu
// held: it performs network I/O and calls refreshAndAssumeRole, which acquires p.mu
// itself (sync.RWMutex is not reentrant). On any failure (decryption, expired token,
// unreachable IdP), it logs a warning, deletes the corrupt cache entry, and returns —
// leaving the profile unauthenticated.
func (p *OIDCProvider) loadCachedSession(profileName string, cfg OIDCConfig) {
	cached, err := p.tokenCache.Load(profileName)
	if err != nil {
		slog.Warn("cached OIDC session unreadable, removing",
			"profile", profileName, "error", err)
		_ = p.tokenCache.Delete(profileName)
		return
	}

	session := &OIDCSession{Config: cfg, State: SessionStateUnauthenticated}
	session.Identity = cached.Identity

	ctx := context.Background()
	discovery, err := FetchDiscovery(ctx, cfg.IssuerURL, cfg.CustomCABundle)
	if err != nil {
		slog.Warn("OIDC discovery unreachable during session restore",
			"profile", profileName, "error", err)
		_ = p.tokenCache.Delete(profileName)
		return
	}
	session.discovery = discovery
	session.oauth2Config = buildOAuth2Config(cfg, discovery, "")

	token := &oauth2.Token{RefreshToken: cached.RefreshToken}
	session.oauth2Token = token

	if err := p.refreshAndAssumeRole(ctx, profileName, session); err != nil {
		slog.Warn("cached refresh token no longer valid",
			"profile", profileName, "error", err)
		_ = p.tokenCache.Delete(profileName)
		return
	}

	p.mu.Lock()
	p.sessions[profileName] = session
	p.mu.Unlock()
}

// LoadCachedSession attempts to restore a session from disk (only when persist_session=true).
func (p *OIDCProvider) LoadCachedSession(
	ctx context.Context,
	profileName string,
	cfg OIDCConfig,
) error {
	if !cfg.PersistSession {
		return nil
	}

	cached, err := p.tokenCache.Load(profileName)
	if err != nil {
		return err
	}

	session := &OIDCSession{Config: cfg, State: SessionStateUnauthenticated}
	session.Identity = cached.Identity

	// Fetch discovery to get token endpoint
	discovery, err := FetchDiscovery(ctx, cfg.IssuerURL, cfg.CustomCABundle)
	if err != nil {
		return err
	}
	session.discovery = discovery
	session.oauth2Config = buildOAuth2Config(cfg, discovery, "")

	// Use refresh token to get fresh tokens
	token := &oauth2.Token{RefreshToken: cached.RefreshToken}
	session.oauth2Token = token

	if err := p.refreshAndAssumeRole(ctx, profileName, session); err != nil {
		_ = p.tokenCache.Delete(profileName)
		return fmt.Errorf("session expired — please sign in again: %w", err)
	}

	p.mu.Lock()
	p.sessions[profileName] = session
	p.mu.Unlock()

	return nil
}

func validateOIDCConfig(cfg OIDCConfig) error {
	if cfg.IssuerURL == "" {
		return fmt.Errorf("oidc_config.issuer_url is required")
	}
	if cfg.ClientID == "" {
		return fmt.Errorf("oidc_config.client_id is required")
	}
	if cfg.RoleARN == "" {
		return fmt.Errorf("oidc_config.role_arn is required")
	}
	if cfg.PersistSession && !containsScope(cfg.Scopes, "offline_access") {
		if len(cfg.Scopes) > 0 { // Only error if scopes are explicitly set without offline_access
			return fmt.Errorf("offline_access scope is required when persist_session is enabled")
		}
	}
	if cfg.SessionDurationSeconds != 0 {
		if cfg.SessionDurationSeconds < 900 || cfg.SessionDurationSeconds > 43200 {
			return fmt.Errorf("session_duration_seconds must be between 900 and 43200")
		}
	}
	return nil
}

func containsScope(scopes []string, target string) bool {
	for _, s := range scopes {
		if s == target {
			return true
		}
	}
	return false
}

func (p *OIDCProvider) buildAuthFlow(
	ctx context.Context,
	profileName string,
	session *OIDCSession,
) (string, error) {
	slog.Info("Building auth flow for profile", slog.String("profileName", profileName))
	discovery, err := FetchDiscovery(ctx, session.Config.IssuerURL, session.Config.CustomCABundle)
	if err != nil {
		return "", err
	}
	session.discovery = discovery

	verifier, err := GenerateCodeVerifier()
	if err != nil {
		return "", err
	}
	challenge := GenerateCodeChallenge(verifier)

	state, err := GenerateState()
	if err != nil {
		return "", err
	}

	cbServer, err := NewCallbackServer(ctx, state)
	if err != nil {
		return "", err
	}
	slog.Info("Started callback server")

	oauth2Cfg := buildOAuth2Config(session.Config, discovery, cbServer.RedirectURI())
	session.oauth2Config = oauth2Cfg

	authURL := oauth2Cfg.AuthCodeURL(state,
		oauth2.SetAuthURLParam("code_challenge", challenge),
		oauth2.SetAuthURLParam("code_challenge_method", "S256"),
	)

	// Start background goroutine to complete the flow
	go p.awaitCallback(ctx, awaitCallbackParams{
		profileName: profileName,
		session:     session,
		cbServer:    cbServer,
		verifier:    verifier,
	})

	return authURL, nil
}

func (p *OIDCProvider) awaitCallback(_ context.Context, params awaitCallbackParams) {
	callbackCtx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	defer func() { _ = params.cbServer.Shutdown() }()

	result, err := params.cbServer.WaitForCallback(callbackCtx)
	if err != nil {
		p.setSessionError(params.profileName, err.Error())
		return
	}

	if result.Error != "" {
		msg := fmt.Sprintf("Authentication denied: %s", result.ErrorDescription)
		p.setSessionError(params.profileName, msg)
		return
	}

	if err := p.exchangeAndAssumeRole(callbackCtx, exchangeParams{
		profileName: params.profileName,
		session:     params.session,
		code:        result.Code,
		verifier:    params.verifier,
	}); err != nil {
		p.setSessionError(params.profileName, err.Error())
	}
}

func (p *OIDCProvider) exchangeAndAssumeRole(ctx context.Context, params exchangeParams) error {
	token, err := params.session.oauth2Config.Exchange(ctx, params.code,
		oauth2.SetAuthURLParam("code_verifier", params.verifier),
	)
	if err != nil {
		return fmt.Errorf("token exchange failed: %w", err)
	}

	params.session.oauth2Token = token
	idToken, _ := token.Extra("id_token").(string)
	if idToken == "" {
		return fmt.Errorf("token response missing id_token")
	}

	if err := p.validateIDToken(ctx, params.session, idToken); err != nil {
		return err
	}

	params.session.IDToken = idToken
	identity := extractIdentity(idToken)
	params.session.Identity = identity

	creds, err := p.assumeRole(ctx, params.session)
	if err != nil {
		return err
	}

	p.mu.Lock()
	params.session.AWSCreds = creds
	params.session.State = SessionStateAuthenticated
	params.session.LastError = ""
	p.mu.Unlock()

	p.persistIfEnabled(params.profileName, params.session)
	return nil
}

func (p *OIDCProvider) refreshCredentials(profileName string, session *OIDCSession) error {
	ctx := context.Background()
	if err := p.refreshAndAssumeRole(ctx, profileName, session); err != nil {
		p.setSessionError(profileName, "Session expired — please sign in again")
		return err
	}
	return nil
}

func (p *OIDCProvider) refreshAndAssumeRole(
	ctx context.Context,
	profileName string,
	session *OIDCSession,
) error {
	if session.oauth2Token == nil || session.oauth2Token.RefreshToken == "" {
		return fmt.Errorf("no refresh token available")
	}

	src := session.oauth2Config.TokenSource(ctx, session.oauth2Token)
	newToken, err := src.Token()
	if err != nil {
		return fmt.Errorf("refresh token exchange failed: %w", err)
	}

	session.oauth2Token = newToken
	idToken, _ := newToken.Extra("id_token").(string)
	if idToken == "" {
		return fmt.Errorf("refresh response missing id_token")
	}

	if err := p.validateIDToken(ctx, session, idToken); err != nil {
		return err
	}

	session.IDToken = idToken
	session.Identity = extractIdentity(idToken)

	creds, err := p.assumeRole(ctx, session)
	if err != nil {
		return err
	}

	p.mu.Lock()
	session.AWSCreds = creds
	session.State = SessionStateAuthenticated
	session.LastError = ""
	p.mu.Unlock()

	p.persistIfEnabled(profileName, session)
	return nil
}

func (p *OIDCProvider) assumeRole(ctx context.Context, session *OIDCSession) (*AWSCredentials, error) {
	sessionName := session.Identity
	if sessionName == "" {
		sessionName = "fme-session"
	}
	// Sanitize session name for STS (max 64 chars, limited charset)
	sessionName = sanitizeSessionName(sessionName)

	duration := session.Config.SessionDurationSeconds
	creds, err := p.stsClient.AssumeRoleWithWebIdentity(
		ctx, session.Config.RoleARN, sessionName, session.IDToken, duration,
	)
	if err != nil {
		return nil, fmt.Errorf("AssumeRoleWithWebIdentity failed: %w", err)
	}

	return creds, nil
}

func (p *OIDCProvider) validateIDToken(
	ctx context.Context,
	session *OIDCSession,
	idToken string,
) error {
	parts := strings.Split(idToken, ".")
	if len(parts) != 3 {
		return fmt.Errorf("ID token validation failed: malformed JWT")
	}

	// Verify signature against JWKS
	if err := p.verifySignature(ctx, session, parts); err != nil {
		return err
	}

	// Decode and validate claims
	claimsJSON, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return fmt.Errorf("ID token validation failed: cannot decode claims")
	}

	var claims struct {
		Iss string `json:"iss"`
		Aud any    `json:"aud"`
	}
	if err := json.Unmarshal(claimsJSON, &claims); err != nil {
		return fmt.Errorf("ID token validation failed: cannot parse claims")
	}

	if claims.Iss != session.Config.IssuerURL {
		return fmt.Errorf("ID token validation failed: issuer mismatch (got %q, want %q)",
			claims.Iss, session.Config.IssuerURL)
	}

	if !audienceContains(claims.Aud, session.Config.ClientID) {
		return fmt.Errorf("ID token validation failed: audience does not contain %q",
			session.Config.ClientID)
	}

	return nil
}

func (p *OIDCProvider) verifySignature(
	ctx context.Context,
	session *OIDCSession,
	parts []string,
) error {
	headerJSON, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return fmt.Errorf("ID token signature invalid: cannot decode header")
	}

	var header struct {
		Kid string `json:"kid"`
		Alg string `json:"alg"`
	}
	if err := json.Unmarshal(headerJSON, &header); err != nil {
		return fmt.Errorf("ID token signature invalid: cannot parse header")
	}

	jwk, err := p.jwksCache.GetKey(ctx, JWKSGetKeyParams{
		Issuer:         session.Config.IssuerURL,
		JWKSURI:        session.discovery.JWKSURI,
		KID:            header.Kid,
		CustomCABundle: session.Config.CustomCABundle,
	})
	if err != nil {
		return fmt.Errorf("ID token signature invalid: %w", err)
	}

	signingInput := parts[0] + "." + parts[1]
	sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return fmt.Errorf("ID token signature invalid: cannot decode signature")
	}

	hash := sha256.Sum256([]byte(signingInput))
	if err := rsa.VerifyPKCS1v15(jwk.Key, crypto.SHA256, hash[:], sigBytes); err != nil {
		return fmt.Errorf("ID token signature invalid: verification failed")
	}

	return nil
}

func (p *OIDCProvider) persistIfEnabled(profileName string, session *OIDCSession) {
	if !session.Config.PersistSession || session.oauth2Token == nil {
		return
	}
	tokens := CachedTokens{
		RefreshToken: session.oauth2Token.RefreshToken,
		TokenExpiry:  session.oauth2Token.Expiry,
		Identity:     session.Identity,
	}
	_ = p.tokenCache.Save(profileName, tokens)
}

func (p *OIDCProvider) setSessionError(profileName string, errMsg string) {
	p.mu.Lock()
	defer p.mu.Unlock()

	session := p.sessions[profileName]
	if session != nil {
		session.State = SessionStateUnauthenticated
		session.LastError = errMsg
	}
}

func buildOAuth2Config(cfg OIDCConfig, doc *DiscoveryDocument, redirectURI string) *oauth2.Config {
	scopes := cfg.Scopes
	if len(scopes) == 0 {
		scopes = defaultScopes
	}

	return &oauth2.Config{
		ClientID: cfg.ClientID,
		Endpoint: oauth2.Endpoint{
			AuthURL:  doc.AuthorizationEndpoint,
			TokenURL: doc.TokenEndpoint,
		},
		RedirectURL: redirectURI,
		Scopes:      scopes,
	}
}

func extractIdentity(idToken string) string {
	parts := strings.Split(idToken, ".")
	if len(parts) != 3 {
		return ""
	}
	claimsJSON, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return ""
	}
	var claims struct {
		Email             string `json:"email"`
		PreferredUsername string `json:"preferred_username"`
		Sub               string `json:"sub"`
	}
	if err := json.Unmarshal(claimsJSON, &claims); err != nil {
		return ""
	}
	if claims.Email != "" {
		return claims.Email
	}
	if claims.PreferredUsername != "" {
		return claims.PreferredUsername
	}
	return claims.Sub
}

func audienceContains(aud any, clientID string) bool {
	switch v := aud.(type) {
	case string:
		return v == clientID
	case []any:
		for _, a := range v {
			if s, ok := a.(string); ok && s == clientID {
				return true
			}
		}
	}
	return false
}

func sanitizeSessionName(name string) string {
	// STS session names: max 64 chars, [a-zA-Z0-9=,.@-]
	var b strings.Builder
	for _, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') ||
			r == '=' || r == ',' || r == '.' || r == '@' || r == '-' {
			_, _ = b.WriteRune(r)
		}
		if b.Len() >= maxSessionNameLength {
			break
		}
	}
	result := b.String()
	if result == "" {
		return "fme-session"
	}
	return result
}
