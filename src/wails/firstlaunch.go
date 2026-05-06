package main

import (
	"os"
	"path/filepath"

	log "github.com/sirupsen/logrus"
)

// FirstLaunchDetector handles first-launch file detection and creation.
// It checks whether the application has been launched before by looking for
// a marker file in the user's application data directory.
type FirstLaunchDetector struct {
	filePath           string
	existedBeforeStart bool
}

// NewFirstLaunchDetector creates a new FirstLaunchDetector that uses the given
// userDataDir as the parent directory for the first-launch marker file.
func NewFirstLaunchDetector(userDataDir string) *FirstLaunchDetector {
	return &FirstLaunchDetector{
		filePath: filepath.Join(userDataDir, FirstLaunchFileName),
	}
}

// Detect checks whether the first-launch file exists, records the state, and
// creates the file if it is missing. If file creation fails, the error is logged
// but does not prevent the application from continuing.
func (f *FirstLaunchDetector) Detect() error {
	_, err := os.Stat(f.filePath)
	f.existedBeforeStart = err == nil

	if f.existedBeforeStart {
		log.Debugf("First-launch file already exists: %s", f.filePath)
		return nil
	}

	// Ensure the parent directory exists
	dir := filepath.Dir(f.filePath)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		log.Errorf("Failed to create directory for first-launch file: %v", err)
		return err
	}

	// Create the marker file
	file, err := os.Create(f.filePath)
	if err != nil {
		log.Errorf("Failed to create first-launch file: %v", err)
		return err
	}
	file.Close()

	// Attempt to hide the file (platform-specific)
	if err := hideFile(f.filePath); err != nil {
		log.Warnf("Failed to hide first-launch file: %v", err)
	}

	log.Debugf("Created first-launch file: %s", f.filePath)
	return nil
}

// IsFirstLaunch returns true if the first-launch file did NOT exist before the
// current application session started. This indicates the app is being launched
// for the first time.
func (f *FirstLaunchDetector) IsFirstLaunch() bool {
	return !f.existedBeforeStart
}
