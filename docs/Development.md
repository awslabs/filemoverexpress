# Development

This guide covers setting up a development environment, building from source, and contributing to File Mover Express.

## Prerequisites

| Tool | Minimum Version | Notes |
|------|----------------|-------|
| [Go](https://go.dev/dl/) | 1.25 | CLI daemon and the Wails desktop app |
| [Node.js](https://nodejs.org/) | 22 | GUI (Angular) and workspace tooling |
| [Git](https://git-scm.com/) | Any | Source control |
| [Task](https://taskfile.dev/installation/) | 3 | Build runner — every build/test/lint target is a Task |
| [Wails CLI](https://v3alpha.wails.io/getting-started/installation/) (`wails3`) | v3 (alpha) | Builds the desktop app and generates frontend bindings |
| [golangci-lint](https://golangci-lint.run/usage/install/) | Latest | Go linter |

The build is driven by [Task](https://taskfile.dev) (`Taskfile.yml` at the repo root plus a
`Taskfile.yml` in each `src/*` package). The `npm run *` scripts are thin wrappers that call
Task, so you can use either `task <name>` or `npm run <name>`.

Install the Wails v3 CLI with:

```bash
go install github.com/wailsapp/wails/v3/cmd/wails3@latest
```

### macOS

```bash
brew install go node git go-task golangci-lint
```

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y nodejs npm git
```

Install Go from [go.dev/dl](https://go.dev/dl/) (the `golang-go` apt package is often behind),
Task by following the [Task install guide](https://taskfile.dev/installation/), and
golangci-lint by following the [official guide](https://golangci-lint.run/usage/install/) — the
apt versions are frequently outdated. Building the desktop app on Linux also requires the Wails
system dependencies (GTK/WebKit); see the [Wails Linux prerequisites](https://v3alpha.wails.io/getting-started/installation/).

### Windows

```powershell
winget install GoLang.Go OpenJS.NodeJS Git.Git Task.Task
```

Install golangci-lint by following the [official guide](https://golangci-lint.run/usage/install/).

---

## Architecture

```
filemoverexpress/
├── src/
│   ├── cli/                    # Go CLI daemon and backend services
│   ├── gui/                    # Angular GUI application (Wails frontend)
│   ├── wails/                  # Wails 3 desktop app (Go); embeds the GUI and the daemon
│   ├── protobuf/               # Protocol buffer definitions (buf)
│   └── windows-daemon-launcher/ # Windows daemon launcher helper
├── Taskfile.yml                # Root build orchestration (Task)
├── docs/                       # Documentation
├── CONTRIBUTING.md             # Contribution guidelines
├── SECURITY.md                 # Security policy
└── README.md                   # Project overview
```

The desktop application is built with [Wails 3](https://v3alpha.wails.io/): `src/wails/` is a Go
app that embeds the Angular GUI from `src/gui/` as its frontend and compiles the transfer daemon
into the same binary. The standalone `filemoverexpress` CLI in `src/cli/` is still built and used
for scripting and headless operation.

---

## Building from Source

### Quick build (recommended)

`task build` runs the build in the correct order — CLI, GUI, and the Wails desktop app.

```bash
git clone https://github.com/awslabs/filemoverexpress.git
cd filemoverexpress
npm install
task generate           # generate protobuf + Wails bindings (first build only, or after proto/Go changes)
task build
```

Build outputs land in `dist/` (CLI binaries) and `src/wails/build/bin/` (the desktop app).
The `npm run *` scripts (e.g. `npm run build`) are thin wrappers around these tasks if you
prefer npm.

> **Tip:** Task caches by input checksums, so re-running `task build` only rebuilds what changed.
> On a corporate/VPN network where `proxy.golang.org` is blocked, prefix Go builds with
> `GOPROXY=direct` (see Troubleshooting below).

### Individual build steps

If you need to run steps individually:

```bash
# Generate all code (protobuf + Wails bindings)
task generate

# Generate protobuf code only (Go + TypeScript)
task proto:generate

# Build the CLI only (auto-detects your OS and architecture)
task cli:build

# Build the GUI only
task gui:build

# Build the Wails desktop app
task wails:build
```

### Running tests

```bash
task test                   # Run all tests (CLI, Wails, GUI)
task cli:test               # Go CLI unit tests
task test:wails             # Wails (Go) tests
task gui:test               # GUI unit tests (Vitest, via ng test)
```

The GUI test suite runs on [Vitest](https://vitest.dev/) (it replaced Karma). `task gui:test`
invokes `ng test --watch=false --coverage`.

### Linting

```bash
task lint                   # Lint all code (CLI + GUI)
task cli:lint               # golangci-lint on Go code
task gui:lint               # ESLint on TypeScript/Angular code
```

### Cleaning build artifacts

```bash
task clean                  # Remove build artifacts and generated code
```

---

## Available Commands

Task is the primary interface; most targets have a matching `npm run` wrapper.

| Task | npm wrapper | Description |
|------|-------------|-------------|
| `task build` | `npm run build` | Build CLI, GUI, and the Wails desktop app |
| `task generate` | — | Generate all code (protobuf + Wails bindings) |
| `task proto:generate` | `npm run build:proto` | Generate protobuf code only (Go + TypeScript) |
| `task cli:build` | `npm run build:cli` | Build CLI for current platform |
| `task gui:build` | `npm run build:gui` | Build GUI production bundle |
| `task wails:build` | `npm run build:wails` | Build the Wails desktop app |
| `task test` | `npm run test` | Run all tests |
| `task cli:test` | `npm run test:cli` | Run CLI unit and integration tests |
| `task test:wails` | `npm run test:wails`* | Run Wails (Go) tests |
| `task gui:test` | `npm run test:gui` | Run GUI unit tests via Vitest |
| `task lint` | `npm run lint` | Lint all code |
| `task dev` | — | Run the desktop app in hot-reload dev mode (`wails3 dev`) |
| `task clean` | — | Remove all build artifacts and generated code |

<sub>* `npm run test:wails` currently maps to a non-existent `task wails:test` in `package.json`;
use `task test:wails` until that wrapper is fixed.</sub>

Run `task --list` to see every available target.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BUILD_VERSION` | Version stamped into the built binaries | `0.0.0-local-dev` |
| `GOPROXY` | Set to `direct` if `proxy.golang.org` is blocked on your network | Go default |

---

## Desktop Development

To run the full desktop app with hot reload (frontend + Go backend):

```bash
task dev
```

This runs `wails3 dev`, which rebuilds and reloads the app as you edit the Go or Angular code.

### GUI-only in a browser

If you're working on the Angular GUI and want to iterate in a browser instead:

```bash
npm run --prefix src/gui start
```

This runs `ng serve` and serves the GUI at `http://localhost:4200`. You'll need the CLI daemon
running separately (`filemoverexpress daemon`) for the GUI to connect to.

> **Note:** When serving in a browser, you may need to add `http://localhost:4200` to the
> `allowed_origins` list in your configuration file for CORS to work during development. The
> packaged Wails app uses its own webview origin and does not need this. See
> [Configuration](Configuration.md) for details.

---

## Development Workflow

1. Fork the repository
2. Create a feature branch: `feat/my-feature` or `fix/my-fix`
3. Make changes and ensure all tests pass
4. Follow the guidelines in [CONTRIBUTING.md](../CONTRIBUTING.md)
5. Submit a pull request with a clear description of changes

---

## Troubleshooting

**`task generate` / `task proto:generate` fails with "no such host" or DNS error**
On corporate or VPN networks, `proxy.golang.org` may be blocked:

```bash
export GOPROXY=direct
task generate          # or: task proto:generate for protobuf only
```

**`protoc-gen-go` or `wails3` not found**
The proto step installs the protobuf plugins automatically. If it still fails, ensure `go` is on
your PATH and your Go version is 1.25 or higher (`go version`), and that `$(go env GOPATH)/bin` is
on your PATH so the generated-code plugins and the `wails3` CLI are found.

**Go version too old (Linux)**
The `golang-go` apt package is often behind. Install Go directly from [go.dev/dl](https://go.dev/dl/) instead.

**Permission denied on Linux/macOS binary**
```bash
chmod +x ./dist/filemoverexpress-*
```

For more help, see the [Troubleshooting](Troubleshooting.md) guide or open an issue on [GitHub](https://github.com/awslabs/filemoverexpress/issues).
