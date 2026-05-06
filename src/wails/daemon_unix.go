//go:build !windows

package main

import (
	"os"
	"path/filepath"
	"syscall"
)

// getBinaryPath returns the path to the CLI binary on Unix systems.
// It looks for the binary in the same directory as the running executable.
func getBinaryPath() string {
	execPath, err := os.Executable()
	if err != nil {
		return ProductCLIName
	}
	return filepath.Join(filepath.Dir(execPath), ProductCLIName)
}

// getDaemonArgs returns the command-line arguments for spawning the daemon on Unix.
// On Unix, the CLI binary is invoked directly with the "daemon" argument.
func getDaemonArgs() []string {
	return []string{"daemon"}
}

// detachedProcAttr returns SysProcAttr for spawning a detached process on Unix.
func detachedProcAttr() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{
		Setsid: true,
	}
}

// isProcessAlive checks whether a process with the given PID is still running.
func isProcessAlive(pid int) (bool, error) {
	process, err := os.FindProcess(pid)
	if err != nil {
		return false, nil
	}
	err = process.Signal(syscall.Signal(0))
	return err == nil, nil
}
