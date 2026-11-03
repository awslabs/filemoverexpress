//go:build windows

package transfer_api

import "syscall"

// errNoBufferSpace is the OS error returned when the kernel network buffer pool
// is exhausted. On Windows this is WSAENOBUFS (10055).
var errNoBufferSpace error = syscall.Errno(10055)
