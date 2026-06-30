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
const (
	MinWindowWidth  = 1450
	MinWindowHeight = 1000
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
