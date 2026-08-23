package auth

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

const discoveryTimeout = 10 * time.Second

// DiscoveryDocument represents the relevant fields from an OpenID Connect discovery document.
type DiscoveryDocument struct {
	Issuer                string `json:"issuer"`
	AuthorizationEndpoint string `json:"authorization_endpoint"`
	TokenEndpoint         string `json:"token_endpoint"`
	JWKSURI               string `json:"jwks_uri"`
	UserinfoEndpoint      string `json:"userinfo_endpoint"`
}

// FetchDiscovery fetches and parses the OIDC discovery document from {issuerURL}/.well-known/openid-configuration.
// It validates that the token_endpoint uses HTTPS. When customCABundle is non-empty, its PEM contents
// are loaded into the TLS root CA pool for the HTTP client.
func FetchDiscovery(ctx context.Context, issuerURL string, customCABundle string) (*DiscoveryDocument, error) {
	discoveryURL := strings.TrimRight(issuerURL, "/") + "/.well-known/openid-configuration"

	client, err := buildHTTPClient(customCABundle)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(ctx, discoveryTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, discoveryURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create discovery request: %w", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("cannot reach OIDC provider at %s: %w", issuerURL, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("cannot reach OIDC provider at %s: HTTP %d", issuerURL, resp.StatusCode)
	}

	var doc DiscoveryDocument
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return nil, fmt.Errorf("cannot reach OIDC provider at %s: malformed discovery document: %w", issuerURL, err)
	}

	if err := validateDiscoveryDocument(&doc, issuerURL); err != nil {
		return nil, err
	}

	return &doc, nil
}

func validateDiscoveryDocument(doc *DiscoveryDocument, issuerURL string) error {
	expectedIssuer := strings.TrimRight(issuerURL, "/")
	actualIssuer := strings.TrimRight(doc.Issuer, "/")
	if actualIssuer != expectedIssuer {
		return fmt.Errorf(
			"discovery document issuer mismatch: got %q, expected %q",
			doc.Issuer, issuerURL,
		)
	}

	if doc.AuthorizationEndpoint == "" {
		return fmt.Errorf("discovery document from %s is missing authorization_endpoint", issuerURL)
	}
	if doc.TokenEndpoint == "" {
		return fmt.Errorf("discovery document from %s is missing token_endpoint", issuerURL)
	}
	if doc.JWKSURI == "" {
		return fmt.Errorf("discovery document from %s is missing jwks_uri", issuerURL)
	}
	if !strings.HasPrefix(doc.TokenEndpoint, "https://") {
		return fmt.Errorf(
			"token_endpoint from %s uses HTTP (%s) — HTTPS is required; this is a configuration error",
			issuerURL, doc.TokenEndpoint,
		)
	}

	return nil
}

// buildHTTPClient creates an HTTP client, optionally configured with a custom CA bundle.
func buildHTTPClient(customCABundle string) (*http.Client, error) {
	if customCABundle == "" {
		return &http.Client{}, nil
	}

	pemData, err := os.ReadFile(customCABundle)
	if err != nil {
		return nil, fmt.Errorf("read custom CA bundle %s: %w", customCABundle, err)
	}

	pool, err := x509.SystemCertPool()
	if err != nil {
		pool = x509.NewCertPool()
	}

	if !pool.AppendCertsFromPEM(pemData) {
		return nil, fmt.Errorf("custom CA bundle %s contains no valid PEM certificates", customCABundle)
	}

	transport := &http.Transport{
		TLSClientConfig: &tls.Config{
			RootCAs:    pool,
			MinVersion: tls.VersionTLS12,
		},
	}

	return &http.Client{Transport: transport}, nil
}
