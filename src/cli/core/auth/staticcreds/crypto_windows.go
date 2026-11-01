//go:build windows

package staticcreds

import (
	"fmt"
	"unsafe"

	"golang.org/x/sys/windows"
)

// On Windows, static credentials are protected with DPAPI (user-scoped), the same primitive the
// OIDC token cache uses. DPAPI scopes the key to the current user account; there is no separate
// salt to vary as on unix, but the stored blob lives in its own credentials/ directory and is never
// shared with the OIDC cache.

// encryptData encrypts plaintext using Windows DPAPI (user-scoped). entropy is passed as the DPAPI
// optional-entropy blob: decryption fails unless the same entropy is supplied, so a blob protected
// for one profile cannot be unprotected under another (mirrors the unix GCM-AAD binding).
func encryptData(plaintext, entropy []byte) ([]byte, error) {
	input := windows.DataBlob{
		Size: uint32(len(plaintext)),
		Data: &plaintext[0],
	}
	var output windows.DataBlob

	err := windows.CryptProtectData(&input, nil, entropyBlob(entropy), 0, nil, 0, &output)
	if err != nil {
		return nil, fmt.Errorf("DPAPI CryptProtectData: %w", err)
	}
	defer func() {
		_, _ = windows.LocalFree(windows.Handle(unsafe.Pointer(output.Data)))
	}()

	encrypted := make([]byte, output.Size)
	copy(encrypted, unsafe.Slice(output.Data, output.Size))

	return encrypted, nil
}

// decryptData decrypts DPAPI-encrypted data (user-scoped). entropy must match the value passed at
// encryption time.
func decryptData(encrypted, entropy []byte) ([]byte, error) {
	input := windows.DataBlob{
		Size: uint32(len(encrypted)),
		Data: &encrypted[0],
	}
	var output windows.DataBlob

	err := windows.CryptUnprotectData(&input, nil, entropyBlob(entropy), 0, nil, 0, &output)
	if err != nil {
		return nil, fmt.Errorf("DPAPI CryptUnprotectData: %w", err)
	}
	defer func() {
		_, _ = windows.LocalFree(windows.Handle(unsafe.Pointer(output.Data)))
	}()

	plaintext := make([]byte, output.Size)
	copy(plaintext, unsafe.Slice(output.Data, output.Size))

	return plaintext, nil
}

// entropyBlob wraps the profile-binding entropy as a DPAPI DataBlob, or nil when empty.
func entropyBlob(entropy []byte) *windows.DataBlob {
	if len(entropy) == 0 {
		return nil
	}
	return &windows.DataBlob{Size: uint32(len(entropy)), Data: &entropy[0]}
}
