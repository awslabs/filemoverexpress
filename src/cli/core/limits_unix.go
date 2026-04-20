//go:build !windows

package core

import (
	"syscall"

	"github.com/awslabs/filemoverexpress/constants"
)

func CheckLimits() error {
	var nofile syscall.Rlimit

	err := syscall.Getrlimit(syscall.RLIMIT_NOFILE, &nofile)
	if err != nil {
		return err
	}

	if nofile.Cur >= constants.RequiredLimits {
		return nil
	}

	nofile.Cur = constants.RequiredLimits
	err = syscall.Setrlimit(syscall.RLIMIT_NOFILE, &nofile)
	if err != nil {
		return err
	}

	return nil
}
