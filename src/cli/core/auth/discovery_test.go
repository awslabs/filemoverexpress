package auth

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"math/big"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func validDiscoveryJSON(issuer, tokenEndpoint string) string {
	doc := DiscoveryDocument{
		Issuer:                issuer,
		AuthorizationEndpoint: "https://auth.example.com/auth",
		TokenEndpoint:         tokenEndpoint,
		JWKSURI:               "https://auth.example.com/keys",
		UserinfoEndpoint:      "https://auth.example.com/userinfo",
	}
	data, _ := json.Marshal(doc)
	return string(data)
}

func TestFetchDiscovery_Success(t *testing.T) {
	var serverURL string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/.well-known/openid-configuration", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(validDiscoveryJSON(serverURL, "https://auth.example.com/token")))
	}))
	defer server.Close()
	serverURL = server.URL

	doc, err := FetchDiscovery(context.Background(), server.URL, "")
	require.NoError(t, err)
	assert.Equal(t, server.URL, doc.Issuer)
	assert.Equal(t, "https://auth.example.com/auth", doc.AuthorizationEndpoint)
	assert.Equal(t, "https://auth.example.com/token", doc.TokenEndpoint)
	assert.Equal(t, "https://auth.example.com/keys", doc.JWKSURI)
	assert.Equal(t, "https://auth.example.com/userinfo", doc.UserinfoEndpoint)
}

func TestFetchDiscovery_TrailingSlashInIssuer(t *testing.T) {
	var serverURL string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/.well-known/openid-configuration", r.URL.Path)
		_, _ = w.Write([]byte(validDiscoveryJSON(serverURL, "https://auth.example.com/token")))
	}))
	defer server.Close()
	serverURL = server.URL

	doc, err := FetchDiscovery(context.Background(), server.URL+"/", "")
	require.NoError(t, err)
	assert.Equal(t, "https://auth.example.com/token", doc.TokenEndpoint)
}

func TestFetchDiscovery_MissingAuthorizationEndpoint(t *testing.T) {
	var serverURL string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		doc := map[string]string{
			"issuer":         serverURL,
			"token_endpoint": "https://auth.example.com/token",
			"jwks_uri":       "https://auth.example.com/keys",
		}
		data, _ := json.Marshal(doc)
		_, _ = w.Write(data)
	}))
	defer server.Close()
	serverURL = server.URL

	_, err := FetchDiscovery(context.Background(), server.URL, "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "missing authorization_endpoint")
}

func TestFetchDiscovery_MissingTokenEndpoint(t *testing.T) {
	var serverURL string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		doc := map[string]string{
			"issuer":                 serverURL,
			"authorization_endpoint": "https://auth.example.com/auth",
			"jwks_uri":               "https://auth.example.com/keys",
		}
		data, _ := json.Marshal(doc)
		_, _ = w.Write(data)
	}))
	defer server.Close()
	serverURL = server.URL

	_, err := FetchDiscovery(context.Background(), server.URL, "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "missing token_endpoint")
}

func TestFetchDiscovery_MissingJWKSURI(t *testing.T) {
	var serverURL string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		doc := map[string]string{
			"issuer":                 serverURL,
			"authorization_endpoint": "https://auth.example.com/auth",
			"token_endpoint":         "https://auth.example.com/token",
		}
		data, _ := json.Marshal(doc)
		_, _ = w.Write(data)
	}))
	defer server.Close()
	serverURL = server.URL

	_, err := FetchDiscovery(context.Background(), server.URL, "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "missing jwks_uri")
}

func TestFetchDiscovery_HTTPTokenEndpointRejected(t *testing.T) {
	var serverURL string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(validDiscoveryJSON(serverURL, "http://auth.example.com/token")))
	}))
	defer server.Close()
	serverURL = server.URL

	_, err := FetchDiscovery(context.Background(), server.URL, "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "uses HTTP")
	assert.Contains(t, err.Error(), "HTTPS is required")
}

func TestFetchDiscovery_IssuerMismatch(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		doc := DiscoveryDocument{
			Issuer:                "https://evil.example.com",
			AuthorizationEndpoint: "https://auth.example.com/auth",
			TokenEndpoint:         "https://auth.example.com/token",
			JWKSURI:               "https://auth.example.com/keys",
		}
		data, _ := json.Marshal(doc)
		_, _ = w.Write(data)
	}))
	defer server.Close()

	_, err := FetchDiscovery(context.Background(), server.URL, "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "issuer mismatch")
	assert.Contains(t, err.Error(), "https://evil.example.com")
}

func TestFetchDiscovery_UnreachableServer(t *testing.T) {
	_, err := FetchDiscovery(context.Background(), "http://127.0.0.1:1", "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "cannot reach OIDC provider")
}

func TestFetchDiscovery_MalformedJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("not json at all"))
	}))
	defer server.Close()

	_, err := FetchDiscovery(context.Background(), server.URL, "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "malformed discovery document")
}

func TestFetchDiscovery_Non200Status(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	_, err := FetchDiscovery(context.Background(), server.URL, "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "HTTP 404")
}

func TestFetchDiscovery_ContextCancellation(t *testing.T) {
	var serverURL string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(5 * time.Second)
		_, _ = w.Write([]byte(validDiscoveryJSON(serverURL, "https://auth.example.com/token")))
	}))
	defer server.Close()
	serverURL = server.URL

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	_, err := FetchDiscovery(ctx, server.URL, "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "cannot reach OIDC provider")
}

func TestFetchDiscovery_CustomCABundle(t *testing.T) {
	// Generate a self-signed CA cert
	caKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)

	caTemplate := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "Test CA"},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(time.Hour),
		IsCA:                  true,
		BasicConstraintsValid: true,
		KeyUsage:              x509.KeyUsageCertSign,
	}

	caCertDER, err := x509.CreateCertificate(rand.Reader, caTemplate, caTemplate, &caKey.PublicKey, caKey)
	require.NoError(t, err)

	// Generate a server cert signed by the CA
	serverKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)

	serverTemplate := &x509.Certificate{
		SerialNumber: big.NewInt(2),
		Subject:      pkix.Name{CommonName: "localhost"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(time.Hour),
		DNSNames:     []string{"localhost"},
		IPAddresses:  []net.IP{net.IPv4(127, 0, 0, 1)},
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}

	caCert, err := x509.ParseCertificate(caCertDER)
	require.NoError(t, err)

	serverCertDER, err := x509.CreateCertificate(rand.Reader, serverTemplate, caCert, &serverKey.PublicKey, caKey)
	require.NoError(t, err)

	// Write CA cert PEM to temp file
	caFile := filepath.Join(t.TempDir(), "ca.pem")
	caPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: caCertDER})
	require.NoError(t, os.WriteFile(caFile, caPEM, 0o600))

	// Create TLS server using the server cert
	serverCertPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: serverCertDER})
	serverKeyDER, err := x509.MarshalECPrivateKey(serverKey)
	require.NoError(t, err)
	serverKeyPEM := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: serverKeyDER})

	serverTLSCert, err := tls.X509KeyPair(serverCertPEM, serverKeyPEM)
	require.NoError(t, err)

	var serverURL string
	server := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		doc := DiscoveryDocument{
			Issuer:                serverURL,
			AuthorizationEndpoint: "https://127.0.0.1/auth",
			TokenEndpoint:         "https://127.0.0.1/token",
			JWKSURI:               "https://127.0.0.1/keys",
		}
		data, _ := json.Marshal(doc)
		_, _ = w.Write(data)
	}))
	server.TLS = &tls.Config{Certificates: []tls.Certificate{serverTLSCert}}
	server.StartTLS()
	defer server.Close()
	serverURL = server.URL

	// Without custom CA: should fail
	_, err = FetchDiscovery(context.Background(), server.URL, "")
	require.Error(t, err)

	// With custom CA: should succeed
	doc, err := FetchDiscovery(context.Background(), server.URL, caFile)
	require.NoError(t, err)
	assert.Equal(t, "https://127.0.0.1/token", doc.TokenEndpoint)
}

func TestFetchDiscovery_InvalidCABundlePath(t *testing.T) {
	_, err := FetchDiscovery(context.Background(), "https://example.com", "/nonexistent/ca.pem")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "read custom CA bundle")
}

func TestFetchDiscovery_InvalidCABundleContent(t *testing.T) {
	caFile := filepath.Join(t.TempDir(), "bad-ca.pem")
	require.NoError(t, os.WriteFile(caFile, []byte("not a PEM certificate"), 0o600))

	_, err := FetchDiscovery(context.Background(), "https://example.com", caFile)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no valid PEM certificates")
}
