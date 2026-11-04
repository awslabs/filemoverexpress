//go:build unix

package transfer_api

import "syscall"

// errNoBufferSpace is the OS error returned when the kernel network buffer pool
// is exhausted (write: no buffer space available). On unix this is ENOBUFS.
var errNoBufferSpace error = syscall.ENOBUFS
