package types

import "testing"

// TestValidateOrigin_BuiltInOrigins verifies the built-in allowlist, including
// the macOS WKWebView origin (wails://localhost) added for issue #10, and that
// unknown origins are rejected.
func TestValidateOrigin_BuiltInOrigins(t *testing.T) {
	interceptor := &OriginInterceptor{}

	cases := []struct {
		origin string
		want   bool
	}{
		{"wails://localhost", true},
		{"wails://wails.localhost", true},
		{"http://wails.localhost", true},
		{"wails://wails", true},
		{"https://evil.example.com", false},
		{"", false},
	}

	for _, c := range cases {
		if got := interceptor.validateOrigin(c.origin, "127.0.0.1:1234"); got != c.want {
			t.Errorf("validateOrigin(%q) = %v, want %v", c.origin, got, c.want)
		}
	}
}
