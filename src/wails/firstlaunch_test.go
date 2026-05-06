package main

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestFirstLaunchDetectFileDoesNotExist verifies that when the first-launch file
// does not exist, Detect() creates it and IsFirstLaunch() returns true.
// Requirements: 7.1, 7.2
func TestFirstLaunchDetectFileDoesNotExist(t *testing.T) {
	tmpDir := t.TempDir()

	detector := NewFirstLaunchDetector(tmpDir)

	err := detector.Detect()
	require.NoError(t, err, "Detect() should not return an error")

	assert.True(t, detector.IsFirstLaunch(), "IsFirstLaunch() should return true when file did not exist")

	// Verify the file was actually created
	filePath := filepath.Join(tmpDir, FirstLaunchFileName)
	_, err = os.Stat(filePath)
	assert.NoError(t, err, "first-launch file should exist after Detect()")
}

// TestFirstLaunchDetectFileAlreadyExists verifies that when the first-launch file
// already exists, Detect() does not recreate it and IsFirstLaunch() returns false.
// Requirements: 7.3
func TestFirstLaunchDetectFileAlreadyExists(t *testing.T) {
	tmpDir := t.TempDir()

	// Pre-create the first-launch file
	filePath := filepath.Join(tmpDir, FirstLaunchFileName)
	file, err := os.Create(filePath)
	require.NoError(t, err)
	file.Close()

	detector := NewFirstLaunchDetector(tmpDir)

	err = detector.Detect()
	require.NoError(t, err, "Detect() should not return an error")

	assert.False(t, detector.IsFirstLaunch(), "IsFirstLaunch() should return false when file already existed")
}

// TestFirstLaunchDetectCreatesParentDirectory verifies that Detect() creates
// the parent directory if it does not exist.
// Requirements: 7.1
func TestFirstLaunchDetectCreatesParentDirectory(t *testing.T) {
	tmpDir := t.TempDir()
	nestedDir := filepath.Join(tmpDir, "nested", "config")

	detector := NewFirstLaunchDetector(nestedDir)

	err := detector.Detect()
	require.NoError(t, err, "Detect() should not return an error")

	assert.True(t, detector.IsFirstLaunch(), "IsFirstLaunch() should return true")

	// Verify the nested directory and file were created
	filePath := filepath.Join(nestedDir, FirstLaunchFileName)
	_, err = os.Stat(filePath)
	assert.NoError(t, err, "first-launch file should exist in nested directory")
}

// TestFirstLaunchDetectFileCreationFailure verifies that when file creation fails
// (e.g., due to permissions), Detect() returns an error but does not crash.
// Requirements: 7.1
func TestFirstLaunchDetectFileCreationFailure(t *testing.T) {
	// Use a path that cannot be created (file as directory)
	tmpDir := t.TempDir()
	blockingFile := filepath.Join(tmpDir, "blocker")

	// Create a regular file where we need a directory
	f, err := os.Create(blockingFile)
	require.NoError(t, err)
	f.Close()

	// Try to use the file as a directory path — this will fail on MkdirAll or Create
	detector := NewFirstLaunchDetector(filepath.Join(blockingFile, "subdir"))

	err = detector.Detect()
	assert.Error(t, err, "Detect() should return an error when file creation fails")

	// The detector should still report first launch since the file didn't exist
	assert.True(t, detector.IsFirstLaunch(), "IsFirstLaunch() should return true even on creation failure")
}

// TestFirstLaunchIsFirstLaunchDefaultFalse verifies that IsFirstLaunch() returns
// false before Detect() is called (existedBeforeStart defaults to false, so
// IsFirstLaunch returns true by default — but this tests the zero-value behavior).
func TestFirstLaunchIsFirstLaunchBeforeDetect(t *testing.T) {
	tmpDir := t.TempDir()
	detector := NewFirstLaunchDetector(tmpDir)

	// Before Detect() is called, existedBeforeStart is false (zero value),
	// so IsFirstLaunch() returns true (i.e., !false = true)
	assert.True(t, detector.IsFirstLaunch(), "IsFirstLaunch() should return true before Detect() is called")
}

// TestFirstLaunchNewDetectorSetsFilePath verifies that the constructor correctly
// sets the file path using the provided directory and the constant file name.
func TestFirstLaunchNewDetectorSetsFilePath(t *testing.T) {
	detector := NewFirstLaunchDetector("/some/path")

	expected := filepath.Join("/some/path", FirstLaunchFileName)
	assert.Equal(t, expected, detector.filePath, "filePath should be constructed from userDataDir and FirstLaunchFileName")
}
