# Build, test, and lint

Read this before building, testing, or linting, and before reporting that a
change is ready. [Task](https://taskfile.dev) runs everything; the `npm run`
scripts only wrap it. Setup and prerequisites for people are in
`docs/Development.md`.

## Before you commit

Run the full suites, not a subset:

1. `task lint`
2. `task test`
3. `task build`

Also run these when they apply:

- **Breaking-change check** when a `.proto` file changed: `task proto:breaking`
  compares the definitions with `origin/main`; pass `BASE=<ref>` to compare with
  another ref, such as `upstream/main` in a fork. CI does not run it yet.
- **End-to-end suites** when the change touches `src/cli`, `src/gui`,
  `src/wails`, `src/protobuf`, `.github/docker`, `.github/actions`,
  `.github/scripts`, `.github/versions.env`, the `ci.yml` or `e2e.yml`
  workflows, a `package.json` or `package-lock.json`, or the root `Taskfile.yml`.
  These are the paths CI uses to decide whether to run them. They need Docker.
  If you cannot run them, say so in the PR description.

Send all output to `.agent-workspace/`. Fix failures at the cause. Do not
suppress a lint finding, skip or disable a test, exclude code from coverage, or
lower a threshold without the user's explicit approval of that specific case.
If a failure is unrelated to your change, report it instead of working around
it.

While iterating, run the narrower package targets below. They do not replace
the full run before a commit.

## Setup first

Run `npm install` once at the repo root; npm workspaces cover every `src/*`
package. Build, lint, and test also need the generated protobuf and Wails
bindings. Run `task generate` on a fresh checkout, and again after changing a
`.proto` file or Go code that the bindings expose.

## Targets

| Area | Build | Test | Lint |
|---|---|---|---|
| Everything | `task build` | `task test` | `task lint` |
| Go CLI and daemon (`src/cli`) | `task cli:build` | `task cli:test` | `task cli:lint` |
| Angular GUI (`src/gui`) | `task gui:build` | `task gui:test` | `task gui:lint` |
| Wails app (`src/wails`) | `task wails:build` | `task test:wails` | `task wails:lint` |
| Protobuf (`src/protobuf`) | `task proto:generate` | `task proto:test` | `task proto:lint` |

Extra arguments after `--` go to the underlying tool for `cli:test`,
`cli:e2e`, and `gui:e2e`, for example a single Go test name.

Other targets:

- `task test:e2e` runs both end-to-end suites; `task cli:e2e` and `task gui:e2e`
  run one each. They need AWS Emulator on `PATH`, which exists for Linux only.
- `task e2e:docker` runs the suites in the `fme-e2e` image on any host with
  Docker. `SUITE=daemon`, `SUITE=gui`, or `SUITE=all` (default) picks the suite.
  Details are in `src/cli/e2e/README.md` and `src/gui/e2e/README.md`.
- `task cli:build:all` builds the CLI for every platform.
- `task dev` runs the desktop app with hot reload.
- `task clean` removes build artifacts and generated code.
- `task --list` shows every target.

## Things to know

- **Wails tests need the built GUI.** The desktop app embeds the GUI build
  output from `src/wails/frontend/dist`. Run `task gui:build` (or `task build`)
  first, or the Wails Go tests fail to compile.
- **Port 50006 must be free** for the daemon end-to-end suite, so it cannot run
  beside another daemon or a running File Mover Express.
- **No AWS account is needed** for any test. S3 is AWS Emulator in the e2e
  suites and mocked in unit tests.
- **Lint results can depend on the Go patch version.** With the same
  `golangci-lint`, Go 1.27.3 reported four `unhandled-error` findings in
  `src/wails` that Go 1.27.4 did not. CI uses the `GO_VERSION` in
  `.github/versions.env`. If CI lint fails where your run passes, lint with that
  Go version.
- One `.golangci.yml` at the repository root configures `golangci-lint` for both
  Go modules (`src/cli` and `src/wails`). Change it there; do not add a
  per-module copy.
- Go tests, ESLint, and `golangci-lint` thresholds are described in
  `src/cli/AGENTS.md` and `src/gui/AGENTS.md`.

## Toolchain versions

Do not assume versions. Go is pinned in each module's `go.mod` (`src/cli`,
`src/wails`, `src/windows-daemon-launcher`); GUI dependencies in
`src/gui/package.json`; and CI's Go, Node, Task, Wails, golangci-lint, protoc
plugin, AWS Emulator, and Playwright versions in `.github/versions.env`. A
local tool older than those pins can fail where CI passes.
