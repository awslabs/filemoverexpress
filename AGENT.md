# AGENT.md

Guidance for AI coding agents (Kiro, Claude, Cursor, Copilot, etc.) working in
this repository. Human contributors: see `CONTRIBUTING.md`.

## Working files MUST live in `.agent-workspace/`

All temporary notes, planning docs, investigation write-ups, scratch scripts,
build logs, and any other throwaway working files **MUST** be created inside the
`.agent-workspace/` folder at the repo root. That folder is git-ignored, so
nothing you put there can be accidentally committed.

Do **not** scatter working files across the repo (repo root, `src/`, `docs/`,
etc.). Files like `MIGRATION_NOTES.md`, `*-findings.md`, `investigation.md`,
`scratch.*`, `build.log`, or throwaway mockups do not belong in version control.

## What belongs in the repo vs. `.agent-workspace/`

| Keep in the repo (commit it) | Keep in `.agent-workspace/` (ignored) |
|---|---|
| Source code and tests | Scratch notes, plans, TODO lists |
| Real docs under `docs/` | Investigation / analysis write-ups |
| PR descriptions, issue comments | Build/test logs, command output dumps |
| Config the project needs | One-off scripts, experiment files |
| Design assets the product ships | Throwaway mockups / prototypes |

If something is worth keeping, it belongs in a real project file, a pull-request
description, or a GitHub issue — not left lying in the tree as a stray file.

## Before you commit

- Stage files explicitly (e.g. `git add <path>`); avoid `git add .` / `git add -A`,
  which sweeps up scratch files.
- Review `git status` and your diff before committing — if a file isn't part of
  the change you were asked to make, don't commit it.
- Never commit AWS account numbers, credentials, or other sensitive identifiers
  (this is a public repository).

## Build, test, and lint

This repo uses [Task](https://taskfile.dev) (`Taskfile.yml`); npm scripts are
thin wrappers.

- Install & generate: `npm install` then `task generate` (protobuf + Wails bindings)
- Build: `task build` (or `task cli:build` / `task gui:build` / `task wails:build`)
- Test: `task test` (or `task cli:test` / `task test:wails` / `task gui:test`)
- Lint: `task lint` (or `task cli:lint` / `task gui:lint`)

Always build and run the relevant tests before opening a pull request. Direct
any build logs to `.agent-workspace/`.
