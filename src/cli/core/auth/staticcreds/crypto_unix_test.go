//go:build !windows

package staticcreds

import (
	"bytes"
	"crypto/rand"
	"testing"
)

// These tests cover the method-tagged encryption envelope introduced alongside the TPM work
// (crypto_unix.go). They exercise the parts that need no TPM hardware: the recorded method byte,
// its binding into the GCM AAD (downgrade/tamper protection), rejection of unknown methods and
// truncated blobs, and the guarantee that a TPM-tagged blob cannot be read where no matching
// TPM-sealed seed is available. The actual TPM seal/unseal round-trip needs real hardware and is
// validated separately (see crypto_linux.go).

// sealMachineID builds an envelope exactly as encryptData does for the machine-ID method, without
// going through preferredKey (which would pick the TPM path, and seal a seed, on a TPM host). This
// keeps the envelope tests deterministic and side-effect-free on every platform.
func sealMachineID(t *testing.T, plaintext, aad []byte) []byte {
	t.Helper()
	key, err := deriveMachineIDKey()
	if err != nil {
		t.Fatalf("deriveMachineIDKey: %v", err)
	}
	gcm, err := newGCM(key)
	if err != nil {
		t.Fatalf("newGCM: %v", err)
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		t.Fatalf("nonce: %v", err)
	}
	sealed := gcm.Seal(nonce, nonce, plaintext, bindAAD(aad, methodMachineID))
	return append([]byte{methodMachineID}, sealed...)
}

func TestEnvelopeRoundTrip(t *testing.T) {
	aad := []byte("fme-static-credentials:studio-dailies")
	plaintext := []byte("AKIAEXAMPLE1234567890|supersecretvalue")

	blob := sealMachineID(t, plaintext, aad)
	if blob[0] != methodMachineID {
		t.Fatalf("first byte = %d, want methodMachineID (%d)", blob[0], methodMachineID)
	}

	got, err := decryptData(blob, aad)
	if err != nil {
		t.Fatalf("decryptData: %v", err)
	}
	if !bytes.Equal(got, plaintext) {
		t.Fatalf("round-trip mismatch: got %q want %q", got, plaintext)
	}
}

func TestEnvelopeRejectsWrongAAD(t *testing.T) {
	blob := sealMachineID(t, []byte("secret"), []byte("profile-alpha"))
	if _, err := decryptData(blob, []byte("profile-beta")); err == nil {
		t.Fatalf("decrypt with a different AAD must fail (profile binding)")
	}
}

func TestEnvelopeRejectsFlippedMethodByte(t *testing.T) {
	// The method byte is bound into the GCM AAD, so changing it must break authentication. Flipping
	// machine-ID to TPM also sends decryption down a key-derivation path that has no stored seed
	// (or no TPM at all); either way the result must be a clean error, never a silent mis-decrypt.
	aad := []byte("profile")
	blob := sealMachineID(t, []byte("secret"), aad)
	blob[0] = methodTPM
	if _, err := decryptData(blob, aad); err == nil {
		t.Fatalf("flipping the method byte must fail decryption")
	}
}

func TestDecryptRejectsUnknownMethod(t *testing.T) {
	if _, err := decryptData([]byte{0x7f, 0x01, 0x02, 0x03}, nil); err == nil {
		t.Fatalf("an unknown method byte must be rejected")
	}
}

func TestDecryptRejectsTruncated(t *testing.T) {
	if _, err := decryptData(nil, nil); err == nil {
		t.Fatalf("empty input must be rejected")
	}
	// Method byte present, but no room for a GCM nonce + tag.
	if _, err := decryptData([]byte{methodMachineID, 0x01}, nil); err == nil {
		t.Fatalf("a blob too short for the nonce must be rejected")
	}
}

func TestMethodTPMBlobUnreadableWithoutMatchingTPM(t *testing.T) {
	// A TPM-tagged blob is what a Linux+TPM host writes. Opened where no matching TPM-sealed seed
	// is available - macOS/BSD (no TPM path at all) or a Linux host without the stored seed - it
	// must error rather than mis-derive a key and hand back garbage.
	body := make([]byte, 40)
	if _, err := rand.Read(body); err != nil {
		t.Fatalf("rand: %v", err)
	}
	blob := append([]byte{methodTPM}, body...)
	if _, err := decryptData(blob, nil); err == nil {
		t.Fatalf("a TPM-tagged blob must not decrypt without a matching TPM-sealed seed")
	}
}

func TestDeriveMachineIDKeyIsStableAndRightSize(t *testing.T) {
	k1, err := deriveMachineIDKey()
	if err != nil {
		t.Fatalf("deriveMachineIDKey: %v", err)
	}
	if len(k1) != aes256KeySize {
		t.Fatalf("key length = %d, want %d", len(k1), aes256KeySize)
	}
	k2, err := deriveMachineIDKey()
	if err != nil {
		t.Fatalf("deriveMachineIDKey (second call): %v", err)
	}
	if !bytes.Equal(k1, k2) {
		t.Fatalf("machine-ID key derivation must be deterministic across calls")
	}
}

func TestDeriveKeyRejectsUnknownMethod(t *testing.T) {
	if _, err := deriveKey(0x55, false); err == nil {
		t.Fatalf("deriveKey must reject an unknown method byte")
	}
}

func TestBindAADAppendsMethodWithoutMutatingInput(t *testing.T) {
	aad := []byte("abc")
	original := append([]byte(nil), aad...)

	out := bindAAD(aad, methodTPM)

	if !bytes.Equal(aad, original) {
		t.Fatalf("bindAAD mutated the caller's aad slice: %q", aad)
	}
	if !bytes.Equal(out, append(append([]byte(nil), original...), methodTPM)) {
		t.Fatalf("bindAAD output = %q, want aad with the method byte appended", out)
	}
}
