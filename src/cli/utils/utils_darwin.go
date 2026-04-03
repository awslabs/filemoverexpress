//go:build darwin

package utils

import (
    "context"
    "os"
    "os/exec"
    "strconv"

    "github.com/awslabs/filemoverexpress/logger"
)

// RunCaffeinate runs caffeinate on Macs to prevent sleep only if config general.no_sleep is set to true
func RunCaffeinate() {
    pid := strconv.Itoa(os.Getpid())
    ctx := context.Background()
    caffCmd := exec.CommandContext(ctx, "caffeinate", "-s", "-i", "-m", "-w", pid)
    caffErr := caffCmd.Start()
    if caffErr != nil {
        logger.Error(strSleepPreventionUnsuccessful)
    }
}
