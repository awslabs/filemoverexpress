package notifications

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/awslabs/filemoverexpress/core/auth"
)

const (
	secretDirPerm  = 0700
	secretFilePerm = 0600
	secretFileExt  = ".enc"
)

// SecretStore persists webhook URLs encrypted on disk, one file per destination
// name. The URL is a secret: it is never written to configuration.yaml, never
// logged, and never returned over RPC. This satisfies the "credentials never
// leave the endpoint" condition from the security review.
type SecretStore struct {
	dir string
}

// NewSecretStore returns a store rooted at dir (created lazily on first Save).
func NewSecretStore(dir string) *SecretStore {
	return &SecretStore{dir: dir}
}

// path resolves the encrypted-file path for a destination name. The name is
// attacker-influenced (it arrives over RPC), so it is validated and the resolved
// path is confirmed to sit directly inside s.dir. This prevents a crafted name
// from reaching any file outside the notification store, such as the OIDC token
// cache in a sibling directory.
func (s *SecretStore) path(name string) (string, error) {
	if err := ValidateDestinationName(name); err != nil {
		return "", err
	}
	full := filepath.Join(s.dir, name+secretFileExt)
	if filepath.Dir(full) != filepath.Clean(s.dir) {
		return "", fmt.Errorf("invalid destination name %q", name)
	}
	return full, nil
}

// Save encrypts url with the machine key and writes it at 0600.
func (s *SecretStore) Save(name, url string) error {
	p, err := s.path(name)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(s.dir, secretDirPerm); err != nil {
		return fmt.Errorf("create secret dir: %w", err)
	}
	enc, err := auth.EncryptSecret([]byte(url))
	if err != nil {
		return fmt.Errorf("encrypt webhook url: %w", err)
	}
	if err := os.WriteFile(p, enc, secretFilePerm); err != nil {
		return fmt.Errorf("write webhook secret: %w", err)
	}
	return nil
}

// Load decrypts and returns the stored URL for name.
func (s *SecretStore) Load(name string) (string, error) {
	p, err := s.path(name)
	if err != nil {
		return "", err
	}
	enc, err := os.ReadFile(p)
	if err != nil {
		return "", fmt.Errorf("read webhook secret: %w", err)
	}
	plain, err := auth.DecryptSecret(enc)
	if err != nil {
		return "", fmt.Errorf("decrypt webhook secret: %w", err)
	}
	return string(plain), nil
}

// Has reports whether a URL is on file for name.
func (s *SecretStore) Has(name string) bool {
	p, err := s.path(name)
	if err != nil {
		return false
	}
	_, statErr := os.Stat(p)
	return statErr == nil
}

// Delete removes the stored URL for name (no error if it was never stored).
func (s *SecretStore) Delete(name string) error {
	p, err := s.path(name)
	if err != nil {
		// An invalid name can never have been stored, so there is nothing to
		// remove. Treat it as a no-op to keep Delete idempotent.
		return nil
	}
	if err := os.Remove(p); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("delete webhook secret: %w", err)
	}
	return nil
}
