# Development

This guide covers setting up a development environment, building from source, and contributing to File Mover Express.

## Prerequisites

| Tool | Minimum Version | Notes |
|------|----------------|-------|
| [Go](https://go.dev/dl/) | 1.24 | Backend CLI |
| [Node.js](https://nodejs.org/) | 22 | Build tooling and GUI |
| [Git](https://git-scm.com/) | Any | Source control |
| [golangci-lint](https://golangci-lint.run/usage/install/) | Latest | Go linter |

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

```powershell
winget install GoLang.Go OpenJS.NodeJS Git.Git
```

Install golangci-lint by following the [official guide](https://golangci-lint.run/usage/install/).

---

## Architecture

```
filemoverexpress/
├── src/
│   ├── cli/                    # Go CLI daemon and backend services
│   ├── gui/                    # Angular GUI application
│   ├── electron/               # Electron wrapper for desktop deployment
│   ├── protobuf/               # Protocol buffer definitions
│   ├── build-scripts/          # TypeScript build automation
│   └── installers/             # Platform-specific installer packages
├── docs/                       # Documentation
├── CONTRIBUTING.md             # Contribution guidelines
├── SECURITY.md                 # Security policy
└── README.md                   # Project overview
```

---

## Building from Source

### Quick build (recommended)

`npm run package` runs the full build pipeline in the correct order — protobuf generation, CLI, GUI, Electron packaging — and produces a ready-to-run desktop app.

```bash
git clone https://github.com/awslabs/filemoverexpress.git
cd filemoverexpress
npm install
npm run package
```

The packaged app will be in `dist/`.

### Individual build steps

If you need to run steps individually:

```bash
# Build the CLI only (auto-detects your OS and architecture)
npm run build:cli

# Build the GUI only
npm run build:gui
```

### Running tests

```bash
npm run test:all            # Run all tests (CLI and GUI)
npm run test:cli            # Run CLI unit tests only
npm run test:gui            # Run GUI unit tests only
```

### Linting

```bash
npm run lint:all            # Lint all code
npm run lint:cli            # golangci-lint on Go code
npm run lint:gui            # ESLint on TypeScript/Angular code
```

### Cleaning build artifacts

```bash
npm run clean:all           # Clean all build artifacts
npm run clean:cli           # Clean CLI artifacts only
npm run clean:gui           # Clean GUI artifacts only
```

---

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run package` | Full build pipeline: proto → CLI → GUI → Electron packaging |
| `npm run proto` | Generate protobuf code for CLI and GUI |
| `npm run build:cli` | Build CLI for current platform |
| `npm run build:gui` | Build GUI production bundle |
| `npm run test:all` | Run all tests |
| `npm run test:cli` | Run CLI unit and integration tests |
| `npm run test:gui` | Run GUI unit tests via Karma |
| `npm run lint:all` | Lint all code |
| `npm run clean:all` | Remove all build artifacts |

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VERSION` | Override version number | Value from package.json |
| `PRODUCT_NAME` | Override product name | `filemoverexpress` |
| `BUILD_MODE` | Set to `dev` for development builds | `release` |

---

## GUI Development

If you're working on the Angular GUI and want hot-reload during development:

```bash
npm run --prefix src/gui start
```

This runs `ng serve` and serves the GUI at `http://localhost:4200`. You'll need the CLI daemon running separately for the GUI to connect to.

> **Note:** You may need to add `http://localhost:4200` to the `allowed_origins` list in your configuration file for CORS to work during development. See [Configuration](Configuration.md) for details.

---

## Development Workflow

1. Fork the repository
2. Create a feature branch: `feat/my-feature` or `fix/my-fix`
3. Make changes and ensure all tests pass
4. Follow the guidelines in [CONTRIBUTING.md](../CONTRIBUTING.md)
5. Submit a pull request with a clear description of changes

---

## Troubleshooting

**`npm run proto` fails with "no such host" or DNS error**
On corporate or VPN networks, `proxy.golang.org` may be blocked:

```bash
export GOPROXY=direct
npm run proto
```

**`protoc-gen-go` not found**
The proto step installs this automatically. If it still fails, ensure `go` is on your PATH and your Go version is 1.24 or higher: `go version`

**Go version too old (Linux)**
The `golang-go` apt package is often behind. Install Go directly from [go.dev/dl](https://go.dev/dl/) instead.

**Permission denied on Linux/macOS binary**
```bash
chmod +x ./src/cli/dist/filemoverexpress-*
```

For more help, see the [Troubleshooting](Troubleshooting.md) guide or open an issue on [GitHub](https://github.com/awslabs/filemoverexpress/issues).
