# Project Structure

```
filemoverexpress/
├── src/
│   ├── cli/                        # Go CLI daemon & backend
│   │   ├── cmd/                    # Cobra command definitions (root, daemon, s3, crypto, etc.)
│   │   ├── config/                 # App configuration loading & defaults (platform-specific)
│   │   ├── constants/              # Shared constants (bytes, limits, URLs, time, checksums)
│   │   ├── core/                   # Core transfer engine
│   │   │   ├── checksums/          # Checksum algorithms (MD5, XXHash, XXH3)
│   │   │   ├── discovery/          # File discovery (local + S3), path validation
│   │   │   ├── download/           # Download orchestration
│   │   │   ├── filters/            # Transfer filters (inclusion, blocked-paths, max-age, metadata, dedup)
│   │   │   ├── job_manager/        # Job queue with priority scheduling + transfer workers
│   │   │   ├── sorting/            # File sorting strategies
│   │   │   └── transfer-api/       # S3 operations (upload, download, list, head, delete, throttle, auto-tuning)
│   │   ├── service/                # ConnectRPC service handlers (one file per RPC method)
│   │   ├── events/                 # Event system
│   │   ├── fme-errors/             # Custom error types
│   │   ├── globals/                # Global state
│   │   ├── inventory/              # S3 inventory report generation
│   │   ├── logger/                 # Logging setup
│   │   ├── types/                  # Go types + generated protobuf types (pbtypes/)
│   │   ├── utils/                  # Shared utilities
│   │   ├── vendor/                 # Vendored Go dependencies
│   │   ├── e2e-tests/              # End-to-end tests (require E2E_TEST=true)
│   │   └── testdata/               # Test fixtures
│   │
│   ├── gui/                        # Angular GUI application (Wails frontend)
│   │   └── src/
│   │       ├── app/
│   │       │   ├── components/     # UI components (containers/, layout/, modals/, primitives/)
│   │       │   ├── services/       # Angular services (fme-client, transfer, file-browser, etc.)
│   │       │   ├── state/          # NgRx store (fme-client, job, logs, models, notifications, transfer-stats)
│   │       │   ├── classes/        # Domain models and helpers
│   │       │   ├── interfaces/     # TypeScript interfaces
│   │       │   ├── pipes/          # Angular pipes (formatting, sorting, display)
│   │       │   ├── directives/     # Custom directives
│   │       │   ├── guards/         # Route guards
│   │       │   ├── constants/      # App constants
│   │       │   └── utils/          # Utility functions
│   │       ├── gen/                # Generated protobuf + Wails TS bindings (do not edit)
│   │       ├── environments/       # Angular environment configs
│   │       ├── assets/             # Static assets
│   │       └── styles/             # Global SCSS styles
│   │
│   ├── wails/                      # Wails 3 desktop app (Go); embeds the GUI + the daemon
│   ├── protobuf/                   # Protobuf service definitions (buf v2)
│   │   ├── fme/                    # FME service protos
│   │   └── s3_shared/              # Shared S3 message types
│   └── windows-daemon-launcher/    # Go-based Windows daemon launcher
│
├── Taskfile.yml                    # Root build orchestration (Task)
├── docs/                           # Documentation (wiki source)
├── docker/                         # Docker support
└── dist/                           # Build output
```

> Build is driven by [Task](https://taskfile.dev) (root `Taskfile.yml` + per-package
> `src/*/Taskfile.yml`); the former `src/electron/` and `src/build-scripts/` directories are
> legacy and no longer part of the build.

## Key Conventions

- CLI service handlers: one Go file per RPC method in `src/cli/service/`
- Platform-specific code uses Go build tags: `_unix.go`, `_windows.go`, `_win.go`
- Generated code directories (do not edit manually): `src/gui/src/gen/`, `src/cli/types/pbtypes/`
- GUI components are organized by role: containers (smart), primitives (dumb), layout, modals
- NgRx state is organized by domain: each subdirectory in `state/` has its own actions, reducers, effects, selectors
- Test files: Go uses `_test.go` suffix; Angular uses `.spec.ts` suffix
- Angular component selector prefix: `fme-`
- Angular directive selector prefix: `fme` (camelCase)
