package notifications

import (
	"errors"
	"net/url"
	"strings"
	"testing"
)

func TestCheckDialAddress(t *testing.T) {
	cases := []struct {
		name    string
		address string
		wantErr bool
	}{
		{"public IPv4 passes", "93.184.216.34:443", false},
		{"public IPv6 passes", "[2606:2800:220:1:248:1893:25c8:1946]:443", false},
		{"loopback blocked", "127.0.0.1:443", true},
		{"private 10/8 blocked", "10.0.0.5:443", true},
		{"private 192.168 blocked", "192.168.1.10:443", true},
		{"link-local blocked", "169.254.1.1:443", true},
		{"metadata endpoint blocked", "169.254.169.254:443", true},
		{"unspecified blocked", "0.0.0.0:443", true},
		{"missing port errors", "93.184.216.34", true},
		{"non-IP host errors", "example.com:443", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := checkDialAddress(tc.address)
			if tc.wantErr && err == nil {
				t.Fatalf("checkDialAddress(%q) = nil, want error", tc.address)
			}
			if !tc.wantErr && err != nil {
				t.Fatalf("checkDialAddress(%q) = %v, want nil", tc.address, err)
			}
		})
	}
}

func TestSanitizedFailureDetail(t *testing.T) {
	if got := sanitizedFailureDetail(nil); got != "" {
		t.Fatalf("nil error should yield empty detail, got %q", got)
	}
	// A failure detail must not leak the raw error text (which can carry local
	// filesystem paths) to the third-party webhook.
	raw := errString("open /Users/someone/secret/path.mov: permission denied")
	got := sanitizedFailureDetail(raw)
	if got == "" {
		t.Fatal("non-nil error should yield a generic detail, got empty")
	}
	if strings.Contains(got, "secret") || strings.Contains(got, "/Users/") || strings.Contains(got, raw.Error()) {
		t.Fatalf("sanitized detail leaked raw error: %q", got)
	}
}

type errString string

func (e errString) Error() string { return string(e) }

func TestRedactURLError(t *testing.T) {
	const secret = "https://hooks.slack.com/services/T000/B000/XXXXWEBHOOKSECRET"

	// net/http delivery failures arrive as *url.Error with the full URL.
	delivery := &url.Error{Op: "Post", URL: secret, Err: errors.New("connection refused")}
	got := redactURLError(delivery)
	if strings.Contains(got.Error(), "XXXXWEBHOOKSECRET") || strings.Contains(got.Error(), secret) {
		t.Fatalf("redacted delivery error still leaks the URL: %q", got)
	}
	if !strings.Contains(got.Error(), "connection refused") {
		t.Fatalf("redacted delivery error dropped the reason: %q", got)
	}

	// A url.Parse failure on decrypted non-URL bytes (the reported token-echo
	// path) must not surface those bytes either.
	tokenJSON := `{"refresh_token":"REAL-REFRESH-TOKEN","identity":"alice@example.com"}`
	if _, perr := url.Parse(tokenJSON); perr != nil {
		red := redactURLError(perr)
		if strings.Contains(red.Error(), "REAL-REFRESH-TOKEN") {
			t.Fatalf("redacted parse error leaked token bytes: %q", red)
		}
	} else {
		t.Fatal("expected url.Parse to fail on token JSON")
	}

	// Non-url errors pass through unchanged.
	if got := redactURLError(errors.New("boom")); got.Error() != "boom" {
		t.Fatalf("plain error changed: %q", got)
	}
}
