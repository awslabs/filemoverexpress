//go:build windows

package systeminfo

// getOpenFileSoftLimit returns 0 on Windows (no RLIMIT_NOFILE); callers fall back
// to core-based scaling.
func getOpenFileSoftLimit() uint64 {
	return 0
}
