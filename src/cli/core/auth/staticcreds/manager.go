// Package staticcreds is a small, self-contained subsystem whose ONLY job is to store, retrieve,
// and delete AWS static access-key credentials on the local daemon host, encrypted at rest. It
// deliberately knows nothing about transfer logic, RPC, or the GUI. It lives under core/auth
// because its single purpose is storing auth credentials.
//
// Credentials are encrypted with a machine-derived key (AES-256-GCM via HKDF on unix, DPAPI on
// Windows) in a dedicated key domain that is distinct from the OIDC token cache, so the two secret
// types never share a key. Each profile's credentials live in their own 0600 file under
// <config-dir>/credentials/<profile>.enc, OUTSIDE configuration.yaml.
//
// This manager is the SOLE owner of the stored values: the access key id, the secret, and any
// session token live only inside the encrypted file. Nothing outside this package can obtain the
// full access key id - callers that need to display it get a masked form via MaskedAccessKeyID,
// and only the daemon-internal Vend returns the real values (for building an S3 session). The
// values are never placed on the TransferProfile struct (whose String() reflects every field) and
// are never returned over RPC.
package staticcreds

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/awslabs/filemoverexpress/config"
)

const (
	dirPermissions  = 0o700
	filePermissions = 0o600
	credentialsDir  = "credentials"
	// maskKeepChars is how many leading and trailing characters of the access key id a masked form
	// preserves - enough for someone with access to recognise the key, useless to an attacker.
	maskKeepChars = 4
)

type (
	// StaticCredentials is the credential payload persisted per profile. SessionToken is optional:
	// it is set only for temporary credentials (some users can only vend keys that carry a session
	// token). When present, the transfer session is built with it.
	StaticCredentials struct {
		AccessKeyID     string `json:"access_key_id"`
		SecretAccessKey string `json:"secret_access_key"`
		SessionToken    string `json:"session_token,omitempty"`
	}

	// Manager persists StaticCredentials as encrypted per-profile files.
	Manager struct {
		dir string
	}
)

// NewManager returns a Manager rooted at <config-dir>/credentials.
func NewManager() *Manager {
	return &Manager{dir: filepath.Join(config.GetConfigDir(), credentialsDir)}
}

// NewManagerWithDir returns a Manager rooted at an explicit directory (used by tests).
func NewManagerWithDir(dir string) *Manager {
	return &Manager{dir: dir}
}

// Create validates and stores credentials for a profile switching to access-key auth.
func (m *Manager) Create(profileName string, creds StaticCredentials) error {
	return m.write(profileName, creds)
}

// Update replaces the stored secret for an existing access-key profile.
func (m *Manager) Update(profileName string, creds StaticCredentials) error {
	return m.write(profileName, creds)
}

// Vend returns the stored credentials for a profile. Daemon-internal ONLY — never exposed via RPC.
func (m *Manager) Vend(profileName string) (StaticCredentials, error) {
	if err := validateProfileName(profileName); err != nil {
		return StaticCredentials{}, err
	}
	path := m.filePath(profileName)
	encrypted, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return StaticCredentials{}, fmt.Errorf("no stored credentials for profile %q", profileName)
		}
		return StaticCredentials{}, fmt.Errorf("read credentials file: %w", err)
	}
	plaintext, err := decryptData(encrypted, credentialAAD(profileName))
	if err != nil {
		// Do NOT delete on decrypt failure. A transient partial read, an in-progress machine-id
		// reload, or a truncated file (e.g. from an interrupted write) is indistinguishable from
		// tampering here, and deleting would destroy the user's only stored secret and force
		// re-entry. Surface the error instead; the user can re-save to overwrite.
		return StaticCredentials{}, fmt.Errorf("decrypt credentials: %w", err)
	}
	var creds StaticCredentials
	if err := json.Unmarshal(plaintext, &creds); err != nil {
		return StaticCredentials{}, fmt.Errorf("parse credentials: %w", err)
	}
	return creds, nil
}

// Delete removes a profile's stored credentials. Safe to call when none exist.
func (m *Manager) Delete(profileName string) error {
	if err := validateProfileName(profileName); err != nil {
		return err
	}
	err := os.Remove(m.filePath(profileName))
	if err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("delete credentials: %w", err)
	}
	return nil
}

// Has reports whether an encrypted secret exists for a profile. Used to set the read-only
// has_secret_access_key hint without ever reading the secret back.
func (m *Manager) Has(profileName string) bool {
	if err := validateProfileName(profileName); err != nil {
		return false
	}
	_, err := os.Stat(m.filePath(profileName))
	return err == nil
}

// MaskedAccessKeyID returns the stored access key id with only its first and last few characters
// visible (e.g. AKIA****F3LH), or "" when no credentials are stored or they cannot be read. This is
// the ONLY way code outside this package may obtain any form of the access key id - the full value
// never leaves the manager except through the daemon-internal Vend. The caller (GetConfiguration)
// uses this to stamp a display value onto the RPC response so the full id is never sent over the
// wire, satisfying the "credentials never leave the endpoint" condition for the id as well.
func (m *Manager) MaskedAccessKeyID(profileName string) string {
	creds, err := m.Vend(profileName)
	if err != nil {
		return ""
	}
	return maskAccessKeyID(creds.AccessKeyID)
}

// maskAccessKeyID keeps the first and last maskKeepChars characters and replaces the middle with a
// fixed run of bullets. A value too short to mask meaningfully is returned fully masked.
func maskAccessKeyID(id string) string {
	const bullets = "\u2022\u2022\u2022\u2022"
	if len(id) <= maskKeepChars*2 {
		if id == "" {
			return ""
		}
		return bullets
	}
	return id[:maskKeepChars] + bullets + id[len(id)-maskKeepChars:]
}

func (m *Manager) write(profileName string, creds StaticCredentials) error {
	if err := validateProfileName(profileName); err != nil {
		return err
	}
	if creds.AccessKeyID == "" || creds.SecretAccessKey == "" {
		return fmt.Errorf("access key id and secret access key are required")
	}
	if err := os.MkdirAll(m.dir, dirPermissions); err != nil {
		return fmt.Errorf("create credentials directory: %w", err)
	}
	plaintext, err := json.Marshal(creds)
	if err != nil {
		return fmt.Errorf("marshal credentials: %w", err)
	}
	encrypted, err := encryptData(plaintext, credentialAAD(profileName))
	if err != nil {
		return fmt.Errorf("encrypt credentials: %w", err)
	}
	if err := writeFileAtomic(m.filePath(profileName), encrypted, filePermissions); err != nil {
		return fmt.Errorf("write credentials file: %w", err)
	}
	return nil
}

// writeFileAtomic writes data to a temp file in the same directory, then renames it into place.
// os.Rename is atomic on the same filesystem (and replaces the target on both unix and Windows), so
// a crash or power loss mid-write can never leave a truncated .enc that Vend would fail to decrypt.
func writeFileAtomic(path string, data []byte, perm os.FileMode) error {
	tmp, err := os.CreateTemp(filepath.Dir(path), filepath.Base(path)+".tmp-*")
	if err != nil {
		return fmt.Errorf("create temp file: %w", err)
	}
	tmpName := tmp.Name()
	// Best-effort cleanup of the temp file if we bail before the rename succeeds.
	defer func() { _ = os.Remove(tmpName) }()

	if err := tmp.Chmod(perm); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("chmod temp file: %w", err)
	}
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("write temp file: %w", err)
	}
	if err := tmp.Sync(); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("sync temp file: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("close temp file: %w", err)
	}
	if err := os.Rename(tmpName, path); err != nil {
		return fmt.Errorf("rename temp file: %w", err)
	}
	return nil
}

func (m *Manager) filePath(profileName string) string {
	return filepath.Join(m.dir, profileName+".enc")
}

// credentialAAD binds a stored blob to its profile. On unix it is the AES-GCM additional
// authenticated data; on Windows it is the DPAPI entropy. A file encrypted for profile A therefore
// fails to open when read under profile B, so swapping or renaming <profile>.enc files on disk is
// detected (decryption fails) rather than silently honored with the wrong profile's keys.
func credentialAAD(profileName string) []byte {
	return []byte("fme-static-credentials:" + profileName)
}

// validateProfileName rejects names that could escape the credentials directory (path traversal),
// since the profile name is used directly as a filename.
func validateProfileName(name string) error {
	if name == "" {
		return fmt.Errorf("profile name is required")
	}
	if name != filepath.Base(name) || strings.Contains(name, "..") || strings.ContainsAny(name, `/\`) {
		return fmt.Errorf("invalid profile name %q", name)
	}
	return nil
}
