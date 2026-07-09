# Tech Stack & Build System

## Monorepo Structure

npm workspaces monorepo. Each `src/*` directory is a workspace package.

## CLI (Go)

- Language: Go 1.25+
- CLI framework: Cobra + Viper
- AWS SDK: aws-sdk-go-v2 (S3, STS, config)
- RPC: ConnectRPC (connectrpc.com/connect)
- Protobuf: google.golang.org/protobuf
- Logging: logrus + lumberjack (rotation)
- Testing: Go standard `testing` + testify + bytedance/mockey
- Linting: golangci-lint (config at `src/cli/.golangci.yml`)
  - Key linters: revive, errcheck, govet, staticcheck, nestif, mnd
  - Max cyclomatic complexity: 25
  - Max function length: 40 lines
  - Max line length: 140 chars
  - Max function arguments: 4, max return values: 3
  - Import ordering: standard → third-party → project (`github.com/awslabs/filemoverexpress`)

## GUI (Angular + TypeScript)

- Framework: Angular 21 (standalone-based, no NgModules)
- State management: NgRx (store, effects, entity)
- UI: Angular Material + Angular CDK
- Styling: SCSS (4-space indent)
- RPC client: @connectrpc/connect-web + @bufbuild/protobuf
- Testing: Vitest (run via `ng test`); property-based via @fast-check/vitest — replaced Karma/Jasmine
- Linting: ESLint with @angular-eslint + @stylistic
  - Component prefix: `fme` (kebab-case elements, camelCase attributes)
  - 4-space indentation, single quotes, semicolons required
  - Trailing commas on multiline arrays/objects/imports/function params
  - Unused vars allowed only if prefixed with `__`

## Desktop App (Wails 3)

- `src/wails/` — Wails 3 desktop app written in Go; embeds the Angular GUI as its frontend
- The transfer daemon is compiled into the Wails binary; the standalone `filemoverexpress` CLI still ships for scripting/headless use
- Frontend bindings generated via `wails3 generate bindings` → `src/gui/src/gen/wails/`
- Dev loop: `task dev` (runs `wails3 dev`)
- Replaced the former Electron wrapper (`src/electron/` is legacy/removed)

## Protobuf / Code Generation

- Definitions: `src/protobuf/` (buf v2 toolchain)
- Go codegen: protoc-gen-go + protoc-gen-connect-go → `src/cli/types/pbtypes/`
- TS codegen: protoc-gen-es → `src/gui/src/gen/es/`
- Generate command: `task generate` (protobuf + Wails bindings); or `task proto:generate` for protobuf only. `npm run build:proto` maps to `task proto:generate` (protobuf only).

## Build System (Task)

- Driven by [Task](https://taskfile.dev): root `Taskfile.yml` + a `Taskfile.yml` in each `src/*` package
- The `npm run *` scripts are thin wrappers around `task <name>` — either works
- Handles protobuf + Wails binding generation, CLI cross-compilation, GUI builds, and Wails packaging
- Replaced the former TypeScript `src/build-scripts/` pipeline

## Common Commands

```bash
# Install dependencies
npm install

# Generate code (must run before building)
task generate              # protobuf + Wails bindings

# Build
task build                 # CLI + GUI + Wails app
task cli:build             # CLI for current platform
task gui:build             # GUI production build
task wails:build           # Wails desktop app

# Test
task test                  # All tests (CLI + Wails + GUI)
task cli:test              # Go CLI tests (short mode, verbose, with coverage)
task test:wails            # Wails (Go) tests
task gui:test              # GUI tests (Vitest, via ng test)

# Lint
task lint                  # CLI (golangci-lint) + GUI (ESLint)
task cli:lint              # golangci-lint run
task gui:lint              # ESLint (ng lint)

# Dev / clean
task dev                   # Desktop app hot reload (wails3 dev)
task clean                 # Remove build artifacts + generated code
task --list                # List all available targets

# npm wrappers exist for most targets (e.g. npm run build, npm run test:cli),
# but `task` is the primary interface. Note: `npm run test:wails` is currently
# broken (maps to a non-existent `task wails:test`); use `task test:wails`.

# CLI-specific (run from src/cli/)
go test -short -v -cover ./...
golangci-lint run
golangci-lint run --fix

# GUI-specific (run from src/gui/)
ng test --watch=false --coverage
ng lint
ng lint --fix
```

## Property-Based Testing

The project uses `fast-check` (v4.6.0) for property-based testing, available in all workspace packages.
