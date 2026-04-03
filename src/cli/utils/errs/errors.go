package errs

import (
    "github.com/awslabs/filemoverexpress/events"
    "github.com/awslabs/filemoverexpress/utils"
)

// CheckError is a wrapper function for CheckErrorWithCode without having to provide an exit code. If exit is true
// the exit code will be 1
func CheckError(err error, message string, exit bool) {
    CheckErrorWithCode(err, message, exit)
}

// CheckErrorWithCode checks to see if the error is non-nil, and if so it will print the provided message followed by
// the error object. If exit is true, it exits the program with the provided error code
//
//revive:disable:flag-parameter
//nolint:gci
func CheckErrorWithCode(err error, message string, exit bool) {
    if err != nil {
        if exit {
            events.Events.Fatal(utils.Capitalize(message + err.Error() + "\n"))
        } else {
            events.Events.Error(utils.Capitalize(message + err.Error() + "\n"))
        }
    }
}

//revive:enable:flag-parameter
