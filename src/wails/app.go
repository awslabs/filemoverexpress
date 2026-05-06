package main

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"

	"github.com/pkg/browser"
	log "github.com/sirupsen/logrus"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct holds the application state and provides bound methods
// that are exposed to the frontend via Wails bindings.
type App struct {
	ctx           context.Context
	daemonManager *DaemonManager
	firstLaunch   *FirstLaunchDetector
	version       string
	devMode       bool
}

// NewApp creates a new App application struct with the given version string.
// If the FME_ELECTRON_DEBUG environment variable is set, dev mode is enabled
// and the version is cleared.
func NewApp(version string) *App {
	devMode := os.Getenv(EnvDebug) != ""
	if devMode {
		version = ""
	}

	homeDir, err := os.UserHomeDir()
	if err != nil {
		homeDir = os.Getenv("HOME")
	}

	return &App{
		daemonManager: NewDaemonManager(getBinaryPath()),
		firstLaunch:   NewFirstLaunchDetector(filepath.Join(homeDir, ConfigDirName)),
		version:       version,
		devMode:       devMode,
	}
}

// StartDaemon spawns the CLI daemon process. If the daemon is already running,
// it returns nil without spawning a new process.
func (a *App) StartDaemon() error {
	return a.daemonManager.Start()
}

// SystemOpen opens the given file path using the operating system's default
// application.
func (a *App) SystemOpen(path string) error {
	return systemOpen(path)
}

// SystemShowItemInFolder reveals the given file path in the operating system's
// file explorer.
func (a *App) SystemShowItemInFolder(path string) error {
	return systemShowItemInFolder(path)
}

// ExternalLink opens the given URL in the system's default web browser.
func (a *App) ExternalLink(url string) error {
	return browser.OpenURL(url)
}

// FatalShutdown emits a fatal-shutdown event to the frontend via the Wails
// runtime event system.
func (a *App) FatalShutdown() {
	wailsRuntime.EventsEmit(a.ctx, EventFatalShutdown)
}

// AppVersion returns the application version string. In dev mode, it returns
// an empty string.
func (a *App) AppVersion() string {
	return a.version
}

// FirstLaunchComplete returns true if the first-launch file existed before the
// current application session started (i.e., this is NOT the first launch).
func (a *App) FirstLaunchComplete() bool {
	return !a.firstLaunch.IsFirstLaunch()
}

// startup is called when the Wails app starts. It stores the context, checks
// for an existing daemon, detects first launch, configures PATH (macOS), and
// initializes logging.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	initLogger(a.devMode)
	log.Infof("Starting %s", ProductName)

	// Position window at (0, 0) on startup.
	wailsRuntime.WindowSetPosition(a.ctx, 0, 0)

	configurePATH()

	a.daemonManager.CheckExisting()
	if err := a.firstLaunch.Detect(); err != nil {
		log.Warnf("First launch detection error: %v", err)
	}

	wailsRuntime.EventsOn(a.ctx, EventClosed, func(_ ...interface{}) {
		wailsRuntime.Quit(a.ctx)
	})
}

// beforeClose is called when the user attempts to close the window. It emits
// an app-close event to the frontend and returns true to prevent immediate
// close, allowing the frontend to handle graceful shutdown.
func (a *App) beforeClose(ctx context.Context) bool {
	wailsRuntime.EventsEmit(ctx, EventAppClose)
	return true
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
