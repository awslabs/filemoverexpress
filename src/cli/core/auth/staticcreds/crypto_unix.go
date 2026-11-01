//go:build !windows

package staticcreds

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"fmt"
	"io"
	"os"
	"strconv"

	"github.com/denisbrodbeck/machineid"
	"golang.org/x/crypto/hkdf"
)

// This mirrors the OIDC token-cache crypto deliberately, but in a SEPARATE key domain: the machine
// ID label and the HKDF salt/info below are specific to static credentials, so a static-credential
// file and an OIDC token file are never readable with the same derived key.
//
// KEY DERIVATION METHODS. The AES-256 key that wraps each credential file can be derived two ways,
// recorded as the first byte of every stored blob so decryption always knows which to use:
//
//	methodMachineID - HKDF from the machine ID + UID. Reconstructable from host data; the baseline.
//	methodTPM       - HKDF from a random seed SEALED to the host's TPM (Linux only, see crypto_linux.go).
//	                  The seed is non-exportable, so the key cannot be reconstructed off the machine.
//
// On encryption the platform picks the strongest available method via preferredKey (TPM when a usable
// chip is present, else machine ID). On decryption the recorded method byte selects the derivation, so
// a file written under one method still opens after the other becomes available (or stops being).
const (
	aes256KeySize = 32

	methodMachineID byte = 0
	methodTPM       byte = 1
)

// encryptData encrypts plaintext with AES-256-GCM. The output is [method byte || nonce || ciphertext].
// aad is bound as GCM additional authenticated data together with the method byte, so neither a
// profile swap nor a flipped method byte can be passed off as valid. The key derivation method is
// chosen by preferredKey (platform-specific).
func encryptData(plaintext, aad []byte) ([]byte, error) {
	method, key, err := preferredKey(true)
	if err != nil {
		return nil, fmt.Errorf("derive encryption key: %w", err)
	}

	gcm, err := newGCM(key)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("generate nonce: %w", err)
	}

	// gcm.Seal prepends the nonce; we additionally prepend the method byte.
	sealed := gcm.Seal(nonce, nonce, plaintext, bindAAD(aad, method))
	return append([]byte{method}, sealed...), nil
}

// decryptData reverses encryptData. The method byte selects the key derivation; aad must match the
// value passed at encryption time.
func decryptData(encrypted, aad []byte) ([]byte, error) {
	if len(encrypted) < 1 {
		return nil, fmt.Errorf("ciphertext too short")
	}
	method, rest := encrypted[0], encrypted[1:]

	key, err := deriveKey(method, false)
	if err != nil {
		return nil, fmt.Errorf("derive decryption key: %w", err)
	}

	gcm, err := newGCM(key)
	if err != nil {
		return nil, err
	}

	nonceSize := gcm.NonceSize()
	if len(rest) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertext := rest[:nonceSize], rest[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, bindAAD(aad, method))
	if err != nil {
		return nil, fmt.Errorf("GCM decrypt: %w", err)
	}

	return plaintext, nil
}

func newGCM(key []byte) (cipher.AEAD, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("create AES cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create GCM: %w", err)
	}
	return gcm, nil
}

// bindAAD returns a fresh slice of aad with the method byte appended, so the method cannot be
// downgraded without failing authentication. A fresh slice avoids mutating the caller's aad.
func bindAAD(aad []byte, method byte) []byte {
	out := make([]byte, 0, len(aad)+1)
	out = append(out, aad...)
	return append(out, method)
}

// deriveKey returns the AES key for a specific recorded method. create is honoured only by the TPM
// method (whether to seal a new seed when none is stored yet); it is ignored for machine-ID.
func deriveKey(method byte, create bool) ([]byte, error) {
	switch method {
	case methodMachineID:
		return deriveMachineIDKey()
	case methodTPM:
		return deriveTPMKey(create)
	default:
		return nil, fmt.Errorf("unknown key derivation method %d", method)
	}
}

// deriveMachineIDKey derives a 32-byte AES key from machine ID + UID via HKDF-SHA256, in the
// static-credentials key domain. This is the baseline method and the fallback when no TPM is usable.
func deriveMachineIDKey() ([]byte, error) {
	machineID, err := machineid.ProtectedID("fme-static-credentials")
	if err != nil {
		return nil, fmt.Errorf("get machine ID: %w", err)
	}

	uid := strconv.Itoa(os.Getuid())
	ikm := []byte(machineID + uid)

	hkdfReader := hkdf.New(sha256.New, ikm, []byte("fme-static-credentials-salt"), []byte("fme-static-credentials-aes256-key"))
	key := make([]byte, aes256KeySize)
	if _, err := io.ReadFull(hkdfReader, key); err != nil {
		return nil, fmt.Errorf("HKDF expand: %w", err)
	}

	return key, nil
}
