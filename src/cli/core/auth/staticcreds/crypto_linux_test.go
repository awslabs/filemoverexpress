//go:build linux

package staticcreds

import (
	"bytes"
	"testing"
)

// These tests cover the hardware-free logic in the Linux TPM path (crypto_linux.go): the sealed-seed
// blob framing used to persist and reload a sealed seed, and the fallback to machine-ID derivation
// when no TPM device is present. The TPM Seal/Unseal commands themselves require a real TPM (or a
// software emulator) and are validated on hardware before the release tag.

func TestSealedBlobEncodeDecodeRoundTrip(t *testing.T) {
	cases := []struct {
		name      string
		pub, priv []byte
	}{
		{"typical", []byte("marshalled-public-portion"), []byte("marshalled-private-portion")},
		{"empty-both", []byte{}, []byte{}},
		{"empty-priv", []byte{0x00, 0x01, 0x02, 0x03}, []byte{}},
		{"large-priv", []byte{0xAB}, bytes.Repeat([]byte{0x5A}, 300)},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			blob := encodeSealedBlob(c.pub, c.priv)
			pub, priv, err := decodeSealedBlob(blob)
			if err != nil {
				t.Fatalf("decodeSealedBlob: %v", err)
			}
			if !bytes.Equal(pub, c.pub) {
				t.Fatalf("pub round-trip: got %q want %q", pub, c.pub)
			}
			if !bytes.Equal(priv, c.priv) {
				t.Fatalf("priv round-trip: got %q want %q", priv, c.priv)
			}
		})
	}
}

func TestDecodeSealedBlobRejectsTruncated(t *testing.T) {
	good := encodeSealedBlob([]byte("pub"), []byte("priv"))
	cases := map[string][]byte{
		"empty":            {},
		"shorter-than-hdr": {0x00, 0x00, 0x00},
		"header-only-cut":  good[:2],
		"pub-len-overruns": good[:6],           // declares pubLen=3 but only 2 bytes follow
		"priv-cut":         good[:len(good)-2], // priv length declared longer than remaining
	}
	for name, blob := range cases {
		t.Run(name, func(t *testing.T) {
			if _, _, err := decodeSealedBlob(blob); err == nil {
				t.Fatalf("truncated blob %q must be rejected", name)
			}
		})
	}
}

func TestPreferredKeyFallsBackToMachineIDWithoutTPM(t *testing.T) {
	if tpmDevicePath() != "" {
		t.Skip("a TPM device is present; the no-TPM fallback path is not exercised on this host")
	}
	method, key, err := preferredKey(true)
	if err != nil {
		t.Fatalf("preferredKey: %v", err)
	}
	if method != methodMachineID {
		t.Fatalf("without a TPM, preferredKey must fall back to methodMachineID, got %d", method)
	}
	if len(key) != aes256KeySize {
		t.Fatalf("fallback key length = %d, want %d", len(key), aes256KeySize)
	}
}
