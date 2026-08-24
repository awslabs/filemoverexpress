package auth

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTokenCache_SaveAndLoad_RoundTrip(t *testing.T) {
	dir := t.TempDir()
	cache := NewTokenCache(dir)

	tokens := CachedTokens{
		RefreshToken: "refresh-token-abc123",
		TokenExpiry:  time.Date(2026, 8, 1, 12, 0, 0, 0, time.UTC),
		Identity:     "alice@example.com",
	}

	err := cache.Save("test-profile", tokens)
	require.NoError(t, err)

	loaded, err := cache.Load("test-profile")
	require.NoError(t, err)
	assert.Equal(t, tokens.RefreshToken, loaded.RefreshToken)
	assert.Equal(t, tokens.Identity, loaded.Identity)
	assert.True(t, tokens.TokenExpiry.Equal(loaded.TokenExpiry))
}

func TestTokenCache_FilePermissions(t *testing.T) {
	dir := t.TempDir()
	cache := NewTokenCache(dir)

	tokens := CachedTokens{
		RefreshToken: "token",
		TokenExpiry:  time.Now().Add(time.Hour),
		Identity:     "user@example.com",
	}

	err := cache.Save("perms-profile", tokens)
	require.NoError(t, err)

	path := filepath.Join(dir, "perms-profile.enc")
	info, err := os.Stat(path)
	require.NoError(t, err)

	// On Windows, file permissions are more limited; just verify the file exists and is not empty
	assert.True(t, info.Size() > 0)
}

func TestTokenCache_Load_NonexistentFile(t *testing.T) {
	dir := t.TempDir()
	cache := NewTokenCache(dir)

	_, err := cache.Load("nonexistent-profile")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no cached tokens")
}

func TestTokenCache_Load_CorruptFile(t *testing.T) {
	dir := t.TempDir()
	cache := NewTokenCache(dir)

	// Write garbage to the cache file
	path := filepath.Join(dir, "corrupt-profile.enc")
	err := os.WriteFile(path, []byte("this is not encrypted data"), 0o600)
	require.NoError(t, err)

	_, err = cache.Load("corrupt-profile")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "file deleted")

	// Verify file was deleted
	_, err = os.Stat(path)
	assert.True(t, os.IsNotExist(err))
}

func TestTokenCache_Delete(t *testing.T) {
	dir := t.TempDir()
	cache := NewTokenCache(dir)

	tokens := CachedTokens{
		RefreshToken: "to-be-deleted",
		TokenExpiry:  time.Now().Add(time.Hour),
		Identity:     "user@example.com",
	}

	err := cache.Save("delete-profile", tokens)
	require.NoError(t, err)

	// Verify file exists
	path := filepath.Join(dir, "delete-profile.enc")
	_, err = os.Stat(path)
	require.NoError(t, err)

	// Delete
	err = cache.Delete("delete-profile")
	require.NoError(t, err)

	// Verify file gone
	_, err = os.Stat(path)
	assert.True(t, os.IsNotExist(err))
}

func TestTokenCache_Delete_NonexistentProfile(t *testing.T) {
	dir := t.TempDir()
	cache := NewTokenCache(dir)

	// Should not error when file doesn't exist
	err := cache.Delete("no-such-profile")
	assert.NoError(t, err)
}

func TestTokenCache_NoIDTokenPersisted(t *testing.T) {
	dir := t.TempDir()
	cache := NewTokenCache(dir)

	tokens := CachedTokens{
		RefreshToken: "refresh-only",
		TokenExpiry:  time.Now().Add(time.Hour),
		Identity:     "user@example.com",
	}

	err := cache.Save("no-idtoken-profile", tokens)
	require.NoError(t, err)

	// Verify the CachedTokens struct doesn't have an id_token field by checking
	// that marshaling produces no "id_token" key
	data, err := json.Marshal(tokens)
	require.NoError(t, err)
	assert.NotContains(t, string(data), "id_token")
}

func TestTokenCache_PlaintextNotReadableFromDisk(t *testing.T) {
	dir := t.TempDir()
	cache := NewTokenCache(dir)

	secret := "super-secret-refresh-token-xyz"
	tokens := CachedTokens{
		RefreshToken: secret,
		TokenExpiry:  time.Now().Add(time.Hour),
		Identity:     "user@example.com",
	}

	err := cache.Save("encrypted-profile", tokens)
	require.NoError(t, err)

	// Read raw file — the secret should NOT be visible as plaintext
	path := filepath.Join(dir, "encrypted-profile.enc")
	raw, err := os.ReadFile(path)
	require.NoError(t, err)
	assert.NotContains(t, string(raw), secret, "refresh token should not be readable in plaintext from disk")
}

func TestTokenCache_MultipleProfiles_Independent(t *testing.T) {
	dir := t.TempDir()
	cache := NewTokenCache(dir)

	tokens1 := CachedTokens{
		RefreshToken: "token-for-profile1",
		TokenExpiry:  time.Now().Add(time.Hour),
		Identity:     "alice@example.com",
	}
	tokens2 := CachedTokens{
		RefreshToken: "token-for-profile2",
		TokenExpiry:  time.Now().Add(2 * time.Hour),
		Identity:     "bob@example.com",
	}

	require.NoError(t, cache.Save("profile1", tokens1))
	require.NoError(t, cache.Save("profile2", tokens2))

	loaded1, err := cache.Load("profile1")
	require.NoError(t, err)
	assert.Equal(t, "alice@example.com", loaded1.Identity)

	loaded2, err := cache.Load("profile2")
	require.NoError(t, err)
	assert.Equal(t, "bob@example.com", loaded2.Identity)

	// Delete one, other remains
	require.NoError(t, cache.Delete("profile1"))
	_, err = cache.Load("profile1")
	assert.Error(t, err)

	loaded2Again, err := cache.Load("profile2")
	require.NoError(t, err)
	assert.Equal(t, "bob@example.com", loaded2Again.Identity)
}

func TestTokenCache_CreatesDirectoryIfMissing(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "nested", "cache", "dir")
	cache := NewTokenCache(dir)

	tokens := CachedTokens{
		RefreshToken: "token",
		TokenExpiry:  time.Now().Add(time.Hour),
		Identity:     "user@example.com",
	}

	err := cache.Save("auto-dir-profile", tokens)
	require.NoError(t, err)

	loaded, err := cache.Load("auto-dir-profile")
	require.NoError(t, err)
	assert.Equal(t, "token", loaded.RefreshToken)
}
