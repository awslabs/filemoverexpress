# File Mover Express protobuf definitions

This directory holds the API definitions shared by the daemon, the GUI, and the MCP server. The
daemon serves one service, `FmeService`, over [ConnectRPC](https://connectrpc.com/). The code
generated from these files gives both sides type-safe messages and clients.

## Layout

| Path | Contents |
|---|---|
| `fme/v1/fme_service.proto` | `FmeService`, the RPC interface (37 methods), and the messages only it uses |
| `fme/v1/job.proto` | Jobs, tasks, and their requests and responses |
| `fme/v1/config.proto` | Daemon configuration and the requests to read and change it |
| `fme/v1/events.proto` | Events pushed to clients |
| `fme/v1/remote_daemon.proto` | Local file system browsing and changes |
| `fme/v1/notifications.proto` | Notification destinations, presets, and settings |
| `fme/v1/inventory.proto` | S3 inventory report requests and events |
| `fme/v1/metadata.proto` | Transfer profile and metadata messages |
| `fme/v1/supportfile.proto` | Support file generation |
| `fme/v1/shared.proto` | Types used across files, such as the checksum algorithms and shutdown |
| `s3_shared/v1/s3.proto` | S3 objects, prefixes, and the status codes for S3 transfers |
| `buf.yaml` | Module configuration: lint rules, breaking-change rules, and dependencies |
| `buf.gen.yaml` | Code generation: plugins and output directories |

## Generated code

`task generate` (or `task proto:generate` for protobuf alone) writes:

- Go messages and ConnectRPC handlers to `src/cli/types/pbtypes/`
- TypeScript messages and service descriptors to `src/gui/src/gen/es/`

Generated files are not committed. Never edit them by hand; change the `.proto` files and generate
again. Managed mode in `buf.gen.yaml` sets the Go package path, overriding the `go_package` option
in each file.

## Checks

Run these from the repository root:

```bash
task proto:lint        # buf lint, the STANDARD rules in buf.yaml (part of task lint)
task proto:test        # checks that the definitions compile (part of task test)
task proto:breaking    # checks for breaking changes against origin/main
```

`task proto:breaking` compares with `origin/main` by default. Use `BASE=<ref>` for another ref, for
example `task proto:breaking BASE=upstream/main` in a fork. `task proto:format:check` shows what
`buf format` would change. The existing files are not formatted yet, so nothing enforces it.

## Changing the API

The daemon and its clients are never updated at the same moment, so every change must be readable
by both old and new code: add fields and RPCs instead of changing existing ones, never reuse a field
number, and reserve the number and name of anything you delete. The full rules, and how an RPC change
reaches the daemon, the GUI, and the MCP server, are in [`.agents/codegen.md`](../../.agents/codegen.md)
and the [Protobuf best practices](https://protobuf.dev/best-practices/dos-donts/).
