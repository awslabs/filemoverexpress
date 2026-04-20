package logger

import (
	"fmt"
	"log/slog"
	"os"
	"os/user"
	"path/filepath"
)

const (
	logFileName   = "daemon-launcher.log"
	defaultAppDir = ".filetransfer"
)

var Logger *slog.Logger

type LogLevel string

func getConfigDir() string {
	// use environment variable value if exists and not empty
	if envConfigDir, exists := os.LookupEnv("FILETRANSFER_CONFIG_DIR"); exists {
		return envConfigDir
	}

	usr, err := user.Current()
	if err != nil {
		fmt.Printf("Failed to setup logger: %s\n", usr)
		return ""
	}

	return filepath.Join(usr.HomeDir, defaultAppDir)
}

// Init configures the logging level and sets the log file path.
func init() {
	logPath := filepath.Join(getConfigDir(), "logs", logFileName)
	lf, err := os.OpenFile(logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		fmt.Printf("Failed to create log file: %s\n", err)
	}
	Logger = slog.New(slog.NewJSONHandler(lf, nil))
}
