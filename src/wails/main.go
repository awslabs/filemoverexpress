package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

var (
	//go:embed all:frontend/dist/browser/*
	assets embed.FS
	// version is set via ldflags at build time.
	// Example: go build -ldflags "-X main.version=1.0.0"
	// The default is the GUI's dev sentinel (VersionNumber.VERSION_DEV) so that
	// builds without an injected version (wails3 dev, un-versioned local builds)
	// are treated as "development" by the GUI and don't block version-gated
	// features. See issue #12.
	version = "0.0.0-local-dev"
)

type (
	DroppedFileResult struct {
		Files    map[string]string `json:"files"`
		TargetId string            `json:"targetId"`
	}
)

func main() {
	fmeApp := NewFMEApp(version)

	app := application.New(application.Options{
		Name:        ProductName,
		Description: "File Mover Express for AWS",
		Services: []application.Service{
			application.NewService(fmeApp),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
		ShouldQuit: fmeApp.ShouldQuit,
	})

	//app.Menu.Set(createMenu(app))

	app.KeyBinding.Add("Ctrl+J", func(window application.Window) {
		window.OpenDevTools()
	})

	window := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:               "main",
		Title:              ProductName,
		Width:              MinWindowWidth,
		Height:             MinWindowHeight,
		MinWidth:           MinWindowWidth,
		MinHeight:          MinWindowHeight,
		URL:                "/",
		EnableFileDrop:     true,
		DevToolsEnabled:    true,
		UseApplicationMenu: true,
	})

	// Register window close hook to allow frontend graceful shutdown.
	window.RegisterHook(events.Common.WindowClosing, fmeApp.HandleBeforeClose)

	window.OnWindowEvent(events.Common.WindowFilesDropped, func(event *application.WindowEvent) {
		app.Event.Emit("files-dropped", DroppedFileResult{}.fromEvent(event))
	})

	// Listen for the 'closed' event from frontend to quit the app.
	app.Event.On(EventClosed, func(e *application.CustomEvent) {
		app.Quit()
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
