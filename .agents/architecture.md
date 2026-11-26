# Architecture

Read this to find where something lives or how the pieces talk to each other.

## Product

File Mover Express (FME) moves assets between local filesystems and Amazon S3.
It is built for media workflows, such as digital imaging technicians and content
creators, and works for any S3 transfer.

Main capabilities:

- auto-tuned parallel transfers with multipart uploads and adaptive concurrency
- hot folders that upload new files automatically
- checksums (MD5, xxHash, xxHash64, XXH3, C4) and ASC MHL verification
- webhook notifications (Slack, Teams, Discord, Google Chat)
- AWS IAM and OIDC authentication
- S3 inventory reports
- macOS (x64, ARM64), Windows (x64), and Linux (x64, ARM64)

## How the pieces fit

| Component | Path | Role |
|---|---|---|
| Daemon and CLI | `src/cli` | The `filemoverexpress` binary. `filemoverexpress daemon` runs the transfer engine and serves the ConnectRPC API on `127.0.0.1:50006` by default. Other subcommands script S3 operations. |
| GUI | `src/gui` | Angular app. Talks to a daemon over ConnectRPC, the local one or a remote one. |
| Desktop app | `src/wails` | Wails 3 app that hosts the GUI in a native window, provides native features (file dialogs, tray, drag and drop) through Wails bindings, and starts the daemon as a separate process if none is running. |
| MCP server | `src/cli/mcpserver`, `src/cli/mcp-main.go` | The `fme-mcp` binary. Exposes daemon operations to AI assistants over the same ConnectRPC API. |
| API definitions | `src/protobuf` | Protobuf service and message definitions shared by the daemon, the GUI, and the MCP server. |
| Windows launcher | `src/windows-daemon-launcher` | Runs the daemon as a Windows service. |

The daemon is the only component that transfers data. The GUI, the MCP server,
and CLI scripts are clients of its API. The daemon accepts browser requests only
from origins listed in `apiServer.allowedOrigins` in its configuration.

## Repository map

    src/
      cli/                      Go module: daemon, CLI, MCP server
        cmd/                    Cobra commands (root, daemon, s3, crypto, ...)
        config/                 configuration loading and defaults
        core/                   transfer engine
          auth/                 OIDC, PKCE, STS, token cache
          checksums/            checksum algorithms
          discovery/            local and S3 file discovery, path validation
          download/ upload/     download and upload orchestration, hot folders
          filters/              inclusion, blocked paths, max age, metadata, dedup
          job_manager/          job queue, priority scheduling, transfer workers
          notifications/        webhook notifications
          sorting/              file sorting strategies
          transfer-api/         S3 operations, throttling, auto-tuning
          transferstats/        transfer statistics
        service/                ConnectRPC handlers, one file per RPC
        mcpserver/              MCP tools and server
        events/ inventory/ logger/ fme-errors/ globals/ utils/ constants/
        types/                  Go types; pbtypes/ is generated
        e2e/                    daemon end-to-end suite (build tag e2e)
        testdata/ vendor/ tools/
      gui/                      Angular app
        src/app/
          components/           containers/, layout/, modals/, primitives/
          services/             feature services (fme-client, transfer, wails, ...)
          state/                NgRx store, one folder per domain
          classes/ interfaces/ pipes/ directives/ guards/ constants/ utils/
        src/gen/                generated protobuf and Wails bindings
        e2e/                    browser end-to-end suite (Playwright)
      wails/                    Go module: desktop app
      protobuf/                 fme/v1/ (FME service), s3_shared/v1/ (S3 types)
      windows-daemon-launcher/  Go module: Windows service wrapper
    docs/                       user guides, published to the website
    .website/                   documentation site (Docusaurus)
    .github/                    CI workflows, actions, CI images, versions.env
    Taskfile.yml                build orchestration

## Common change paths

- **New or changed RPC:** edit `src/protobuf/fme/v1/`, regenerate
  (`.agents/codegen.md`), implement the handler in `src/cli/service/`, then call
  it from a GUI service in `src/gui/src/app/services/` and, if AI assistants
  should use it, from `src/cli/mcpserver/`.
- **New native desktop feature:** add it in `src/wails`, regenerate the Wails
  bindings, and call it through `src/gui/src/app/services/wails/`.
- **New transfer behavior:** `src/cli/core/`, usually `job_manager/`,
  `transfer-api/`, or `filters/`.
- **New user-facing documentation:** a guide in `docs/`.
