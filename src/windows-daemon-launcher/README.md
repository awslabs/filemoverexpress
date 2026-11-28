# File Mover Express Windows daemon launcher

[![Go Version](https://img.shields.io/badge/Go-1.27.3+-blue.svg)](https://golang.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows-blue.svg)](https://www.microsoft.com/windows)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

The Windows daemon launcher is a small Go program that starts the File Mover Express daemon on
Windows. The desktop app runs the launcher when no daemon is running, and the launcher starts
`filemoverexpress.exe daemon` as a separate process with no console window, then exits. The daemon
keeps running after the launcher exits.

The Windows installer ships three binaries in one folder: the desktop app, the launcher
(`filemoverexpress-launcher.exe`), and the daemon (`filemoverexpress.exe`).

## What it does

| File | Responsibility |
|---|---|
| `main.go` | Finds `filemoverexpress.exe` in the launcher's own folder and starts it with `daemon` as a hidden process |
| `logger/logger.go` | Writes JSON log lines to `daemon-launcher.log` |

The launcher writes `daemon-launcher.log` to `%USERPROFILE%\.filetransfer\logs\`, or to the `logs`
folder under `FILETRANSFER_CONFIG_DIR` when that variable is set. The daemon's own log is separate;
see the [Troubleshooting Guide](../../docs/Troubleshooting.md).

The desktop app finds the launcher next to its own executable (`src/wails/daemon_windows.go`).

## Building

Run these from the repository root. Setup and prerequisites are in
[`docs/Development.md`](../../docs/Development.md).

```bash
task launcher:build      # Windows hosts only: builds dist/filemoverexpress-launcher.exe
task wails:package       # on Windows, builds the launcher, daemon, and app, then the installer
```

`task launcher:build` runs only on Windows. The Windows packaging tasks in
`src/wails/build/windows/Taskfile.yml` build the same binary with `GOOS=windows`.

The launcher is its own Go module with no tests. Its only dependency is `golang.org/x/sys`.

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for general contribution guidelines.

## License

This project is licensed under the Apache License 2.0. See the [LICENSE](../../LICENSE) file for
details.
