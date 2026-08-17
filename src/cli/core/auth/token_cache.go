package auth

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

type (
	// CachedTokens holds the data persisted to disk for an OIDC session.
	// The id_token is explicitly NOT persisted — it is re-derived from the refresh token.
	CachedTokens struct {
		RefreshToken string    `json:"refresh_token"`
		TokenExpiry  time.Time `json:"token_expiry"`
		Identity     string    `json:"identity"`
	}

	// TokenCache manages encrypted persistence of OIDC refresh tokens to disk.
	TokenCache struct {
		dir string
	}
)

// NewTokenCache creates a new token cache that stores encrypted files in the given directory.
func NewTokenCache(dir string) *TokenCache {
	return &TokenCache{dir: dir}
}

// Save encrypts and persists the given tokens for the named profile.
func (c *TokenCache) Save(profileName string, tokens CachedTokens) error {
	if err := os.MkdirAll(c.dir, dirPermissions); err != nil {
		return fmt.Errorf("create token cache directory: %w", err)
	}

	plaintext, err := json.Marshal(tokens)
	if err != nil {
		return fmt.Errorf("marshal tokens: %w", err)
	}

	encrypted, err := encryptData(plaintext)
	if err != nil {
		return fmt.Errorf("encrypt tokens: %w", err)
	}

	path := c.filePath(profileName)
	if err := os.WriteFile(path, encrypted, filePermissions); err != nil {
		return fmt.Errorf("write token cache file: %w", err)
	}

	return nil
}

// Load reads and decrypts the cached tokens for the named profile.
func (c *TokenCache) Load(profileName string) (*CachedTokens, error) {
	path := c.filePath(profileName)

	encrypted, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("no cached tokens for profile %q", profileName)
		}
		return nil, fmt.Errorf("read token cache file: %w", err)
	}

	plaintext, err := decryptData(encrypted)
	if err != nil {
		// Corrupt or undecryptable file — delete and return error
		_ = os.Remove(path)
		return nil, fmt.Errorf("decrypt token cache (file deleted): %w", err)
	}

	var tokens CachedTokens
	if err := json.Unmarshal(plaintext, &tokens); err != nil {
		_ = os.Remove(path)
		return nil, fmt.Errorf("parse token cache (file deleted): %w", err)
	}

	return &tokens, nil
}

// Delete removes the cached tokens for the named profile.
func (c *TokenCache) Delete(profileName string) error {
	path := c.filePath(profileName)
	err := os.Remove(path)
	if err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("delete token cache: %w", err)
	}
	return nil
}

func (c *TokenCache) filePath(profileName string) string {
	return filepath.Join(c.dir, profileName+".enc")
}
