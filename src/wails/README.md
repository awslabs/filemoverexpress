# File Mover Express desktop app

The File Mover Express desktop app is a [Wails 3](https://v3alpha.wails.io/) application written in
Go. It hosts the Angular GUI from `src/gui` in a native window and gives the GUI the native
features a browser cannot provide. The transfer daemon is not part of this binary: the app starts
the `filemoverexpress` daemon as a separate process when none is running and talks to it over the
same ConnectRPC API as every other client.

## What it does

| File | Responsibility |
|---|---|
| `main.go` | Creates the Wails application and window, embeds the GUI build, and wires window events |
| `app.go` | `FMEApp`, the service Wails binds to the GUI: dialogs, opening files, window close and quit handling |
| `daemon.go`, `daemon_unix.go`, `daemon_windows.go` | Finds, starts, and checks the daemon process |
| `export.go` | Builds the XLSX, CSV, and JSON job reports |
| `firstlaunch.go` | Detects the first launch with a marker file |
| `guiconfig.go`, `windowstate.go` | Saves GUI preferences and the window size and position to `gui.json` |
| `oidc_discovery.go` | Checks that an OIDC issuer URL serves a valid discovery document |
| `droppedfile_*.go`, `app_darwin.go`, `app_other.go` | Platform-specific file drop and PATH handling |
| `build/` | Per-platform packaging: app bundle and DMG on macOS, installer on Windows, AppImage on Linux |
| `frontend/dist/` | The GUI build that `main.go` embeds. Generated, not committed |

The exported methods of `FMEApp` become TypeScript bindings in `src/gui/src/gen/wails/`. After you
add, rename, or change one, run `task generate` and update the callers in
`src/gui/src/app/services/wails/`.

## Building and running

Run these from the repository root. Setup and prerequisites are in
[`docs/Development.md`](../../docs/Development.md).

```bash
task generate        # protobuf code and Wails bindings; run first
task wails:build     # builds the GUI, then the desktop app for this platform
task wails:package   # packages the app (bundle, installer, or AppImage)
task dev             # runs the app with hot reload
```

## Testing and linting

```bash
task test:wails      # Go tests
task wails:lint      # golangci-lint for Linux, macOS, and Windows
```

`task wails:lint` uses the repository's `.golangci.yml`, the same configuration as `src/cli`, so the
two Go modules follow one set of rules. It builds with the `server` tag and without CGO, so it runs
on any host without GTK or a native toolchain.

The Wails Go tests embed the GUI build. Run `task gui:build` first, or the package does not
compile.

## Browser end-to-end tests

The `server` build tag compiles the app to serve the GUI over HTTP instead of opening a native
window. The Playwright suite in `src/gui/e2e` uses that build. See `src/gui/e2e/README.md`.
