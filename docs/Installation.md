# Installation

This guide covers how to build and install File Mover Express from source.

## Prerequisites

The following tools are required on all platforms before you begin.

### Required Software

| Tool | Minimum Version | Notes |
|------|----------------|-------|
| [Go](https://go.dev/dl/) | 1.25 | Backend CLI |
| [Node.js](https://nodejs.org/) | 22 | Build tooling and GUI |
| [Git](https://git-scm.com/) | Any | Source control |
| [golangci-lint](https://golangci-lint.run/usage/install/) | Latest | Go linter |

### Hardware Requirements

- 8 logical CPU cores (recommended)
- 8 GB RAM (recommended)

Transfer speeds depend on your hardware, network configuration, and available bandwidth.

---

## Step 1 — Install prerequisites

### macOS

```bash
brew install go node git golangci-lint
```

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y golang-go nodejs npm git
```

Install golangci-lint by following the [official guide](https://golangci-lint.run/usage/install/) — the version in apt is often outdated.

### Windows

Install the following using [winget](https://learn.microsoft.com/en-us/windows/package-manager/winget/) or their official installers:

```powershell
winget install GoLang.Go OpenJS.NodeJS Git.Git
```

Install golangci-lint by following the [official guide](https://golangci-lint.run/usage/install/).

---

## Step 2 — Clone the repository

```bash
git clone https://github.com/awslabs/filemoverexpress.git
cd filemoverexpress
```

---

## Step 3 — Install npm dependencies

```bash
npm install
```

---

## Step 4 — Generate protobuf code

```bash
npm run proto
```

This will automatically install any missing Go protobuf plugins (`protoc-gen-go`, `protoc-gen-connect-go`) before generating the code.

---

## Step 5 — Build

This is the only step that differs by platform.

### macOS

```bash
npm run --prefix src/cli build:mac
npm run --prefix src/gui build:production
```

### Linux

```bash
npm run --prefix src/cli build:linux
npm run --prefix src/gui build:production
```

### Windows

```powershell
npm run --prefix src/cli build:windows
npm run --prefix src/gui build:production
```

---

## Step 6 — Run the application

After building, you have two options depending on how you want to use FME:

### Option A — CLI only

Run the daemon directly from the built binary. The GUI will be accessible in your browser at `http://localhost:50006`.

### macOS (Intel)
```bash
./dist/filemoverexpress-darwin-amd64 daemon
```

### macOS (Apple Silicon)
```bash
./dist/filemoverexpress-darwin-arm64 daemon
```

### Linux
```bash
./dist/filemoverexpress-linux-amd64 daemon
```

### Windows
```powershell
.\dist\filemoverexpress-windows-amd64.exe daemon
```

### Option B — Desktop app (Electron)

To run the full desktop application with the GUI bundled as a native window, build and launch the Electron wrapper after completing Steps 1–5:

```bash
# Build the Electron app
npm run --prefix src/electron build

# Launch it
cd src/electron/dist && electron .
```

Or in development mode (GUI hot-reload):

```bash
npm run --prefix src/gui electron:dev
```

---

## Uninstall

**1. Stop the daemon** if it's running:

```bash
# macOS / Linux
pkill filemoverexpress

# Windows (PowerShell)
Stop-Process -Name filemoverexpress -ErrorAction SilentlyContinue
```

**2. Remove the application:**

macOS:
```bash
rm -rf /Applications/File\ Mover\ Express.app
# or if you didn't move it to Applications:
rm -rf dist/File\ Mover\ Express-darwin-arm64
```

Windows — delete the folder you moved to Program Files, or the `dist\File Mover Express-win32-x64` folder.

Linux:
```bash
rm -rf dist/File\ Mover\ Express-linux-x64
```

**3. Remove configuration and logs** (optional — skip this if you want to keep your transfer profiles):

```bash
# macOS / Linux
rm -rf ~/.filemoverexpress

# Windows (PowerShell)
Remove-Item -Recurse -Force "$env:USERPROFILE\.filemoverexpress"
```

---

1. Configure your AWS credentials: `aws configure`
2. Follow the [Configuration](Configuration.md) guide to set up S3 buckets and transfer settings
3. See [Getting Started](Getting-Started.md) for your first transfer

---

## Troubleshooting

**`npm run proto` fails with "no such host" or DNS error**
On corporate or VPN networks (including Amazon's), `proxy.golang.org` may be blocked. Set Go to fetch modules directly before running the install:

    export GOPROXY=direct
    npm run proto

**`protoc-gen-go` not found**
The proto step installs this automatically. If it still fails, ensure `go` is on your PATH and your Go version is 1.25 or higher: `go version`

**`npm run proto` fails with "context canceled"**
Re-run `npm install` first to ensure all npm packages are present, then retry.

**Go version too old (Linux)**
The `golang-go` apt package is often behind. Install Go directly from [go.dev/dl](https://go.dev/dl/) instead.

**Permission denied on Linux/macOS binary**
```bash
chmod +x ./src/cli/dist/filemoverexpress-*
```

For more help, see the [Troubleshooting](Troubleshooting.md) guide or open an issue on [GitHub](https://github.com/awslabs/filemoverexpress/issues).
