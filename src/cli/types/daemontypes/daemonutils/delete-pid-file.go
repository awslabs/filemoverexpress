package daemonutils

import (
	"os"
	"path/filepath"

	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/utils/fs"
)

func DeletePidFile() {
	pidFilePath := filepath.Join(config.GetConfigDir(), constants.ProductCLIName+".pid")
	if fs.FileExists(pidFilePath) {
		err := os.Remove(pidFilePath)
		if err != nil {
			logger.SendLog("Warn", "Failed to delete pid file")
		}
	}
}
