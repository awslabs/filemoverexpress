//go:build !windows && !linux

package staticcreds

import "fmt"

// This file provides the TPM hooks for Unix platforms that have no TPM support in FME (macOS, the
// BSDs). macOS protects secrets via the Secure Enclave, which is a different API and out of scope
// here; these platforms always use the machine-ID key derivation.

// preferredKey always selects the machine-ID method on non-Linux Unix: there is no TPM path.
func preferredKey(_ bool) (byte, []byte, error) {
	key, err := deriveMachineIDKey()
	return methodMachineID, key, err
}

// deriveTPMKey is only reached if a TPM-tagged blob (written on a Linux host) is opened here. There
// is no TPM to unseal it with, so it fails cleanly rather than silently mis-deriving.
func deriveTPMKey(_ bool) ([]byte, error) {
	return nil, fmt.Errorf("TPM-sealed credentials cannot be read on this platform")
}
