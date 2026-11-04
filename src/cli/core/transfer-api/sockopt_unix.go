//go:build unix

package transfer_api

import (
	"syscall"

	"github.com/awslabs/filemoverexpress/events"
)

// sendBufferControl returns a net.Dialer Control hook that caps the socket send
// buffer (SO_SNDBUF) at bytes before connect. A failure to set the option is
// logged but not fatal: the connection still proceeds with the OS default buffer.
func sendBufferControl(bytes int) func(network, address string, c syscall.RawConn) error {
	return func(_, _ string, c syscall.RawConn) error {
		var sockErr error
		ctrlErr := c.Control(func(fd uintptr) {
			sockErr = syscall.SetsockoptInt(int(fd), syscall.SOL_SOCKET, syscall.SO_SNDBUF, bytes)
		})
		if ctrlErr != nil {
			return ctrlErr
		}
		if sockErr != nil {
			events.Events.Warn("Unable to set SO_SNDBUF to %d bytes: %s", bytes, sockErr)
		}
		return nil
	}
}
