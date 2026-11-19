//go:build windows

package transfer_api

import "syscall"

// wsaENOBUFS is the Winsock error code WSAENOBUFS. The standard syscall package
// does not export it, and golang.org/x/sys/windows is not a dependency.
const wsaENOBUFS syscall.Errno = 10055

// errNoBufferSpace is the OS error returned when the kernel network buffer pool
// is exhausted. On Windows this is WSAENOBUFS.
var errNoBufferSpace error = wsaENOBUFS
