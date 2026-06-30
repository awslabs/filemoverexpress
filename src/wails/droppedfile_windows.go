//go:build windows

package main

import (
	"fmt"
	"path"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func (DroppedFileResult) fromEvent(event *application.WindowEvent) *DroppedFileResult {
	if event == nil {
		return nil
	}

	files := event.Context().DroppedFiles()
	targetDetails := event.Context().DropTargetDetails()

	if files == nil || targetDetails == nil {
		return nil
	}

	paths := make(map[string]string)
	for _, file := range files {
		paths[filepath.Base(file)] = convertPathToGRPC(file)
	}

	return &DroppedFileResult{
		Files:    paths,
		TargetId: targetDetails.ElementID,
	}
}

func convertPathToGRPC(winPath string) string {
	parts := strings.SplitN(winPath, ":", 2)
	return fmt.Sprintf(
		"/%s/%s",
		parts[0],
		path.Join(strings.Split(parts[1], "\\")...),
	)
}
