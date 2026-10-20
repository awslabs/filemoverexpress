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

func (s *SecretStore) path(name string) string {
	return filepath.Join(s.dir, name+secretFileExt)
}

// Save encrypts url with the machine key and writes it at 0600.
func (s *SecretStore) Save(name, url string) error {
	if err := os.MkdirAll(s.dir, secretDirPerm); err != nil {
		return fmt.Errorf("create secret dir: %w", err)
	}
	enc, err := auth.EncryptSecret([]byte(url))
	if err != nil {
		return fmt.Errorf("encrypt webhook url: %w", err)
	}
	if err := os.WriteFile(s.path(name), enc, secretFilePerm); err != nil {
		return fmt.Errorf("write webhook secret: %w", err)
	}
	return nil
}

// Load decrypts and returns the stored URL for name.
func (s *SecretStore) Load(name string) (string, error) {
	enc, err := os.ReadFile(s.path(name))
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
	_, err := os.Stat(s.path(name))
	return err == nil
}

// Delete removes the stored URL for name (no error if it was never stored).
func (s *SecretStore) Delete(name string) error {
	err := os.Remove(s.path(name))
	if err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("delete webhook secret: %w", err)
	}
	return nil
}
