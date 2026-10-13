package main

import (
	"embed"
	"log"
	"sync"

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
		Description: "File Mover Express",
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
		Name: "main",
		// Set to the product name so Windows uses it for the taskbar entry and the
		// window's right-click menu (the frameless window has no visible OS title bar,
		// so this is not shown as redundant chrome next to the app's own top bar).
		Title:              ProductName,
		Width:              DefaultWindowWidth,
		Height:             DefaultWindowHeight,
		MinWidth:           MinWindowWidth,
		MinHeight:          MinWindowHeight,
		InitialPosition:    application.WindowCentered,
		URL:                "/",
		EnableFileDrop:     true,
		DevToolsEnabled:    true,
		UseApplicationMenu: true,
	})

	// Hand the window to the app so the close/quit seam can flush its geometry.
	fmeApp.window = window

	// Register window close hook to allow frontend graceful shutdown.
	window.RegisterHook(events.Common.WindowClosing, fmeApp.HandleBeforeClose)

	window.OnWindowEvent(events.Common.WindowFilesDropped, func(event *application.WindowEvent) {
		app.Event.Emit("files-dropped", DroppedFileResult{}.fromEvent(event))
	})

	// macOS surfaces when an OS file drag enters/leaves the window (there is no per-move
	// event). The GUI uses these to highlight the S3 panel as a drop zone, so users
	// discover they can drag files in from Finder. Windows has no equivalent hover event;
	// the drop itself still works there.
	window.OnWindowEvent(events.Mac.WindowFileDraggingEntered, func(_ *application.WindowEvent) {
		app.Event.Emit("file-dragging-entered", nil)
	})
	window.OnWindowEvent(events.Mac.WindowFileDraggingExited, func(_ *application.WindowEvent) {
		app.Event.Emit("file-dragging-exited", nil)
	})

	// On first show, clamp the window to the display's work area, then restore the
	// saved size/position (or center if there is no valid saved state). Clamping
	// first means a restored size can never exceed the current screen (e.g. after a
	// resolution downgrade since the last save). Native window methods are no-ops
	// until the window is realized in Run(), so this runs on the WindowShow event;
	// sync.Once limits it to the initial show (restoring from minimize won't
	// re-run restore on a window the user has moved).
	var fitWindowOnce sync.Once
	window.OnWindowEvent(events.Common.WindowShow, func(_ *application.WindowEvent) {
		fitWindowOnce.Do(func() {
			screen, err := window.GetScreen()
			if err != nil || screen == nil {
				return
			}
			if wa := screen.WorkArea; wa.Width > 0 && wa.Height > 0 {
				w, h := window.Size()
				if w > wa.Width {
					w = wa.Width
				}
				if h > wa.Height {
					h = wa.Height
				}
				window.SetSize(w, h)
			}
			// Restore saved geometry if it is valid and still on-screen; otherwise
			// center as before.
			if !fmeApp.windowState.Restore(window) {
				window.Center()
			}
		})
	})

	// Persist geometry on move/resize (debounced). WindowDidMove and
	// WindowDidResize are the only common window events confirmed to map to native
	// events on Windows, macOS, and Linux. The maximized flag is captured here when
	// present, and authoritatively on close (see FMEApp.saveWindowState), which is
	// the only path that observes it on Linux/GTK.
	window.OnWindowEvent(events.Common.WindowDidMove, func(_ *application.WindowEvent) {
		fmeApp.windowState.ScheduleSave(window)
	})
	window.OnWindowEvent(events.Common.WindowDidResize, func(_ *application.WindowEvent) {
		fmeApp.windowState.ScheduleSave(window)
	})

	// Listen for the 'closed' event from frontend to quit the app.
	app.Event.On(EventClosed, func(e *application.CustomEvent) {
		app.Quit()
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
