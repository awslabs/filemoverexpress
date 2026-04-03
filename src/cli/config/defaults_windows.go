//go:build windows

package config

import (
    "os"
    "strings"

    "github.com/awslabs/filemoverexpress/constants"
)

func getDefaultBlockedPaths() []string {
    return []string{".aws", constants.DefaultAppDir, strings.ToLower(os.Getenv("WINDIR"))}
}
