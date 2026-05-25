//go:build windows

package serviceutils

import (
	"path/filepath"
	"strings"
)

func ConvertPathFromGRPC(inputPath string) string {
	inputPath = strings.TrimPrefix(inputPath, "/")

	pathParts := strings.Split(inputPath, "/")
	drive, pathParts := pathParts[0], pathParts[1:]
	newCombinedPath := make([]string, 0)
	newCombinedPath = append(newCombinedPath, strings.ToUpper(drive+":"))
	newCombinedPath = append(newCombinedPath, pathParts...)
	if len(newCombinedPath) == 1 {
		return newCombinedPath[0] + "\\"
	}

	return strings.Join(newCombinedPath, string(filepath.Separator))
}
