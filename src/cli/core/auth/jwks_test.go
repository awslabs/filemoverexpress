package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// testRSAKey generates a deterministic-ish RSA key for testing.
func testRSAKey(t *testing.T) *rsa.PrivateKey {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	return key
}

func jwksJSON(t *testing.T, keys map[string]*rsa.PublicKey) []byte {
	t.Helper()
	type jwkEntry struct {
		KID string `json:"kid"`
		Kty string `json:"kty"`
		Alg string `json:"alg"`
		Use string `json:"use"`
		N   string `json:"n"`
		E   string `json:"e"`
	}

	var entries []jwkEntry
	for kid, pub := range keys {
		entries = append(entries, jwkEntry{
			KID: kid,
			Kty: "RSA",
			Alg: "RS256",
			Use: "sig",
			N:   base64.RawURLEncoding.EncodeToString(pub.N.Bytes()),
			E:   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(pub.E)).Bytes()),
		})
	}

	data, err := json.Marshal(map[string]any{"keys": entries})
	require.NoError(t, err)
	return data
}

func TestJWKSCache_GetKey_Success(t *testing.T) {
	key := testRSAKey(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write(jwksJSON(t, map[string]*rsa.PublicKey{"key-1": &key.PublicKey}))
	}))
	defer server.Close()

	cache := NewJWKSCache()
	jwk, err := cache.GetKey(context.Background(), JWKSGetKeyParams{
		Issuer: "issuer1", JWKSURI: server.URL, KID: "key-1",
	})
	require.NoError(t, err)
	assert.Equal(t, "key-1", jwk.KID)
	assert.Equal(t, "RS256", jwk.Alg)
	assert.Equal(t, key.PublicKey.N, jwk.Key.N)
	assert.Equal(t, key.PublicKey.E, jwk.Key.E)
}

func TestJWKSCache_CacheHit_NoNetworkRequest(t *testing.T) {
	key := testRSAKey(t)
	var fetchCount atomic.Int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		fetchCount.Add(1)
		_, _ = w.Write(jwksJSON(t, map[string]*rsa.PublicKey{"key-1": &key.PublicKey}))
	}))
	defer server.Close()

	cache := NewJWKSCache()

	// First call: fetches from server
	_, err := cache.GetKey(context.Background(), JWKSGetKeyParams{
		Issuer: "issuer1", JWKSURI: server.URL, KID: "key-1",
	})
	require.NoError(t, err)
	assert.Equal(t, int32(1), fetchCount.Load())

	// Second call: should use cache, no new fetch
	_, err = cache.GetKey(context.Background(), JWKSGetKeyParams{
		Issuer: "issuer1", JWKSURI: server.URL, KID: "key-1",
	})
	require.NoError(t, err)
	assert.Equal(t, int32(1), fetchCount.Load())
}

func TestJWKSCache_CacheExpiry_RefetchAfterTTL(t *testing.T) {
	key := testRSAKey(t)
	var fetchCount atomic.Int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		fetchCount.Add(1)
		_, _ = w.Write(jwksJSON(t, map[string]*rsa.PublicKey{"key-1": &key.PublicKey}))
	}))
	defer server.Close()

	cache := NewJWKSCache()
	cache.ttl = 10 * time.Millisecond // Very short TTL for testing

	// First fetch
	_, err := cache.GetKey(context.Background(), JWKSGetKeyParams{
		Issuer: "issuer1", JWKSURI: server.URL, KID: "key-1",
	})
	require.NoError(t, err)
	assert.Equal(t, int32(1), fetchCount.Load())

	// Wait for cache expiry
	time.Sleep(20 * time.Millisecond)

	// Should re-fetch since TTL expired
	_, err = cache.GetKey(context.Background(), JWKSGetKeyParams{
		Issuer: "issuer1", JWKSURI: server.URL, KID: "key-1",
	})
	require.NoError(t, err)
	assert.Equal(t, int32(2), fetchCount.Load())
}

func TestJWKSCache_UnknownKID_RefetchAndSucceed(t *testing.T) {
	key1 := testRSAKey(t)
	key2 := testRSAKey(t)
	var fetchCount atomic.Int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		fetchCount.Add(1)
		// Second fetch returns both keys (simulating key rotation)
		keys := map[string]*rsa.PublicKey{"key-1": &key1.PublicKey}
		if fetchCount.Load() > 1 {
			keys["key-2"] = &key2.PublicKey
		}
		_, _ = w.Write(jwksJSON(t, keys))
	}))
	defer server.Close()

	cache := NewJWKSCache()

	// First call caches key-1
	_, err := cache.GetKey(context.Background(), JWKSGetKeyParams{
		Issuer: "issuer1", JWKSURI: server.URL, KID: "key-1",
	})
	require.NoError(t, err)

	// Request key-2: not in cache → re-fetch → found
	jwk, err := cache.GetKey(context.Background(), JWKSGetKeyParams{
		Issuer: "issuer1", JWKSURI: server.URL, KID: "key-2",
	})
	require.NoError(t, err)
	assert.Equal(t, "key-2", jwk.KID)
	assert.Equal(t, int32(2), fetchCount.Load())
}

func TestJWKSCache_UnknownKID_AfterRefetch_ReturnsError(t *testing.T) {
	key1 := testRSAKey(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		// Always returns only key-1
		_, _ = w.Write(jwksJSON(t, map[string]*rsa.PublicKey{"key-1": &key1.PublicKey}))
	}))
	defer server.Close()

	cache := NewJWKSCache()

	// Request non-existent key — should fail after re-fetch
	_, err := cache.GetKey(context.Background(), JWKSGetKeyParams{
		Issuer: "issuer1", JWKSURI: server.URL, KID: "nonexistent",
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unknown key (kid: nonexistent)")
}

func TestJWKSCache_MalformedJWKSResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("not json"))
	}))
	defer server.Close()

	cache := NewJWKSCache()
	_, err := cache.GetKey(context.Background(), JWKSGetKeyParams{
		Issuer: "issuer1", JWKSURI: server.URL, KID: "key-1",
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "parse JWKS")
}

func TestJWKSCache_ServerReturnsHTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	cache := NewJWKSCache()
	_, err := cache.GetKey(context.Background(), JWKSGetKeyParams{
		Issuer: "issuer1", JWKSURI: server.URL, KID: "key-1",
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "HTTP 500")
}

func TestJWKSCache_ServerUnreachable(t *testing.T) {
	cache := NewJWKSCache()
	_, err := cache.GetKey(context.Background(), JWKSGetKeyParams{
		Issuer: "issuer1", JWKSURI: "http://127.0.0.1:1/keys", KID: "key-1",
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "fetch JWKS")
}

func TestJWKSCache_SkipsNonRSAKeys(t *testing.T) {
	// Return an EC key (kty=EC) — should be skipped
	ecJWKS := `{"keys":[{"kid":"ec-1","kty":"EC","alg":"ES256","use":"sig","crv":"P-256","x":"f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU","y":"x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0"}]}`
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(ecJWKS))
	}))
	defer server.Close()

	cache := NewJWKSCache()
	_, err := cache.GetKey(context.Background(), JWKSGetKeyParams{
		Issuer: "issuer1", JWKSURI: server.URL, KID: "ec-1",
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unknown key (kid: ec-1)")
}

func TestJWKSCache_SkipsEncryptionKeys(t *testing.T) {
	key := testRSAKey(t)
	// Return a key with use=enc — should be skipped
	entry := map[string]any{
		"keys": []map[string]any{{
			"kid": "enc-1",
			"kty": "RSA",
			"alg": "RS256",
			"use": "enc",
			"n":   base64.RawURLEncoding.EncodeToString(key.PublicKey.N.Bytes()),
			"e":   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.PublicKey.E)).Bytes()),
		}},
	}
	data, _ := json.Marshal(entry)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write(data)
	}))
	defer server.Close()

	cache := NewJWKSCache()
	_, err := cache.GetKey(context.Background(), JWKSGetKeyParams{
		Issuer: "issuer1", JWKSURI: server.URL, KID: "enc-1",
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unknown key (kid: enc-1)")
}

func TestJWKSCache_MultipleIssuersIndependent(t *testing.T) {
	key1 := testRSAKey(t)
	key2 := testRSAKey(t)

	server1 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write(jwksJSON(t, map[string]*rsa.PublicKey{"issuer1-key": &key1.PublicKey}))
	}))
	defer server1.Close()

	server2 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write(jwksJSON(t, map[string]*rsa.PublicKey{"issuer2-key": &key2.PublicKey}))
	}))
	defer server2.Close()

	cache := NewJWKSCache()

	jwk1, err := cache.GetKey(context.Background(), JWKSGetKeyParams{
		Issuer: "issuer1", JWKSURI: server1.URL, KID: "issuer1-key",
	})
	require.NoError(t, err)
	assert.Equal(t, key1.PublicKey.N, jwk1.Key.N)

	jwk2, err := cache.GetKey(context.Background(), JWKSGetKeyParams{
		Issuer: "issuer2", JWKSURI: server2.URL, KID: "issuer2-key",
	})
	require.NoError(t, err)
	assert.Equal(t, key2.PublicKey.N, jwk2.Key.N)

	// Cross-issuer lookup should fail (issuer1 doesn't have issuer2's key)
	_, err = cache.GetKey(context.Background(), JWKSGetKeyParams{
		Issuer: "issuer1", JWKSURI: server1.URL, KID: "issuer2-key",
	})
	require.Error(t, err)
}
