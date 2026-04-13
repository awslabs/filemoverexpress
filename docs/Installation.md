# Installation

This guide covers how to build and install File Mover Express from source.

## Prerequisites

The following tools are required on all platforms before you begin.

### Required Software

| Tool | Minimum Version | Notes |
|------|----------------|-------|
| [Go](https://go.dev/dl/) | 1.24 | Backend CLI |
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

Automatically detects your current OS and architecture.

```bash
npm run build:cli
npm run build:gui
npm run package
```

The packaged desktop app will be in `dist/` — for example `dist/File Mover Express-darwin-arm64/` on Apple Silicon.

**macOS** — optionally move to Applications:
```bash
cp -r "dist/File Mover Express-darwin-arm64/File Mover Express.app" /Applications/
```

**Windows** — optionally move to Program Files:
```powershell
Move-Item "dist\File Mover Express-win32-x64" "C:\Program Files\File Mover Express"
```

---

## Step 6 — Set up AWS

Before you can transfer files, you need an S3 bucket and AWS credentials with the right permissions.

**Create an S3 bucket** in the [S3 Console](https://s3.console.aws.amazon.com/) if you don't have one already.

**Create an IAM policy** with the minimum permissions File Mover Express needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:GetBucketLocation"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket-name",
        "arn:aws:s3:::your-bucket-name/*"
      ]
    }
  ]
}
```

Attach this policy to an IAM user or role, then configure your credentials locally by opening Terminal (macOS/Linux) or CMD (Windows):

```bash
aws configure
```

You'll be prompted for your AWS Access Key ID, Secret Access Key, and default region.

> Don't have the AWS CLI? [Install it here](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).

---

## Step 7 — Configure and start transferring

1. Launch File Mover Express and add a Remote Configuration pointing to your S3 bucket. See the [Configuration Guide](Configuration.md) for full details.
2. Start transferring files:
   - Using the GUI? See the [GUI Guide](Using-the-GUI.md)
   - Prefer the CLI? See the [CLI Guide](Using-the-CLI.md)
   - New to the app? See [Getting Started](Getting-Started.md) for your first transfer

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

## Next Steps

After building and configuring, explore the full documentation:

- [Getting Started](Getting-Started.md) — Your first transfer
- [Using the GUI](Using-the-GUI.md) — Graphical interface guide
- [Using the CLI](Using-the-CLI.md) — Command-line usage and scripting
- [Hot Folders](Hot-Folders.md) — Automated folder monitoring and uploads
- [Configuration](Configuration.md) — Advanced configuration options including remote daemon setup

---

## Troubleshooting

**`npm run proto` fails with "no such host" or DNS error**
On corporate or VPN networks (including Amazon's), `proxy.golang.org` may be blocked. Set Go to fetch modules directly before running the install:

    export GOPROXY=direct
    npm run proto

**`protoc-gen-go` not found**
The proto step installs this automatically. If it still fails, ensure `go` is on your PATH and your Go version is 1.24 or higher: `go version`

**`npm run proto` fails with "context canceled"**
Re-run `npm install` first to ensure all npm packages are present, then retry.

**Go version too old (Linux)**
The `golang-go` apt package is often behind. Install Go directly from [go.dev/dl](https://go.dev/dl/) instead.

**Permission denied on Linux/macOS binary**
```bash
chmod +x ./src/cli/dist/filemoverexpress-*
```

For more help, see the [Troubleshooting](Troubleshooting.md) guide or open an issue on [GitHub](https://github.com/awslabs/filemoverexpress/issues).
