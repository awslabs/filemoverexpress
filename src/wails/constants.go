package main

// Application identity constants.
const (
	ProductName           = "File Mover Express"
	ProductCLIName        = "filemoverexpress"
	DaemonLauncherWindows = "filemoverexpress-launcher.exe"
	FirstLaunchFileName   = ".first-launch-complete"
	PIDFileName           = "filemoverexpress.pid"
	ConfigDirName         = ".filemoverexpress"
)

// Window dimension constants.
//
// The minimum is sized to fit common low-resolution displays (e.g. 1366x768 laptops)
// so the whole window — including the title bar — stays on screen and the user can
// resize down. The default is a comfortable larger size that is clamped to the display's
// work area at runtime (see main.go) so it never opens larger than the screen.
const (
	MinWindowWidth  = 1024
	MinWindowHeight = 640

	DefaultWindowWidth  = 1280
	DefaultWindowHeight = 800
)

// Environment variable names.
const (
	EnvDebug     = "FME_ELECTRON_DEBUG"
	EnvGUIDaemon = "FME_GUI_DAEMON"
)

// Event channel name constants for communication between Go backend and Angular frontend.
const (
	EventAppClose      = "app-close"
	EventClosed        = "closed"
	EventFatalShutdown = "fatal-shutdown"
)
