package main

import "os"

const (
	// Application identity constants.

	ProductName           = "File Mover Express"
	ProductCLIName        = "filemoverexpress"
	DaemonLauncherWindows = "filemoverexpress-launcher.exe"
	FirstLaunchFileName   = ".first-launch-complete"
	PIDFileName           = "filemoverexpress.pid"
	ConfigDirName         = ".filemoverexpress"

	// Window dimension constants.
	//
	// The minimum is sized to fit common low-resolution displays (e.g. 1366x768 laptops)
	// so the whole window, including the title bar, stays on screen and the user can
	// resize down. The default is a comfortable larger size that is clamped to the display's
	// work area at runtime (see main.go) so it never opens larger than the screen.

	MinWindowWidth  = 1024
	MinWindowHeight = 640

	DefaultWindowWidth  = 1280
	DefaultWindowHeight = 800

	// Environment variable names.

	EnvDebug     = "FME_ELECTRON_DEBUG"
	EnvGUIDaemon = "FME_GUI_DAEMON"

	// Event channel name constants for communication between Go backend and Angular frontend.

	EventAppClose      = "app-close"
	EventClosed        = "closed"
	EventFatalShutdown = "fatal-shutdown"

	// File permission modes for files and directories the app creates.

	dirPermissions  os.FileMode = 0o755
	filePermissions os.FileMode = 0o600

	// Limits.

	maxSheetJobNameLength = 20
	sheetNameEllipsis     = "..."
	maxDiscoveryDocBytes  = 1 << 20 // 1 MiB cap on an OIDC discovery document
)
