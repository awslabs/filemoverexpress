//go:build windows

package mhl

import "path/filepath"

func getMhlPathByOs(mhlFileEntryPath string) string {
    return filepath.FromSlash(mhlFileEntryPath)
}
