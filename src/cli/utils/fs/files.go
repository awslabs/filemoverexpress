package fs

import (
	"errors"
	"fmt"
	"os"

	"github.com/awslabs/filemoverexpress/logger"
)

// CloseFile is a helper function to close file objects and checks for any errs on the close. If an error occurs with
// exit set to true the program will exit with error code 1. If exit is set to false and an error occurs the function
// will return false. If the file is closed successfully true is returned instead

type CloseFileInput struct {
	File *os.File
	Exit bool
}

func CloseFile(input CloseFileInput) bool {
	if err := input.File.Close(); err != nil {
		logger.Error("Error closing file %s: %s", input.File.Name(), err)
		if input.Exit {
			os.Exit(1)
		}

		return false
	}

	return true
}

func FileExists(path string) bool {
	if _, err := os.Stat(path); err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			logger.Warn(fmt.Sprintf("Error when checking for file existance for %s: %s", path, err))
		}

		return false
	}

	return true
}

func DeleteFile(pathname string) error {
	if FileExists(pathname) {
		err := os.Remove(pathname)
		if err != nil {
			return err
		}
	}
	return nil
}
