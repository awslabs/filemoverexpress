package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// oidcDiscoveryDoc represents the subset of fields we validate from the
// OpenID Connect discovery document.
type oidcDiscoveryDoc struct {
	Issuer                string `json:"issuer"`
	AuthorizationEndpoint string `json:"authorization_endpoint"`
	TokenEndpoint         string `json:"token_endpoint"`
	JwksURI               string `json:"jwks_uri"`
}

// ValidateOIDCIssuer fetches the OIDC discovery document at
// {issuerUrl}/.well-known/openid-configuration and validates that it
// contains the required fields. Returns an empty string on success or
// an error key string on failure that the frontend can use to display
// the appropriate message.
//
// Error keys returned:
//   - "invalidUrl"      – the URL is not a valid HTTPS URL
//   - "oidcUnreachable" – network error, timeout, or non-2xx response
//   - "oidcInvalidDoc"  – response is not valid JSON or missing required fields
func (a *FMEApp) ValidateOIDCIssuer(issuerUrl string) string {
	issuerUrl = strings.TrimSpace(issuerUrl)
	if issuerUrl == "" {
		return ""
	}

	parsed, err := url.Parse(issuerUrl)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" {
		return "invalidUrl"
	}

	discoveryURL := strings.TrimRight(issuerUrl, "/") + "/.well-known/openid-configuration"

	client := &http.Client{Timeout: 8 * time.Second}

	resp, err := client.Get(discoveryURL)
	if err != nil {
		return "oidcUnreachable"
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "oidcUnreachable"
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20)) // 1 MiB cap
	if err != nil {
		return "oidcUnreachable"
	}

	var doc oidcDiscoveryDoc
	if err = json.Unmarshal(body, &doc); err != nil {
		return "oidcInvalidDoc"
	}

	if err = validateDiscoveryFields(&doc); err != nil {
		return "oidcInvalidDoc"
	}

	return ""
}

func validateDiscoveryFields(doc *oidcDiscoveryDoc) error {
	if doc.Issuer == "" {
		return fmt.Errorf("missing issuer")
	}
	if doc.AuthorizationEndpoint == "" {
		return fmt.Errorf("missing authorization_endpoint")
	}
	if doc.TokenEndpoint == "" {
		return fmt.Errorf("missing token_endpoint")
	}
	if doc.JwksURI == "" {
		return fmt.Errorf("missing jwks_uri")
	}
	return nil
}
