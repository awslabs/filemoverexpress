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

// Start spawns the daemon process as a detached child. It uses CheckExisting
// to determine whether the daemon is already running; if so it returns nil
// without spawning a new process.
func (d *DaemonManager) Start() error {
	if d.CheckExisting() {
		return nil
	}

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

// CheckExisting is the single source of truth for whether the daemon is alive.
// It reads the PID file, verifies the process is still running, and updates
// the internal running state accordingly. Returns true if the daemon is alive.
func (d *DaemonManager) CheckExisting() bool {
	// Fast path: if we spawned the process ourselves and monitorExit is
	// watching it, trust the in-memory state without hitting the filesystem.
	d.mu.Lock()
	if d.running && d.process != nil {
		d.mu.Unlock()
		return true
	}
	d.mu.Unlock()

	pidFilePath := filepath.Join(os.Getenv("HOME"), ConfigDirName, PIDFileName)
	if homeDir, err := os.UserHomeDir(); err == nil {
		pidFilePath = filepath.Join(homeDir, ConfigDirName, PIDFileName)
	}

	data, err := os.ReadFile(pidFilePath)
	if err != nil {
		d.mu.Lock()
		d.running = false
		d.mu.Unlock()
		return false
	}

	pid, err := strconv.Atoi(strings.TrimSpace(string(data)))
	if err != nil {
		log.Warnf("Invalid PID file content: %v", err)
		d.mu.Lock()
		d.running = false
		d.mu.Unlock()
		return false
	}

	alive, err := isProcessAlive(pid)
	if err != nil {
		log.Warnf("Error checking process %d: %v", pid, err)
	}
	if !alive {
		d.mu.Lock()
		d.running = false
		d.mu.Unlock()
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
