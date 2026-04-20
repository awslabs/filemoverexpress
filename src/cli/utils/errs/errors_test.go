package errs

import (
	"errors"
	"os"
	"os/exec"
	"testing"
)

func TestCheckError(t *testing.T) {
	err := errors.New("this is an error")
	CheckError(err, "An error occured: ", false)
}

func TestCheckErrorWithExit(t *testing.T) {
	if os.Getenv("TEST_ERROR_EXIT") == "1" {
		err := errors.New("this is an error")
		CheckError(err, "An error occured", true)
		return
	}
	cmd := exec.Command(os.Args[0], "-test-run=TestCheckErrorWithExit")
	cmd.Env = append(cmd.Env, "TEST_ERROR_EXIT=1")
	err := cmd.Run()
	var e *exec.ExitError
	if errors.As(err, &e) && !e.Success() {
		return
	}
	t.Errorf("TestCheckErrorWithExit failed, expected function to os.Exit")
}
