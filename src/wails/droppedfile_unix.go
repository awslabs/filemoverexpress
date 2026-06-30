//go:build !windows

package main

import (
	"path/filepath"

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
		paths[filepath.Base(file)] = file
	}

	return &DroppedFileResult{
		Files:    paths,
		TargetId: targetDetails.ElementID,
	}
}
