//go:build windows

package transfer_api

import "syscall"

// sendBufferControl is a no-op on Windows: the send-buffer cap is a mitigation for
// the small, fixed macOS kernel network-buffer pool and is not applied here. The
// connection ceiling (MaxConnsPerHost) still applies on all platforms.
func sendBufferControl(_ int) func(network, address string, c syscall.RawConn) error {
	return func(_, _ string, _ syscall.RawConn) error { return nil }
}
