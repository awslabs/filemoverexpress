//go:build darwin

package main

import (
	"os"
	"path/filepath"

	log "github.com/sirupsen/logrus"
)

// configurePATH adds the directory containing the bundled CLI binary to the
// process PATH environment variable on macOS. This ensures the daemon can be
// started correctly from the app bundle.
func configurePATH() {
	execPath, err := os.Executable()
	if err != nil {
		log.Warnf("Failed to determine executable path for PATH configuration: %v", err)
		return
	}

	binDir := filepath.Dir(execPath)
	currentPath := os.Getenv("PATH")

	if err := os.Setenv("PATH", binDir+":"+currentPath); err != nil {
		log.Warnf("Failed to update PATH: %v", err)
	}
}
