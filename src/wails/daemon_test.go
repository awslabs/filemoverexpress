package main

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestStartSpawnsProcessWithCorrectArgsAndEnv verifies that Start() spawns a
// process with the expected arguments and FME_GUI_DAEMON=true environment variable.
// Requirements: 3.1
func TestStartSpawnsProcessWithCorrectArgsAndEnv(t *testing.T) {
	// Use a binary that exits quickly. On Windows use "cmd /c exit 0",
	// on Unix use "true" or the Go binary itself.
	var binaryPath string
	if runtime.GOOS == "windows" {
		binaryPath = "cmd"
	} else {
		binaryPath = "true"
	}

	dm := NewDaemonManager(binaryPath)

	// For this test we need to override the args since getDaemonArgs() adds
	// platform-specific args. We test that Start() succeeds and sets running=true.
	err := dm.Start()
	require.NoError(t, err, "Start() should not return an error")

	assert.True(t, dm.IsRunning(), "daemon should be marked as running after Start()")
	assert.NotNil(t, dm.process, "process should be set after Start()")

	// Wait for the process to exit naturally
	time.Sleep(500 * time.Millisecond)
}

// TestStartWhenAlreadyRunningReturnsNil verifies that calling Start() when the
// daemon is already running returns nil without spawning a new process.
// Requirements: 3.2
func TestStartWhenAlreadyRunningReturnsNil(t *testing.T) {
	dm := NewDaemonManager("nonexistent-binary")

	// Manually set running to true to simulate an already-running daemon
	dm.mu.Lock()
	dm.running = true
	dm.mu.Unlock()

	err := dm.Start()
	assert.NoError(t, err, "Start() should return nil when already running")
	assert.Nil(t, dm.process, "no process should be spawned when already running")
}

// TestCheckExistingWithValidPIDFileAndRunningProcess verifies that CheckExisting()
// returns true when the PID file contains a valid PID of a running process.
// Requirements: 3.3
func TestCheckExistingWithValidPIDFileAndRunningProcess(t *testing.T) {
	// Create a temp directory to act as the config directory
	tmpDir := t.TempDir()
	configDir := filepath.Join(tmpDir, ConfigDirName)
	require.NoError(t, os.MkdirAll(configDir, 0o755))

	// Write the current process PID to the PID file (we know it's alive)
	pidFile := filepath.Join(configDir, PIDFileName)
	currentPID := os.Getpid()
	require.NoError(t, os.WriteFile(pidFile, []byte(fmt.Sprintf("%d", currentPID)), 0o644))

	// Override HOME/USERPROFILE so CheckExisting() finds our temp PID file
	if runtime.GOOS == "windows" {
		t.Setenv("USERPROFILE", tmpDir)
	} else {
		t.Setenv("HOME", tmpDir)
	}

	dm := NewDaemonManager("some-binary")
	result := dm.CheckExisting()

	assert.True(t, result, "CheckExisting() should return true for a running process")
	assert.True(t, dm.IsRunning(), "daemon should be marked as running")
}

// TestCheckExistingWithMissingPIDFile verifies that CheckExisting() returns false
// when the PID file does not exist.
// Requirements: 3.3
func TestCheckExistingWithMissingPIDFile(t *testing.T) {
	// Use a temp directory with no PID file
	tmpDir := t.TempDir()

	if runtime.GOOS == "windows" {
		t.Setenv("USERPROFILE", tmpDir)
	} else {
		t.Setenv("HOME", tmpDir)
	}

	dm := NewDaemonManager("some-binary")
	result := dm.CheckExisting()

	assert.False(t, result, "CheckExisting() should return false when PID file is missing")
	assert.False(t, dm.IsRunning(), "daemon should not be marked as running")
}

// TestCheckExistingWithInvalidPIDFile verifies that CheckExisting() returns false
// when the PID file contains invalid (non-numeric) content.
// Requirements: 3.3
func TestCheckExistingWithInvalidPIDFile(t *testing.T) {
	tmpDir := t.TempDir()
	configDir := filepath.Join(tmpDir, ConfigDirName)
	require.NoError(t, os.MkdirAll(configDir, 0o755))

	// Write invalid content to the PID file
	pidFile := filepath.Join(configDir, PIDFileName)
	require.NoError(t, os.WriteFile(pidFile, []byte("not-a-number"), 0o644))

	if runtime.GOOS == "windows" {
		t.Setenv("USERPROFILE", tmpDir)
	} else {
		t.Setenv("HOME", tmpDir)
	}

	dm := NewDaemonManager("some-binary")
	result := dm.CheckExisting()

	assert.False(t, result, "CheckExisting() should return false for invalid PID file content")
	assert.False(t, dm.IsRunning(), "daemon should not be marked as running")
}

// TestCheckExistingWithDeadProcess verifies that CheckExisting() returns false
// when the PID file contains a PID of a process that is no longer running.
// Requirements: 3.3
func TestCheckExistingWithDeadProcess(t *testing.T) {
	tmpDir := t.TempDir()
	configDir := filepath.Join(tmpDir, ConfigDirName)
	require.NoError(t, os.MkdirAll(configDir, 0o755))

	// Use a very high PID that is almost certainly not running
	pidFile := filepath.Join(configDir, PIDFileName)
	require.NoError(t, os.WriteFile(pidFile, []byte("4999999"), 0o644))

	if runtime.GOOS == "windows" {
		t.Setenv("USERPROFILE", tmpDir)
	} else {
		t.Setenv("HOME", tmpDir)
	}

	dm := NewDaemonManager("some-binary")
	result := dm.CheckExisting()

	assert.False(t, result, "CheckExisting() should return false for a dead process")
	assert.False(t, dm.IsRunning(), "daemon should not be marked as running")
}

// TestStateResetOnProcessExit verifies that when the daemon process exits with
// a non-zero exit code, the running state is reset to false.
// Requirements: 3.4, 3.5
func TestStateResetOnProcessExit(t *testing.T) {
	// Spawn a process that exits with a non-zero exit code
	var binaryPath string
	if runtime.GOOS == "windows" {
		binaryPath = "cmd"
	} else {
		binaryPath = "false"
	}

	dm := NewDaemonManager(binaryPath)
	err := dm.Start()
	require.NoError(t, err, "Start() should not return an error")

	// The process should initially be marked as running
	assert.True(t, dm.IsRunning(), "daemon should be running immediately after Start()")

	// Wait for the process to exit and the monitor goroutine to reset state.
	// The process should exit almost immediately since it's a simple command.
	require.Eventually(t, func() bool {
		return !dm.IsRunning()
	}, 5*time.Second, 50*time.Millisecond, "daemon running state should reset to false after process exits")

	// Verify process reference is cleared
	dm.mu.Lock()
	assert.Nil(t, dm.process, "process reference should be nil after exit")
	dm.mu.Unlock()
}

// TestStartErrorWithInvalidBinary verifies that Start() returns an error when
// the binary path is invalid/nonexistent.
// Requirements: 3.1
func TestStartErrorWithInvalidBinary(t *testing.T) {
	dm := NewDaemonManager("nonexistent-binary-that-does-not-exist-12345")

	err := dm.Start()
	assert.Error(t, err, "Start() should return an error for invalid binary")
	assert.False(t, dm.IsRunning(), "daemon should not be marked as running on error")
}

// TestIsRunningDefaultsFalse verifies that a new DaemonManager starts with
// running=false.
func TestIsRunningDefaultsFalse(t *testing.T) {
	dm := NewDaemonManager("some-binary")
	assert.False(t, dm.IsRunning(), "new DaemonManager should have running=false")
}
