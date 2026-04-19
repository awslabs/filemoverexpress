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
- Testing: Karma + Jasmine
- Linting: ESLint with @angular-eslint + @stylistic
  - Component prefix: `fme` (kebab-case elements, camelCase attributes)
  - 4-space indentation, single quotes, semicolons required
  - Trailing commas on multiline arrays/objects/imports/function params
  - Unused vars allowed only if prefixed with `__`

## Electron

- Wraps the Angular GUI for desktop distribution
- TypeScript-based main process

## Protobuf / Code Generation

- Definitions: `src/protobuf/` (buf v2 toolchain)
- Go codegen: protoc-gen-go + protoc-gen-connect-go → `src/cli/types/pbtypes/`
- TS codegen: protoc-gen-es → `src/gui/src/gen/es/`
- Generate command: `npm run build:proto`

## Build Scripts

- Location: `src/build-scripts/`
- Language: TypeScript (ts-node)
- Testing: Vitest
- Entry point: `build.ts` — handles CLI builds (cross-compilation), GUI builds, Electron packaging, protobuf generation

## Common Commands

```bash
# Install dependencies
npm install

# Generate protobuf code (must run before building)
npm run build:proto

# Build
npm run build              # CLI + GUI in parallel
npm run build:cli          # CLI for all platforms
npm run build:gui          # GUI production build

# Test
npm run test               # All tests (build-scripts + CLI + GUI)
npm run test:cli           # Go tests (short mode, verbose, with coverage)
npm run test:gui           # Angular tests via Karma (single run)
npm run test:build-scripts # Vitest for build scripts

# Lint
npm run lint               # CLI (golangci-lint) + GUI (ESLint)
npm run lint:cli           # golangci-lint run
npm run lint:gui           # ng lint

# CLI-specific (run from src/cli/)
go test -short -v -cover ./...
golangci-lint run
golangci-lint run --fix

# GUI-specific (run from src/gui/)
ng test --watch=false --code-coverage
ng lint
ng lint --fix
```

## Property-Based Testing

The project uses `fast-check` (v4.6.0) for property-based testing, available in all workspace packages.
