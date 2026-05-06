//go:build windows

package main

import (
	"os"
	"path/filepath"
	"syscall"
	"unsafe"
)

// getBinaryPath returns the path to the daemon launcher binary on Windows.
// On Windows, the launcher binary handles daemon mode.
func getBinaryPath() string {
	execPath, err := os.Executable()
	if err != nil {
		return DaemonLauncherWindows
	}
	return filepath.Join(filepath.Dir(execPath), DaemonLauncherWindows)
}

var (
	modkernel32         = syscall.NewLazyDLL("kernel32.dll")
	procOpenProcess     = modkernel32.NewProc("OpenProcess")
	procCloseHandle     = modkernel32.NewProc("CloseHandle")
)

const processQueryLimitedInfo = 0x1000

// getDaemonArgs returns the command-line arguments for spawning the daemon on Windows.
// On Windows, the launcher binary handles daemon mode, so no extra args are needed.
func getDaemonArgs() []string {
	return []string{}
}

// detachedProcAttr returns SysProcAttr for spawning a detached process on Windows.
func detachedProcAttr() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{
		CreationFlags: 0x00000008, // CREATE_NO_WINDOW
	}
}

// isProcessAlive checks whether a process with the given PID is still running on Windows.
// Uses OpenProcess with PROCESS_QUERY_LIMITED_INFORMATION access right.
func isProcessAlive(pid int) bool {
	handle, _, err := procOpenProcess.Call(
		uintptr(processQueryLimitedInfo),
		0,
		uintptr(pid),
	)
	if handle == 0 {
		_ = err
		return false
	}
	procCloseHandle.Call(handle)
	return true
}

// getExitCodeProcess retrieves the exit code of a process by handle.
// Returns (exitCode, error). If the process is still running, exitCode is 259 (STILL_ACTIVE).
func getExitCodeProcess(handle uintptr) (uint32, error) {
	var exitCode uint32
	procGetExitCodeProcess := modkernel32.NewProc("GetExitCodeProcess")
	r1, _, err := procGetExitCodeProcess.Call(handle, uintptr(unsafe.Pointer(&exitCode)))
	if r1 == 0 {
		return 0, err
	}
	return exitCode, nil
}
