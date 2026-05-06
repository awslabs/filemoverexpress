//go:build !windows

package main

// hideFile is a no-op on Unix systems. Files prefixed with a dot are already
// hidden by convention on Unix-like operating systems.
func hideFile(_ string) error {
	return nil
}
