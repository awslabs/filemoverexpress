//go:build !darwin

package main

// configurePATH is a no-op on non-macOS platforms. On Windows and Linux, the
// CLI binary is expected to be in the same directory as the executable or
// already on the system PATH.
func configurePATH() {}
