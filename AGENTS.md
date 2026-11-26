# AGENTS.md

Guidance for AI coding agents (Kiro, Claude, Cursor, Copilot, Codex) working in
this repository. Human contributors: see `CONTRIBUTING.md` and
`docs/Development.md`.

## Project

File Mover Express (FME) moves assets between local filesystems and
Amazon S3. It has a Go daemon and CLI (`src/cli`), an Angular GUI (`src/gui`),
and a Wails 3 desktop app (`src/wails`) that hosts the GUI and starts the
daemon. The GUI talks to the daemon over ConnectRPC, defined in
`src/protobuf`. [Task](https://taskfile.dev) runs every build, test, and lint
target.

## Rules that always apply

1. **Scratch files go in `.agent-workspace/`.** Notes, plans, logs, one-off
   scripts, and mockups belong in that git-ignored folder, never in `src/`,
   `docs/`, or the repo root.
2. **Stage files explicitly** (`git add <path>`). Never use `git add .` or
   `git add -A`. Review `git status` and the diff before committing.
3. **This is a public repository.** Never put AWS account numbers, credentials,
   or company-internal information in code, commits, PRs, issues, or comments.
4. **Do not edit generated code by hand**: `src/gui/src/gen/` and
   `src/cli/types/pbtypes/` (except the hand-written
   `src/cli/types/pbtypes/fme/v1/pbevent.go`). Regenerate with `task generate`.
5. **Follow the conventions of the area you change.** Read the matching guide
   below before editing.
6. **Run the full lint, test, and build suites before committing.** Send logs
   to `.agent-workspace/`.

## Read when

| You are... | Read |
|---|---|
| Editing Go code in `src/cli/` | `src/cli/AGENTS.md` |
| Editing Go code in `src/wails/` | `src/wails/AGENTS.md` |
| Editing Angular code in `src/gui/` | `src/gui/AGENTS.md` |
| Changing `.proto` files or bindings | `.agents/codegen.md` |
| Building, testing, linting, or running e2e suites | `.agents/build-test-lint.md` |
| Committing, naming a branch, or working on a PR | `.agents/git-and-prs.md` |
| Looking for where something lives | `.agents/architecture.md` |
| Creating scratch or working files | `.agents/workspace-hygiene.md` |

## Common commands

    task generate   # protobuf + Wails bindings; run before building
    task build      # CLI + Wails desktop app
    task lint       # golangci-lint + ESLint
    task test       # CLI, Wails, and GUI unit tests

Toolchain versions are defined in `go.mod`, `src/gui/package.json`, and
`.github/versions.env`. Check those files instead of assuming a version.
