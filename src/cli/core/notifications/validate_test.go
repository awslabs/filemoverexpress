package notifications

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
)

func TestValidateWebhookURL_RejectsNonHTTPS(t *testing.T) {
	cases := []string{
		"http://hooks.slack.com/services/x",
		"ftp://example.com/x",
		"ws://example.com/x",
	}
	for _, raw := range cases {
		if err := ValidateWebhookURL(context.Background(), raw); err == nil {
			t.Errorf("expected %q to be rejected (not https), got nil", raw)
		}
	}
}

func TestValidateWebhookURL_RejectsInternalAndMetadata(t *testing.T) {
	// Literal IPs are checked without DNS, so these are deterministic offline.
	cases := []string{
		"https://127.0.0.1/hook",
		"https://10.0.0.5/hook",
		"https://192.168.1.10/hook",
		"https://169.254.169.254/latest/meta-data",
		"https://[::1]/hook",
		"https://0.0.0.0/hook",
	}
	for _, raw := range cases {
		if err := ValidateWebhookURL(context.Background(), raw); err == nil {
			t.Errorf("expected %q to be rejected as internal/metadata, got nil", raw)
		}
	}
}

func TestValidateWebhookURL_AllowsPublicLiteral(t *testing.T) {
	// A public literal IP passes the IP checks without DNS.
	if err := ValidateWebhookURL(context.Background(), "https://93.184.216.34/hook"); err != nil {
		t.Errorf("expected public literal IP to pass, got %v", err)
	}
}

func TestValidateDestinationName(t *testing.T) {
	good := []string{
		"My Slack DM", "ingest", "post-crew_1", "a.b-c_d",
		"v1..2",                  // dots mid-name are fine: the allowlist contains them, nothing escapes
		strings.Repeat("a", 128), // at the length cap
	}
	for _, name := range good {
		if err := ValidateDestinationName(name); err != nil {
			t.Errorf("expected %q to be valid, got %v", name, err)
		}
	}
	bad := []string{
		"", "   ", // empty / whitespace
		"../escape", "a/b", `a\b`, // path separators / traversal
		"a:b",                // NTFS alternate data stream separator
		"a\x00b",             // NUL
		"a(b)", "a!b", "a@b", // punctuation outside the allowlist
		".lead", "trail.", " lead", "trail ", // leading/trailing dot or space
		"CON", "nul", "Lpt1", "Com9", // Windows reserved device names, any case
		"con.x", "NUL.backup", "COM1.txt", // reserved device name with an extension
		strings.Repeat("a", 129), // over the length cap
	}
	for _, name := range bad {
		if err := ValidateDestinationName(name); err == nil {
			t.Errorf("expected %q to be rejected, got nil", name)
		}
	}
}

func TestValidateWebhookURL_PublicClassification(t *testing.T) {
	// Scheme and missing-host failures are user-fixable and secret-free, so they
	// are marked public (the message is surfaced to a settings client).
	schemeErr := ValidateWebhookURL(context.Background(), "http://hooks.slack.com/x")
	if msg, ok := PublicMessage(schemeErr); !ok || msg != "webhook url must use https" {
		t.Fatalf("scheme error public=%v msg=%q, want public with https message", ok, msg)
	}

	// An internal target is public but SANITIZED: the client must not see the
	// resolved address, while the daemon log (Error()) keeps it.
	internalErr := ValidateWebhookURL(context.Background(), "https://10.0.0.5/hook")
	msg, ok := PublicMessage(internalErr)
	if !ok {
		t.Fatal("internal-host error should be public")
	}
	if strings.Contains(msg, "10.0.0.5") {
		t.Fatalf("public message leaked the resolved IP: %q", msg)
	}
	if !strings.Contains(internalErr.Error(), "10.0.0.5") {
		t.Fatalf("daemon-log detail should keep the IP, got %q", internalErr.Error())
	}
}

func TestValidateWebhookURL_ParseErrorIsPublicButRedacted(t *testing.T) {
	// A malformed URL is user-fixable, so the parse failure is public (the user
	// should see the URL is bad). The reason is still redacted: decrypted non-URL
	// bytes (the reported token-echo path) never appear in the message or detail.
	tokenJSON := `{"refresh_token":"REAL-REFRESH-TOKEN"}`
	err := ValidateWebhookURL(context.Background(), tokenJSON)
	if err == nil {
		t.Fatal("expected token JSON to be rejected as an invalid URL")
	}
	msg, ok := PublicMessage(err)
	if !ok {
		t.Fatalf("a parse failure should be public so the user learns the URL is bad, got %q", err)
	}
	if !strings.Contains(msg, "invalid webhook url") {
		t.Fatalf("parse failure lost its context: %q", msg)
	}
	if strings.Contains(msg, "REAL-REFRESH-TOKEN") || strings.Contains(err.Error(), "REAL-REFRESH-TOKEN") {
		t.Fatalf("parse failure leaked the raw bytes: public=%q detail=%q", msg, err.Error())
	}
}

func TestPublicMessage(t *testing.T) {
	// A wrapped PublicError is still found through the error chain.
	pe := newPublicError(errors.New("webhook url must use https"))
	wrapped := fmt.Errorf("send test: %w", pe)
	if msg, ok := PublicMessage(wrapped); !ok || msg != "webhook url must use https" {
		t.Fatalf("wrapped public error: ok=%v msg=%q", ok, msg)
	}
	// A plain error is never public.
	if _, ok := PublicMessage(errors.New("connection refused")); ok {
		t.Fatal("plain error should not be public")
	}
}
