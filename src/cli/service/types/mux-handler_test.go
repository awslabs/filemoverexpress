package types

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func okHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
}

func TestResponseHeader_EchoesAllowedOrigin(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "http://127.0.0.1/x", nil)
	req.Header.Set("Origin", "http://wails.localhost")

	NewResponseHeader(okHandler()).ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://wails.localhost" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want the echoed allowed origin", got)
	}
	if got := rec.Header().Get("Access-Control-Allow-Credentials"); got != "true" {
		t.Fatalf("Access-Control-Allow-Credentials = %q, want true", got)
	}
	if got := rec.Header().Values("Vary"); len(got) == 0 || got[0] != "Origin" {
		t.Fatalf("Vary = %v, want it to include Origin", got)
	}
}

func TestResponseHeader_RejectsUnknownOrigin(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodOptions, "http://127.0.0.1/x", nil)
	req.Header.Set("Origin", "http://wails.localhost.attacker.example")

	NewResponseHeader(okHandler()).ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want empty for a disallowed origin", got)
	}
	if got := rec.Header().Get("Access-Control-Allow-Credentials"); got != "" {
		t.Fatalf("Access-Control-Allow-Credentials = %q, want empty for a disallowed origin", got)
	}
	// Vary: Origin must be set even when the origin is NOT allowed, so a shared
	// cache never serves this no-Allow-Origin response to a different origin.
	if got := rec.Header().Values("Vary"); len(got) == 0 || got[0] != "Origin" {
		t.Fatalf("Vary = %v, want it to include Origin even for a disallowed origin", got)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("OPTIONS status = %d, want 200", rec.Code)
	}
}
