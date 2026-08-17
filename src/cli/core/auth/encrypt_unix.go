//go:build !windows

package auth

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"fmt"
	"io"
	"os"
	"strconv"

	"golang.org/x/crypto/hkdf"

	"github.com/denisbrodbeck/machineid"
)

// encryptData encrypts plaintext using AES-256-GCM with a key derived from machine-specific entropy.
func encryptData(plaintext []byte) ([]byte, error) {
	key, err := deriveEncryptionKey()
	if err != nil {
		return nil, fmt.Errorf("derive encryption key: %w", err)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("create AES cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create GCM: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("generate nonce: %w", err)
	}

	// Prepend nonce to ciphertext
	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
	return ciphertext, nil
}

// decryptData decrypts AES-256-GCM encrypted data using a key derived from machine-specific entropy.
func decryptData(encrypted []byte) ([]byte, error) {
	key, err := deriveEncryptionKey()
	if err != nil {
		return nil, fmt.Errorf("derive encryption key: %w", err)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("create AES cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create GCM: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(encrypted) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertext := encrypted[:nonceSize], encrypted[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("GCM decrypt: %w", err)
	}

	return plaintext, nil
}

// deriveEncryptionKey derives a 32-byte AES key from machine ID + UID via HKDF-SHA256.
func deriveEncryptionKey() ([]byte, error) {
	machineID, err := machineid.ProtectedID("fme-oidc-token-cache")
	if err != nil {
		return nil, fmt.Errorf("get machine ID: %w", err)
	}

	uid := strconv.Itoa(os.Getuid())
	ikm := []byte(machineID + uid)

	hkdfReader := hkdf.New(sha256.New, ikm, []byte("fme-oidc-cache-salt"), []byte("fme-oidc-aes256-key"))
	key := make([]byte, 32)
	if _, err := io.ReadFull(hkdfReader, key); err != nil {
		return nil, fmt.Errorf("HKDF expand: %w", err)
	}

	return key, nil
}
