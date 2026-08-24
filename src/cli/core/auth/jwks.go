package auth

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"sync"
	"time"
)

const jwksCacheTTL = 1 * time.Hour

type (
	// JWK represents a single JSON Web Key (RSA only for now — RS256 is the Dex signing algorithm).
	JWK struct {
		KID string         // Key ID
		Alg string         // Algorithm (e.g., "RS256")
		Key *rsa.PublicKey // Parsed RSA public key
	}

	// JWKSCache caches JWKS keys per issuer with a configurable TTL.
	JWKSCache struct {
		mu      sync.RWMutex
		entries map[string]*jwksCacheEntry
		ttl     time.Duration
	}

	jwksCacheEntry struct {
		keys      []JWK
		fetchedAt time.Time
	}

	jwksResponse struct {
		Keys []jwksKey `json:"keys"`
	}

	jwksKey struct {
		KID string `json:"kid"`
		Kty string `json:"kty"`
		Alg string `json:"alg"`
		Use string `json:"use"`
		N   string `json:"n"`
		E   string `json:"e"`
	}

	// JWKSGetKeyParams holds the parameters for JWKSCache.GetKey.
	JWKSGetKeyParams struct {
		Issuer         string
		JWKSURI        string
		KID            string
		CustomCABundle string
	}
)

// NewJWKSCache creates a new JWKS cache with the default TTL (1 hour).
func NewJWKSCache() *JWKSCache {
	return &JWKSCache{
		entries: make(map[string]*jwksCacheEntry),
		ttl:     jwksCacheTTL,
	}
}

// GetKey retrieves the JWK matching the given kid from the cache or by fetching the JWKS endpoint.
// If the kid is not found in the cache, it re-fetches once before returning an error.
func (c *JWKSCache) GetKey(ctx context.Context, params JWKSGetKeyParams) (*JWK, error) {
	// Try cached keys first
	if key := c.lookupCached(params.Issuer, params.KID); key != nil {
		return key, nil
	}

	// Cache miss or unknown kid — fetch fresh keys
	if err := c.fetch(ctx, params.Issuer, params.JWKSURI, params.CustomCABundle); err != nil {
		return nil, err
	}

	// Try again after fetch
	if key := c.lookupCached(params.Issuer, params.KID); key != nil {
		return key, nil
	}

	return nil, fmt.Errorf("ID token signed with unknown key (kid: %s)", params.KID)
}

func (c *JWKSCache) lookupCached(issuer string, kid string) *JWK {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, ok := c.entries[issuer]
	if !ok || time.Since(entry.fetchedAt) > c.ttl {
		return nil
	}

	for i := range entry.keys {
		if entry.keys[i].KID == kid {
			return &entry.keys[i]
		}
	}

	return nil
}

func (c *JWKSCache) fetch(
	ctx context.Context,
	issuer string,
	jwksURI string,
	customCABundle string,
) error {
	client, err := buildHTTPClient(customCABundle)
	if err != nil {
		return fmt.Errorf("build JWKS HTTP client: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, jwksURI, nil)
	if err != nil {
		return fmt.Errorf("create JWKS request: %w", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("fetch JWKS from %s: %w", jwksURI, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("fetch JWKS from %s: HTTP %d", jwksURI, resp.StatusCode)
	}

	var raw jwksResponse
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return fmt.Errorf("parse JWKS from %s: %w", jwksURI, err)
	}

	keys, err := parseJWKS(raw)
	if err != nil {
		return fmt.Errorf("parse JWKS from %s: %w", jwksURI, err)
	}

	c.mu.Lock()
	c.entries[issuer] = &jwksCacheEntry{
		keys:      keys,
		fetchedAt: time.Now(),
	}
	c.mu.Unlock()

	return nil
}

func parseJWKS(raw jwksResponse) ([]JWK, error) {
	var keys []JWK

	for _, k := range raw.Keys {
		if k.Kty != "RSA" {
			continue // Skip non-RSA keys
		}
		if k.Use != "" && k.Use != "sig" {
			continue // Skip non-signing keys
		}

		pubKey, err := parseRSAPublicKey(k.N, k.E)
		if err != nil {
			return nil, fmt.Errorf("parse key %s: %w", k.KID, err)
		}

		keys = append(keys, JWK{
			KID: k.KID,
			Alg: k.Alg,
			Key: pubKey,
		})
	}

	return keys, nil
}

func parseRSAPublicKey(nB64 string, eB64 string) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(nB64)
	if err != nil {
		return nil, fmt.Errorf("decode modulus: %w", err)
	}

	eBytes, err := base64.RawURLEncoding.DecodeString(eB64)
	if err != nil {
		return nil, fmt.Errorf("decode exponent: %w", err)
	}

	n := new(big.Int).SetBytes(nBytes)
	e := new(big.Int).SetBytes(eBytes)

	if !e.IsInt64() {
		return nil, fmt.Errorf("exponent too large")
	}

	return &rsa.PublicKey{
		N: n,
		E: int(e.Int64()),
	}, nil
}
