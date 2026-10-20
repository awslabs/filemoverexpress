package notifications

import (
	"context"
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
	good := []string{"My Slack DM", "ingest", "post-crew_1"}
	for _, name := range good {
		if err := ValidateDestinationName(name); err != nil {
			t.Errorf("expected %q to be valid, got %v", name, err)
		}
	}
	bad := []string{"", "   ", "../escape", "a/b", `a\b`, "x..y"}
	for _, name := range bad {
		if err := ValidateDestinationName(name); err == nil {
			t.Errorf("expected %q to be rejected, got nil", name)
		}
	}
}
