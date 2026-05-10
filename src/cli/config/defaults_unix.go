//go:build unix

package config

import (
	"github.com/awslabs/filemoverexpress/constants"
)

func getDefaultBlockedPaths() []string {
	return []string{".aws", constants.DefaultAppDir, "/dev", "/etc"}
}

func getAllowedOrigins() []string {
	return []string{
		"wails://wails.localhost",
	}
}
