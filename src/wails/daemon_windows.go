//go:build windows

package main

import (
	"fmt"
	"os"
	"path/filepath"
	"syscall"

	log "github.com/sirupsen/logrus"
)

const (
	processQueryLimitedInfo = 0x1000

	// createNoWindow is the CREATE_NO_WINDOW process creation flag.
	createNoWindow = 0x00000008
)

var (
	modkernel32     = syscall.NewLazyDLL("kernel32.dll")
	procOpenProcess = modkernel32.NewProc("OpenProcess")
	procCloseHandle = modkernel32.NewProc("CloseHandle")
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

// getDaemonArgs returns the command-line arguments for spawning the daemon on Windows.
// On Windows, the launcher binary handles daemon mode, so no extra args are needed.
func getDaemonArgs() []string {
	return []string{}
}

// detachedProcAttr returns SysProcAttr for spawning a detached process on Windows.
func detachedProcAttr() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{
		CreationFlags: createNoWindow,
	}
}

// isProcessAlive checks whether a process with the given PID is still running on Windows.
// Uses OpenProcess with PROCESS_QUERY_LIMITED_INFORMATION access right.
func isProcessAlive(pid int) (bool, error) {
	handle, _, err := procOpenProcess.Call(uintptr(processQueryLimitedInfo), 0, uintptr(pid))
	if handle == 0 {
		return false, fmt.Errorf("error opening process: %w", err)
	}

	if _, _, closeErr := procCloseHandle.Call(handle); err != nil {
		log.Warnf("failed to close process handle for pid %d: %v", pid, closeErr)
	}
	return true, nil
}
