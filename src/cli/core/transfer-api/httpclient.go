package transfer_api

import (
	"net"
	"net/http"
	"time"
)

// Dial and TLS timeouts for the tuned client. These mirror the Go default
// transport so the only behavioral change from the SDK default is the connection
// ceiling and the send-buffer cap.
const (
	tunedDialTimeout           = 30 * time.Second
	tunedKeepAlive             = 30 * time.Second
	tunedIdleConnTimeout       = 90 * time.Second
	tunedTLSHandshakeTimeout   = 10 * time.Second
	tunedExpectContinueTimeout = 1 * time.Second
)

// HTTPClientConfig carries the connection-level tuning applied to the S3 client.
// Both knobs are zero-defaulted, so a zero value yields no custom client and the
// AWS SDK keeps its default transport.
type HTTPClientConfig struct {
	// MaxConnectionsPerHost bounds total simultaneous connections to one host across
	// every active transfer and every multipart part. 0 means no limit. Above the
	// limit the transport blocks (backpressure) instead of opening more sockets.
	MaxConnectionsPerHost int
	// SendBufferBytes caps each socket's send buffer via SO_SNDBUF. 0 leaves the OS
	// default. This is the in-app equivalent of lowering net.inet.tcp.autosndbufmax
	// on macOS, where the kernel network-buffer pool is small and fixed.
	SendBufferBytes int
}

// buildTunedHTTPClient returns an *http.Client whose transport enforces the given
// tuning. It returns nil when no tuning is requested, so callers fall back to the
// AWS SDK's default client. HTTP/2 is disabled so that MaxConnsPerHost is a true
// connection ceiling (one in-flight request per connection), matching how S3 data
// transfers behave over HTTP/1.1.
func buildTunedHTTPClient(cfg HTTPClientConfig) *http.Client {
	if cfg.MaxConnectionsPerHost <= 0 && cfg.SendBufferBytes <= 0 {
		return nil
	}

	dialer := &net.Dialer{
		Timeout:   tunedDialTimeout,
		KeepAlive: tunedKeepAlive,
	}
	if cfg.SendBufferBytes > 0 {
		dialer.Control = sendBufferControl(cfg.SendBufferBytes)
	}

	transport := &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		DialContext:           dialer.DialContext,
		ForceAttemptHTTP2:     false,
		IdleConnTimeout:       tunedIdleConnTimeout,
		TLSHandshakeTimeout:   tunedTLSHandshakeTimeout,
		ExpectContinueTimeout: tunedExpectContinueTimeout,
	}

	if cfg.MaxConnectionsPerHost > 0 {
		transport.MaxConnsPerHost = cfg.MaxConnectionsPerHost
		transport.MaxIdleConns = cfg.MaxConnectionsPerHost
		transport.MaxIdleConnsPerHost = cfg.MaxConnectionsPerHost
	}

	return &http.Client{Transport: transport}
}
