package notifications

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"syscall"
	"time"
)

const (
	sendTimeout      = 15 * time.Second
	maxResponseBytes = 4096
	httpRedirectMin  = 300
)

// ssrfSafeTransport returns an http.Transport whose dialer re-checks the ACTUAL
// IP being connected to against checkIPAllowed, right before the socket connects.
// ValidateWebhookURL resolves and checks the host up front, but the transport
// resolves again independently at dial time, so a hostname that answers with a
// public IP during validation and a private IP on the dial (DNS rebind / TOCTOU)
// would otherwise slip through. The Control hook runs per connection attempt on
// the resolved address, so the IP we validate is exactly the IP we connect to.
func ssrfSafeTransport() *http.Transport {
	dialer := &net.Dialer{
		Timeout:   sendTimeout,
		KeepAlive: sendTimeout,
		Control: func(_, address string, _ syscall.RawConn) error {
			return checkDialAddress(address)
		},
	}
	return &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		DialContext:           dialer.DialContext,
		ForceAttemptHTTP2:     true,
		TLSHandshakeTimeout:   sendTimeout,
		ExpectContinueTimeout: time.Second,
	}
}

// checkDialAddress re-runs the SSRF guard against the actual host:port the dialer
// is about to connect to. It is the dial-time half of the TOCTOU fix: the IP here
// is the one the socket will use, so a rebind to a non-routable address between
// validation and dial is caught.
func checkDialAddress(address string) error {
	host, _, err := net.SplitHostPort(address)
	if err != nil {
		return fmt.Errorf("parse dial address %q: %w", address, err)
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return fmt.Errorf("dial address %q is not an IP", address)
	}
	return checkIPAllowed(ip)
}

// postWebhook validates the URL and POSTs the body. It re-validates on every call
// (the stored URL is trusted but cheap to re-check), refuses to follow redirects,
// and pins the dial to a re-checked IP so a 200-returning public URL cannot bounce
// or rebind the request to an internal address after the SSRF check has passed.
func postWebhook(ctx context.Context, rawURL string, body []byte) error {
	if err := ValidateWebhookURL(ctx, rawURL); err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(ctx, sendTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, rawURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build webhook request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{
		Timeout:   sendTimeout,
		Transport: ssrfSafeTransport(),
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("post webhook: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	_, _ = io.CopyN(io.Discard, resp.Body, maxResponseBytes)

	if resp.StatusCode >= httpRedirectMin {
		return fmt.Errorf("webhook returned status %d", resp.StatusCode)
	}
	return nil
}
