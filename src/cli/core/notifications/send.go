package notifications

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	sendTimeout      = 15 * time.Second
	maxResponseBytes = 4096
	httpRedirectMin  = 300
)

// postWebhook validates the URL and POSTs the body. It re-validates on every call
// (the stored URL is trusted but cheap to re-check) and refuses to follow
// redirects, so a 200-returning public URL cannot bounce the request to an
// internal address after the SSRF check has passed.
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
		Timeout: sendTimeout,
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
