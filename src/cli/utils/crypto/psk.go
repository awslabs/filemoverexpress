package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
)

// deriveKey hashes the secret to produce a 32-byte AES-256 key.
func deriveKey(secret string) []byte {
	h := sha256.Sum256([]byte(secret))
	return h[:]
}

// EncryptPSK encrypts rawValue using AES-GCM with the given secret
// and returns the result as a base64-encoded string.
func EncryptPSK(secret string, rawValue string) (string, error) {
	block, err := aes.NewCipher(deriveKey(secret))
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("failed to generate nonce: %w", err)
	}

	// Seal appends the encrypted+authenticated ciphertext after the nonce
	ciphertext := gcm.Seal(nonce, nonce, []byte(rawValue), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// DecryptPSK decodes a base64-encoded ciphertext and decrypts it
// using AES-GCM with the given secret.
func DecryptPSK(secret string, encryptedValue string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(encryptedValue)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64: %w", err)
	}

	block, err := aes.NewCipher(deriveKey(secret))
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt: %w", err)
	}

	return string(plaintext), nil
}
