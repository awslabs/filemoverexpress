//go:build windows

package serviceutils

import (
    "path/filepath"
    "strings"
)

func ConvertPathFromGRPC(inputPath string) string {
    pathParts := strings.Split(inputPath, "/")
    drive, pathParts := pathParts[1], pathParts[2:]
    newCombinedPath := make([]string, 0)
    newCombinedPath = append(newCombinedPath, strings.ToUpper(drive+":"))
    newCombinedPath = append(newCombinedPath, pathParts...)

    return strings.Join(newCombinedPath, string(filepath.Separator))
}
