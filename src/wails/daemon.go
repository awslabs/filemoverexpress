package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	log "github.com/sirupsen/logrus"
)

// DaemonManager manages the lifecycle of the CLI daemon process.
type DaemonManager struct {
	running    bool
	process    *os.Process
	binaryPath string
	mu         sync.Mutex
}

// NewDaemonManager creates a new DaemonManager with the given binary path.
func NewDaemonManager(binaryPath string) *DaemonManager {
	return &DaemonManager{
		binaryPath: binaryPath,
	}
}

// Start spawns the daemon process as a detached child. If the daemon is
// already running, it returns nil without spawning a new process.
func (d *DaemonManager) Start() error {
	d.mu.Lock()
	if d.running {
		d.mu.Unlock()
		return nil
	}
	d.mu.Unlock()

	args := getDaemonArgs()
	cmd := exec.Command(d.binaryPath, args...)
	cmd.Env = append(os.Environ(), EnvGUIDaemon+"=true")
	cmd.SysProcAttr = detachedProcAttr()
	cmd.Stdout = nil
	cmd.Stderr = nil
	cmd.Stdin = nil

	log.Debugf("Starting daemon binary: %s %s", d.binaryPath, strings.Join(args, " "))

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start daemon: %w", err)
	}

	d.mu.Lock()
	d.running = true
	d.process = cmd.Process
	d.mu.Unlock()

	go d.monitorExit(cmd)

	return nil
}

// IsRunning returns whether the daemon process is currently running.
func (d *DaemonManager) IsRunning() bool {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.running
}

// CheckExisting reads the PID file and checks if the daemon process is alive.
func (d *DaemonManager) CheckExisting() bool {
	pidFilePath := filepath.Join(os.Getenv("HOME"), ConfigDirName, PIDFileName)
	if homeDir, err := os.UserHomeDir(); err == nil {
		pidFilePath = filepath.Join(homeDir, ConfigDirName, PIDFileName)
	}

	data, err := os.ReadFile(pidFilePath)
	if err != nil {
		return false
	}

	pid, err := strconv.Atoi(strings.TrimSpace(string(data)))
	if err != nil {
		log.Warnf("Invalid PID file content: %v", err)
		return false
	}

	if !isProcessAlive(pid) {
		return false
	}

	d.mu.Lock()
	d.running = true
	d.mu.Unlock()

	return true
}

// monitorExit waits for the daemon process to exit and resets the running state.
func (d *DaemonManager) monitorExit(cmd *exec.Cmd) {
	err := cmd.Wait()

	d.mu.Lock()
	d.process = nil
	d.running = false
	d.mu.Unlock()

	if err != nil {
		log.Errorf("Daemon process exited with error: %v", err)
	}
}
