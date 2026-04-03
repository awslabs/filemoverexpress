# File Mover Express Windows Daemon Launcher

[![Go Version](https://img.shields.io/badge/Go-1.25+-blue.svg)](https://golang.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows-blue.svg)](https://www.microsoft.com/windows)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

The Windows Daemon Launcher is a lightweight Windows service wrapper that manages the File Mover Express CLI daemon on Windows systems. It
ensures the daemon starts automatically with Windows and runs in the background as a system service.

## Overview

The launcher provides:

- **Windows Service**: Runs CLI daemon as a Windows service
- **Auto-Start**: Automatically starts daemon on system boot
- **Process Management**: Monitors and restarts daemon if it crashes
- **Logging**: Service-level logging for troubleshooting
- **Clean Shutdown**: Graceful daemon shutdown on service stop

## Architecture

```
src/windows-daemon-launcher/
├── main.go                     # Service entry point
├── logger/
│   └── logger.go               # Windows event log integration
├── go.mod                      # Go module dependencies
├── go.sum                      # Dependency checksums
├── Makefile                    # Build automation
└── package.json                # npm build integration
```

## Prerequisites

- **Go** 1.25 or higher
- **Windows** operating system
- **Administrator privileges** for service installation

## Building

### Quick Build

From the repository root:

```bash
# Build Windows launcher
npm run --prefix src/windows-daemon-launcher build
```

### Manual Build

From the `src/windows-daemon-launcher` directory:

```bash
# Build for Windows
GOOS=windows GOARCH=amd64 go build -o filemoverexpress-launcher.exe

# Or use Makefile
make build
```

Built executable is placed in the current directory.

## Installation

### Installing as Windows Service

```powershell
# Run as Administrator
.\filemoverexpress-launcher.exe install

# Start the service
.\filemoverexpress-launcher.exe start

# Check service status
sc query "File Mover Express Daemon"
```

### Service Configuration

The service is configured with:

- **Service Name**: `FileMoverExpressDaemon`
- **Display Name**: `File Mover Express Daemon`
- **Start Type**: Automatic
- **Dependencies**: None

## Usage

### Service Management

```powershell
# Start service
.\filemoverexpress-launcher.exe start

# Stop service
.\filemoverexpress-launcher.exe stop

# Restart service
.\filemoverexpress-launcher.exe restart

# Uninstall service
.\filemoverexpress-launcher.exe uninstall

# Check service status
.\filemoverexpress-launcher.exe status
```

### Using Windows Services Manager

1. Open Services (`services.msc`)
2. Find "File Mover Express Daemon"
3. Right-click for Start/Stop/Restart options
4. Properties for startup configuration

## Logging

The launcher logs to Windows Event Log:

- **Log Name**: Application
- **Source**: FileMoverExpressDaemon
- **Event IDs**:
    - 1000: Service started
    - 1001: Service stopped
    - 1002: Daemon process started
    - 1003: Daemon process stopped
    - 2000: Error events

### Viewing Logs

```powershell
# View recent events
Get-EventLog -LogName Application -Source FileMoverExpressDaemon -Newest 20

# View error events only
Get-EventLog -LogName Application -Source FileMoverExpressDaemon -EntryType Error
```

Or use Event Viewer:

1. Open Event Viewer (`eventvwr.msc`)
2. Navigate to Windows Logs > Application
3. Filter by Source: FileMoverExpressDaemon

## Development

### Project Structure

- **main.go**: Service lifecycle management and daemon process control
- **logger/**: Windows event log integration for service logging

### Key Components

**Service Interface**

```go
type daemonService struct {
    cmd *exec.Cmd
}

func (s *daemonService) Start(svc svc.Service) error {
    // Start daemon process
}

func (s *daemonService) Stop(svc svc.Service) error {
    // Stop daemon process gracefully
}
```

**Process Management**

- Starts filemoverexpress daemon executable
- Monitors process health
- Restarts on unexpected termination
- Handles graceful shutdown signals

### Building from Source

```bash
# Install dependencies
go mod download

# Build
go build -o filemoverexpress-launcher.exe

# Build with version info
go build -ldflags "-X main.version=1.0.0" -o filemoverexpress-launcher.exe
```

## Configuration

The launcher looks for the daemon executable in:

1. Same directory as launcher
2. Program Files installation directory
3. PATH environment variable

Default daemon path: `C:\Program Files\File Mover Express\filemoverexpress.exe`

## Troubleshooting

### Common Issues

**Service Won't Start**

```powershell
# Check if daemon executable exists
Test-Path "C:\Program Files\File Mover Express\filemoverexpress.exe"

# Check event log for errors
Get-EventLog -LogName Application -Source FileMoverExpressDaemon -EntryType Error -Newest 5

# Try running daemon manually
& "C:\Program Files\File Mover Express\filemoverexpress.exe" daemon
```

**Service Crashes Repeatedly**

```powershell
# Check daemon logs
Get-Content "$env:USERPROFILE\.filemoverexpress\logs\daemon.log" -Tail 50

# Verify daemon configuration
Get-Content "$env:USERPROFILE\.filemoverexpress\config.yaml"
```

**Permission Errors**

```powershell
# Ensure running as Administrator
# Right-click PowerShell > Run as Administrator

# Check service account permissions
sc qc "FileMoverExpressDaemon"
```

**Service Won't Uninstall**

```powershell
# Stop service first
.\filemoverexpress-launcher.exe stop

# Then uninstall
.\filemoverexpress-launcher.exe uninstall

# If still fails, use sc command
sc delete "FileMoverExpressDaemon"
```

For more troubleshooting information, see the [Troubleshooting Guide](../../docs/Troubleshooting.md).

## Security Considerations

- Service runs under Local System account by default
- Daemon inherits service account permissions
- Ensure daemon configuration file has appropriate ACLs
- Limit access to service executable and configuration

### Recommended Permissions

```powershell
# Set restrictive permissions on daemon directory
icacls "C:\Program Files\File Mover Express" /inheritance:r
icacls "C:\Program Files\File Mover Express" /grant:r "Administrators:(OI)(CI)F"
icacls "C:\Program Files\File Mover Express" /grant:r "SYSTEM:(OI)(CI)F"
```

## Uninstallation

```powershell
# Stop and uninstall service
.\filemoverexpress-launcher.exe stop
.\filemoverexpress-launcher.exe uninstall

# Remove executable (optional)
Remove-Item ".\filemoverexpress-launcher.exe"
```

## Contributing

Contributions to the Windows launcher are welcome. Please:

1. Test on multiple Windows versions (10, 11, Server)
2. Ensure proper error handling and logging
3. Follow Go best practices
4. Test service installation and uninstallation
5. Update documentation for changes

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for general contribution guidelines.

## Resources

- [Windows Services Documentation](https://docs.microsoft.com/en-us/windows/win32/services/services)
- [Go Windows Service Package](https://github.com/kardianos/service)
- [Windows Event Log](https://docs.microsoft.com/en-us/windows/win32/eventlog/event-logging)

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.
