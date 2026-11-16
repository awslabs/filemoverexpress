package notifications

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSecretStore_RoundTrip(t *testing.T) {
	s := NewSecretStore(filepath.Join(t.TempDir(), "notifications"))
	const (
		name = "My Slack"
		url  = "https://hooks.example.com/services/abc"
	)
	if err := s.Save(name, url); err != nil {
		t.Fatalf("Save: %v", err)
	}
	if !s.Has(name) {
		t.Fatal("Has = false after Save")
	}
	got, err := s.Load(name)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if got != url {
		t.Fatalf("Load = %q, want %q", got, url)
	}
	if err := s.Delete(name); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if s.Has(name) {
		t.Fatal("Has = true after Delete")
	}
}

// TestSecretStore_RejectsTraversalName is the regression test for the reported
// path traversal: a destination name must never resolve to a file outside the
// notification directory (such as the OIDC token cache in a sibling directory).
func TestSecretStore_RejectsTraversalName(t *testing.T) {
	root := t.TempDir()
	outside := filepath.Join(root, "oidc-tokens")
	if err := os.MkdirAll(outside, 0o700); err != nil {
		t.Fatal(err)
	}
	const sentinel = "SENSITIVE-TOKEN-BYTES"
	if err := os.WriteFile(filepath.Join(outside, "prod.enc"), []byte(sentinel), 0o600); err != nil {
		t.Fatal(err)
	}

	s := NewSecretStore(filepath.Join(root, "notifications"))

	for _, name := range []string{"../oidc-tokens/prod", `..\oidc-tokens\prod`, "a/b", "x..y", ""} {
		if got, err := s.Load(name); err == nil {
			t.Errorf("Load(%q) = (%q, nil), want rejection", name, got)
		}
		if err := s.Save(name, "https://x.example.com/y"); err == nil {
			t.Errorf("Save(%q) = nil, want rejection", name)
		}
		if s.Has(name) {
			t.Errorf("Has(%q) = true, want false", name)
		}
		if err := s.Delete(name); err != nil {
			t.Errorf("Delete(%q) = %v, want nil no-op", name, err)
		}
	}

	// The sentinel file outside the store must be untouched.
	if b, err := os.ReadFile(filepath.Join(outside, "prod.enc")); err != nil || string(b) != sentinel {
		t.Fatalf("sentinel changed: %q err=%v", b, err)
	}
}
