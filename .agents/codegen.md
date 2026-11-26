# Code generation

Read this before changing a `.proto` file, changing Go methods that the desktop
app exposes to the GUI, or touching any generated directory.

## What is generated

| Source | Output | Consumers |
|---|---|---|
| `src/protobuf/**/*.proto` | `src/cli/types/pbtypes/` (Go messages and ConnectRPC handlers) | daemon, CLI, MCP server |
| `src/protobuf/**/*.proto` | `src/gui/src/gen/es/` (TypeScript messages and service descriptors) | GUI |
| Go methods of the service registered in `src/wails/main.go` | `src/gui/src/gen/wails/` (TypeScript bindings, imported as `@wailsApp/...`) | GUI, through `src/gui/src/app/services/wails/` |

Generated output is not committed; every checkout and every CI job generates
it. `task generate` produces all of it, and `task proto:generate` produces the
protobuf output only.

## Rules

- **Never edit generated files by hand.** Change the source and regenerate.
- **One hand-written exception:** `src/cli/types/pbtypes/fme/v1/pbevent.go` is
  committed and maintained by hand. It is the only tracked file under
  `pbtypes/`.
- **Commit the source, never the output.** If generated files show up in
  `git status`, an ignore rule is wrong; report it rather than committing them.
- **Regenerate before building, linting, or testing** after any change to a
  `.proto` file or to the exposed Wails methods, and run the full suites
  (`.agents/build-test-lint.md`).
- **`src/gui/src/gen/connect/` and `src/gui/src/gen/wailsjs/`** may exist in
  older checkouts. Nothing generates or imports them now; do not use them.

## Changing the API

Definitions live in `src/protobuf/fme/v1/` (the `FmeService` and its messages)
and `src/protobuf/s3_shared/v1/` (shared S3 types). Go package paths are set by
`buf.gen.yaml`, whose managed mode overrides the `go_package` option in each
file. Follow the [Protobuf best practices](https://protobuf.dev/best-practices/dos-donts/);
the rules that matter most here are below.

**Stay compatible.** The daemon and its clients (GUI, MCP server, CLI scripts)
are never updated at the same moment, and a client may talk to a daemon built
from another version. Treat every change as one that old and new code must both
read.

- Never reuse a field number or enum value number.
- When you delete a field or enum value, `reserve` its number and its name.
- Do not change a field's type, and do not change a `repeated` field to a
  scalar.
- Add new fields and RPCs instead of repurposing existing ones.
- Keep the binary wire format. The GUI and MCP server use binary transports;
  JSON interchange would make field and enum renames unsafe.
- Do not rely on serialized bytes being stable across builds, for example as a
  cache key.

**Design new types well.**

- Every enum starts with `<ENUM_NAME>_UNSPECIFIED = 0`, with values prefixed by
  the enum name. `buf lint` enforces this.
- Use an enum instead of a `bool` when a third state is plausible later.
- Use well-known types for times and durations (`google.protobuf.Timestamp`,
  `google.protobuf.Duration`), not integers such as `int64 timeout_ms`.
- Avoid field and enum names that are keywords in Go or TypeScript.
- Put a new message or enum meant for reuse in its own file. Do not reuse
  another message's nested types from elsewhere.

**Run the checks.** `task proto:lint` applies the `STANDARD` rules in
`src/protobuf/buf.yaml` and runs as part of `task lint`. Its existing
`ignore_only` entries cover legacy RPCs in `fme_service.proto`; new RPCs use the
standard naming (`FooRequest`, `FooResponse`, one pair per RPC) instead of adding
exceptions. `task proto:test` checks that the definitions compile, and runs as
part of `task test`. `task proto:breaking` checks the `FILE` breaking-change rules
against `origin/main` (pass `BASE=<ref>` to use another ref); CI does not run it
yet, so the compatibility rules above are yours to keep. `task proto:format:check`
shows what `buf format` would change; the existing files are not formatted yet, so
nothing enforces it.

**Expect four touch points.** An RPC change usually spans the `.proto`, a
handler file in `src/cli/service/` (one file per RPC), a GUI service in
`src/gui/src/app/services/`, and, when assistants should use it,
`src/cli/mcpserver/`.

## Changing the Wails bindings

The bindings mirror the exported methods and types of the service registered
in `src/wails/main.go`. After adding, renaming, or changing the signature of
one of those methods, regenerate, then update the callers in
`src/gui/src/app/services/wails/`. The GUI reaches native features only through
that service.
