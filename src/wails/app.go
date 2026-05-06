package main

import (
	"context"
	"encoding/base64"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"

	"github.com/pkg/browser"
	log "github.com/sirupsen/logrus"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// FMEApp struct holds the application state and provides bound methods
// that are exposed to the frontend via Wails bindings.
type FMEApp struct {
	app           *application.App
	daemonManager *DaemonManager
	firstLaunch   *FirstLaunchDetector
	version       string
	devMode       bool
	closeEventSet *time.Time
}

// NewFMEApp creates a new FMEApp application struct with the given version string.
// If the FME_ELECTRON_DEBUG environment variable is set, dev mode is enabled
// and the version is cleared.
func NewFMEApp(version string) *FMEApp {
	devMode := os.Getenv(EnvDebug) != ""
	if devMode {
		version = ""
	}

	homeDir, err := os.UserHomeDir()
	if err != nil {
		homeDir = os.Getenv("HOME")
	}

	return &FMEApp{
		daemonManager: NewDaemonManager(getBinaryPath()),
		firstLaunch:   NewFirstLaunchDetector(filepath.Join(homeDir, ConfigDirName)),
		version:       version,
		devMode:       devMode,
	}
}

// ServiceStartup is called by Wails v3 when the service is initialized.
// It stores the app reference, checks for an existing daemon, detects first
// launch, configures PATH (macOS), and initializes logging.
func (a *FMEApp) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	a.app = application.Get()

	initLogger(a.devMode)
	log.Infof("Starting %s", ProductName)

	configurePATH()

	a.daemonManager.CheckExisting()
	if err := a.firstLaunch.Detect(); err != nil {
		log.Warnf("First launch detection error: %v", err)
	}

	return nil
}

// StartDaemon spawns the CLI daemon process. If the daemon is already running,
// it returns nil without spawning a new process.
func (a *FMEApp) StartDaemon() error {
	return a.daemonManager.Start()
}

// SystemOpen opens the given file path using the operating system's default
// application.
func (a *FMEApp) SystemOpen(path string) error {
	return systemOpen(path)
}

// SystemShowItemInFolder reveals the given file path in the operating system's
// file explorer.
func (a *FMEApp) SystemShowItemInFolder(path string) error {
	return systemShowItemInFolder(path)
}

// SaveFile prompts the user with a native "Save As" dialog seeded with the
// given default filename, then writes the base64-encoded data to the path the
// user chooses. It returns the path the file was saved to, or an empty string
// if the user cancelled the dialog. This is needed because the packaged Wails
// webview does not handle browser-style anchor/`data:` URL downloads.
func (a *FMEApp) SaveFile(defaultFilename string, base64Data string) (string, error) {
	// Show the dialog before decoding so a cancel doesn't allocate the full payload
	// (exports can be large).
	ext := filepath.Ext(defaultFilename)
	path, err := a.app.Dialog.SaveFile().
		SetFilename(defaultFilename).
		AddFilter(ext+" files", "*"+ext).
		PromptForSingleSelection()
	if err != nil {
		return "", err
	}

	if path == "" {
		// User cancelled the dialog; nothing to write.
		return "", nil
	}

	data, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return "", err
	}

	// 0o600 (owner-only) since exported reports can contain job metadata.
	if err = os.WriteFile(path, data, 0o600); err != nil {
		return "", err
	}

	return path, nil
}

// ExternalLink opens the given URL in the system's default web browser.
func (a *FMEApp) ExternalLink(url string) error {
	return browser.OpenURL(url)
}

// FatalShutdown emits a fatal-shutdown event to the frontend via the Wails
// runtime event system.
func (a *FMEApp) FatalShutdown() {
	a.app.Event.Emit(EventFatalShutdown)
}

// AppVersion returns the application version string. In dev mode, it returns
// an empty string.
func (a *FMEApp) AppVersion() string {
	return a.version
}

// FirstLaunchComplete returns true if the first-launch file existed before the
// current application session started (i.e., this is NOT the first launch).
func (a *FMEApp) FirstLaunchComplete() bool {
	return !a.firstLaunch.IsFirstLaunch()
}

// HandleBeforeClose is called when the user attempts to close the window.
// It emits an app-close event to the frontend and cancels the close to allow
// the frontend to handle graceful shutdown.
func (a *FMEApp) HandleBeforeClose(e *application.WindowEvent) {
	now := time.Now()
	cutoff := now.Add(-1 * time.Minute)
	if a.closeEventSet != nil && !a.closeEventSet.Before(cutoff) {
		// Allow close — don't cancel
		return
	}
	a.app.Event.Emit(EventAppClose)
	a.closeEventSet = &now
	e.Cancel()
}

// systemOpen opens a file path using the platform-specific open command.
func systemOpen(path string) error {
	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", path)
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", "", path)
	default:
		cmd = exec.Command("xdg-open", path)
	}

	return cmd.Start()
}

// systemShowItemInFolder reveals a file in the platform-specific file explorer.
func systemShowItemInFolder(path string) error {
	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", "-R", path)
	case "windows":
		cmd = exec.Command("explorer", "/select,"+path)
	default:
		// On Linux, open the parent directory
		cmd = exec.Command("xdg-open", filepath.Dir(path))
	}

	return cmd.Start()
}
