//go:build unix

package systeminfo

import "syscall"

// getOpenFileSoftLimit returns the current RLIMIT_NOFILE soft limit, or 0 if it
// can't be read (callers fall back to core-based scaling).
func getOpenFileSoftLimit() uint64 {
	var rl syscall.Rlimit
	if err := syscall.Getrlimit(syscall.RLIMIT_NOFILE, &rl); err != nil {
		return 0
	}
	return uint64(rl.Cur)
}
