package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

// version is set via ldflags at build time.
// Example: go build -ldflags "-X main.version=1.0.0"
var version = "dev"

func main() {
	app := NewApp(version)

	err := wails.Run(&options.App{
		Title:            ProductName,
		Width:            MinWindowWidth,
		Height:           MinWindowHeight,
		MinWidth:         MinWindowWidth,
		MinHeight:        MinWindowHeight,
		WindowStartState: options.Normal,
		StartHidden:      false,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup:     app.startup,
		OnBeforeClose: app.beforeClose,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
