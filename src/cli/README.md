# File Mover Express CLI

[![Go Version](https://img.shields.io/badge/Go-1.27.3+-blue.svg)](https://golang.org/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

The CLI is the Go backend of File Mover Express. It builds two binaries:

- `filemoverexpress` runs the transfer daemon and the command-line tools. `filemoverexpress daemon`
  runs the transfer engine (jobs, uploads, downloads, checksums, and hot folders) and serves the
  ConnectRPC API that the GUI, the desktop app, and the MCP server call. It listens on
  `127.0.0.1:50006` by default.
- `fme-mcp` is an MCP server that exposes daemon operations to AI assistants through the same
  ConnectRPC API. See the [MCP Server guide](../../docs/MCP-Server.md).

The API is defined in [`src/protobuf`](../protobuf/README.md).

## What it does

| Path | Responsibility |
|---|---|
| `main.go`, `cmd/` | Cobra commands: `daemon`, `upload`, `download`, `validate-credentials`, `inventory`, `crypto`, `support-file`, `credits` |
| `mcp-main.go`, `mcpserver/` | The `fme-mcp` binary and its tools |
| `service/` | ConnectRPC handlers for the daemon API |
| `core/job_manager/` | Job queue, workers, and job status |
| `core/upload/`, `core/download/` | Upload and download operations, including hot folders |
| `core/discovery/`, `core/filters/`, `core/sorting/` | Finding, filtering, and ordering the files and S3 objects to transfer |
| `core/checksums/` | Checksum algorithms and the checksum cache |
| `core/transfer-api/` | The S3 client and S3 operations |
| `core/auth/` | OIDC-based AWS credentials |
| `core/notifications/`, `core/transferstats/` | Chat webhook notifications when jobs finish, and transfer statistics |
| `inventory/` | S3 inventory reports for `inventory` |
| `config/`, `constants/`, `globals/` | Configuration loading and defaults, shared constants, process-wide state |
| `types/` | Types grouped by domain. `types/pbtypes/` is generated protobuf code |
| `events/`, `logger/`, `fme-errors/` | The internal event bus, logging, and error types |
| `utils/` | Filesystem, MHL, pre-shared key, support-file, and system-info helpers |
| `e2e/` | End-to-end tests against a real daemon and AWS Emulator |

The daemon reads its configuration from `~/.filemoverexpress/configuration.yaml`, or from the
folder in `FME_CONFIG_DIR` when that variable is set. The settings are described in the
[Configuration Guide](../../docs/Configuration.md).

## Building and running

Run these from the repository root. Setup and prerequisites are in
[`docs/Development.md`](../../docs/Development.md).

```bash
task generate        # protobuf code; run first
task cli:build       # builds dist/filemoverexpress and dist/fme-mcp for this platform
task cli:build:all   # builds both binaries for macOS, Linux, and Windows
./dist/filemoverexpress daemon
```

`filemoverexpress daemon --remote` listens on other interfaces for remote clients and needs a
pre-shared key and TLS. The commands, flags, and remote mode are described in
[Using the CLI](../../docs/Using-the-CLI.md).

## Testing and linting

```bash
task cli:test                  # unit tests with coverage (coverage.out, coverage.html)
task cli:lint                  # golangci-lint, including the e2e suite
task e2e:docker SUITE=daemon   # end-to-end suite inside the fme-e2e image
task cli:e2e                   # end-to-end suite directly (Linux, aws-emulator on PATH)
```

`task cli:test` and `task cli:lint` accept arguments after `--`, for example
`task cli:test -- ./core/checksums/...`. The unit tests need no AWS credentials.

`task cli:lint` uses the repository's `.golangci.yml`, shared with `src/wails`. The end-to-end
suite runs against AWS Emulator and needs no AWS account. See [`e2e/README.md`](e2e/README.md).

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for general contribution guidelines.

## License

This project is licensed under the Apache License 2.0. See the [LICENSE](../../LICENSE) file for
details.
