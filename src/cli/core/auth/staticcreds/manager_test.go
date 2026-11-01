package staticcreds

import (
	"os"
	"path/filepath"
	"testing"
)

func TestManagerRoundTrip(t *testing.T) {
	dir := t.TempDir()
	m := NewManagerWithDir(dir)

	const profile = "studio-dailies"
	want := StaticCredentials{
		AccessKeyID:     "AKIAEXAMPLE1234567890",
		SecretAccessKey: "supersecretvalue",
		SessionToken:    "FwoGZXIvYXdzEExampleSessionToken==",
	}

	if m.Has(profile) {
		t.Fatalf("Has reported true before any credentials were stored")
	}

	if err := m.Create(profile, want); err != nil {
		t.Fatalf("Create: %v", err)
	}

	if !m.Has(profile) {
		t.Fatalf("Has reported false after Create")
	}

	// The on-disk file must not contain the plaintext secret.
	raw, err := os.ReadFile(filepath.Join(dir, profile+".enc"))
	if err != nil {
		t.Fatalf("read enc file: %v", err)
	}
	if containsSubslice(raw, []byte(want.SecretAccessKey)) {
		t.Fatalf("plaintext secret found in encrypted file")
	}
	if containsSubslice(raw, []byte(want.SessionToken)) {
		t.Fatalf("plaintext session token found in encrypted file")
	}

	got, err := m.Vend(profile)
	if err != nil {
		t.Fatalf("Vend: %v", err)
	}
	if got != want {
		t.Fatalf("Vend round-trip mismatch: got %+v want %+v", got, want)
	}

	// Update replaces the secret.
	updated := StaticCredentials{AccessKeyID: "AKIAEXAMPLE", SecretAccessKey: "rotatedsecret"}
	if err := m.Update(profile, updated); err != nil {
		t.Fatalf("Update: %v", err)
	}
	got, err = m.Vend(profile)
	if err != nil {
		t.Fatalf("Vend after Update: %v", err)
	}
	if got != updated {
		t.Fatalf("Update did not replace secret: got %+v", got)
	}

	if err := m.Delete(profile); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if m.Has(profile) {
		t.Fatalf("Has reported true after Delete")
	}
	if err := m.Delete(profile); err != nil {
		t.Fatalf("Delete of missing profile should be a no-op, got: %v", err)
	}
}

func TestManagerRejectsBadInput(t *testing.T) {
	m := NewManagerWithDir(t.TempDir())

	if err := m.Create("", StaticCredentials{AccessKeyID: "a", SecretAccessKey: "b"}); err == nil {
		t.Errorf("Create with empty profile name should fail")
	}
	if err := m.Create("p", StaticCredentials{AccessKeyID: "", SecretAccessKey: "b"}); err == nil {
		t.Errorf("Create with empty access key id should fail")
	}
	if err := m.Create("p", StaticCredentials{AccessKeyID: "a", SecretAccessKey: ""}); err == nil {
		t.Errorf("Create with empty secret should fail")
	}

	// Path traversal attempts must be rejected before touching the filesystem.
	for _, bad := range []string{"../escape", "a/b", `a\b`, ".."} {
		if err := m.Create(bad, StaticCredentials{AccessKeyID: "a", SecretAccessKey: "b"}); err == nil {
			t.Errorf("Create with traversal name %q should fail", bad)
		}
		if _, err := m.Vend(bad); err == nil {
			t.Errorf("Vend with traversal name %q should fail", bad)
		}
		if m.Has(bad) {
			t.Errorf("Has with traversal name %q should be false", bad)
		}
	}
}

func TestMaskedAccessKeyID(t *testing.T) {
	m := NewManagerWithDir(t.TempDir())

	// No stored credentials -> empty mask.
	if got := m.MaskedAccessKeyID("missing"); got != "" {
		t.Errorf("MaskedAccessKeyID for missing profile = %q, want \"\"", got)
	}

	const profile = "p"
	const id = "AKIAIOSFODNN7EXAMPLE"
	if err := m.Create(profile, StaticCredentials{AccessKeyID: id, SecretAccessKey: "s"}); err != nil {
		t.Fatalf("Create: %v", err)
	}

	got := m.MaskedAccessKeyID(profile)
	// First and last 4 characters preserved; full id must NOT be returned.
	if got == id {
		t.Fatalf("MaskedAccessKeyID returned the full id")
	}
	if got[:4] != id[:4] || got[len(got)-4:] != id[len(id)-4:] {
		t.Errorf("MaskedAccessKeyID = %q, want first4=%q last4=%q", got, id[:4], id[len(id)-4:])
	}
	if !containsSubslice([]byte(got), []byte("\u2022")) {
		t.Errorf("MaskedAccessKeyID = %q, expected bullet characters in the middle", got)
	}
}

// TestVendDoesNotDeleteOnCorruptFile asserts the dangerous branch: a present-but-undecryptable file
// (truncated write, machine-id change, tampering) must surface an error WITHOUT deleting the file,
// so a transient fault never destroys the user's only stored secret.
func TestVendDoesNotDeleteOnCorruptFile(t *testing.T) {
	dir := t.TempDir()
	m := NewManagerWithDir(dir)

	const profile = "corrupt"
	if err := m.Create(profile, StaticCredentials{AccessKeyID: "AKIAEXAMPLE1234567890", SecretAccessKey: "s"}); err != nil {
		t.Fatalf("Create: %v", err)
	}
	path := filepath.Join(dir, profile+".enc")

	// Overwrite with garbage that cannot be decrypted.
	if err := os.WriteFile(path, []byte("not a valid ciphertext"), 0o600); err != nil {
		t.Fatalf("corrupt file: %v", err)
	}

	if _, err := m.Vend(profile); err == nil {
		t.Fatalf("Vend on corrupt file should error")
	}
	// The file must still be present - Vend must not delete it.
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("Vend deleted the credential file on a decrypt error: %v", err)
	}
}

// TestProfileBindingRejectsSwappedFile asserts the ciphertext is bound to its profile: a blob
// written for profile A fails to open when placed at profile B's path (file-swap attack), while the
// original profile still decrypts.
func TestProfileBindingRejectsSwappedFile(t *testing.T) {
	dir := t.TempDir()
	m := NewManagerWithDir(dir)

	const alpha, beta = "alpha", "beta"
	if err := m.Create(alpha, StaticCredentials{AccessKeyID: "AKIAALPHA1234567890", SecretAccessKey: "alpha-secret"}); err != nil {
		t.Fatalf("Create alpha: %v", err)
	}

	// Swap alpha's encrypted bytes onto beta's path.
	alphaBytes, err := os.ReadFile(filepath.Join(dir, alpha+".enc"))
	if err != nil {
		t.Fatalf("read alpha: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, beta+".enc"), alphaBytes, 0o600); err != nil {
		t.Fatalf("write beta: %v", err)
	}

	if _, err := m.Vend(beta); err == nil {
		t.Fatalf("Vend(beta) on alpha's swapped ciphertext should fail (profile binding)")
	}
	// The legitimate profile must still open.
	if _, err := m.Vend(alpha); err != nil {
		t.Fatalf("Vend(alpha) should still succeed after the swap: %v", err)
	}
}

// TestMaskAccessKeyIDEdgeCases covers maskAccessKeyID directly: empty input, and short inputs that
// must never be returned verbatim (no partial leak of a short id).
func TestMaskAccessKeyIDEdgeCases(t *testing.T) {
	if got := maskAccessKeyID(""); got != "" {
		t.Errorf("maskAccessKeyID(\"\") = %q, want \"\"", got)
	}

	// Inputs of length <= maskKeepChars*2 (8) must be fully masked, never partially revealed.
	for _, short := range []string{"a", "AKIA", "AKIA1234"} {
		got := maskAccessKeyID(short)
		if got == short {
			t.Errorf("maskAccessKeyID(%q) returned the input verbatim", short)
		}
		if containsSubslice([]byte(got), []byte(short)) {
			t.Errorf("maskAccessKeyID(%q) = %q leaked the raw short id", short, got)
		}
	}

	// A normal-length id keeps first and last maskKeepChars and masks the middle.
	const id = "AKIAIOSFODNN7EXAMPLE"
	got := maskAccessKeyID(id)
	if got[:maskKeepChars] != id[:maskKeepChars] || got[len(got)-maskKeepChars:] != id[len(id)-maskKeepChars:] {
		t.Errorf("maskAccessKeyID(%q) = %q, want first/last %d chars preserved", id, got, maskKeepChars)
	}
	if got == id {
		t.Errorf("maskAccessKeyID(%q) returned the full id", id)
	}
}

func containsSubslice(haystack, needle []byte) bool {
	if len(needle) == 0 {
		return true
	}
	for i := 0; i+len(needle) <= len(haystack); i++ {
		match := true
		for j := range needle {
			if haystack[i+j] != needle[j] {
				match = false
				break
			}
		}
		if match {
			return true
		}
	}
	return false
}
