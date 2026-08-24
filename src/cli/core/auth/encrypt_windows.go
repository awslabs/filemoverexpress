//go:build windows

package auth

import (
	"fmt"
	"unsafe"

	"golang.org/x/sys/windows"
)

// encryptData encrypts plaintext using Windows DPAPI (user-scoped).
func encryptData(plaintext []byte) ([]byte, error) {
	input := windows.DataBlob{
		Size: uint32(len(plaintext)),
		Data: &plaintext[0],
	}
	var output windows.DataBlob

	err := windows.CryptProtectData(&input, nil, nil, 0, nil, 0, &output)
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

// decryptData decrypts DPAPI-encrypted data (user-scoped).
func decryptData(encrypted []byte) ([]byte, error) {
	input := windows.DataBlob{
		Size: uint32(len(encrypted)),
		Data: &encrypted[0],
	}
	var output windows.DataBlob

	err := windows.CryptUnprotectData(&input, nil, nil, 0, nil, 0, &output)
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
