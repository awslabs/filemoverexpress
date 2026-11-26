# src/cli: daemon, CLI, and MCP server

Go module `github.com/awslabs/filemoverexpress`. It builds two binaries:
`filemoverexpress` (`main.go`: the daemon and the CLI) and `fme-mcp`
(`mcp-main.go`, which carries `//go:build ignore` and is built by name through
`task cli:build`). For where packages live, see `.agents/architecture.md`; for
API changes, `.agents/codegen.md`.

## Conventions

- **RPC handlers:** one file per RPC in `service/`, named after the RPC in
  kebab case (`CancelJob` lives in `cancel-job.go`), as a method on
  `*FileMoverServer`. Its tests sit beside it (`cancel-job_test.go`).
- **Message strings:** user-facing and log message text goes in the package's
  `strings.go` as `str...` constants, not inline literals.
- **Errors:** sentinel errors live in `fme-errors/` (imported as `fmeErrors`).
  Wrap with `%w` and check with `errors.Is`. Error strings start lowercase and
  do not end in punctuation.
- **Logging:** use the `logger` package, not `logrus`, the standard `log`
  package, or `fmt.Print*` directly.
- **Platform code:** split by file suffix. Go applies `_windows.go`
  automatically. `_unix.go` and `_win.go` are not suffixes Go recognizes, so
  those files need an explicit `//go:build` line (`!windows` or `windows`). Use
  `_windows.go` and `_unix.go` for new files.
- **Imports:** three groups in this order: standard library, third-party, then
  `github.com/awslabs/filemoverexpress/...`. The `gci` formatter enforces it.
- **Declaration order in a file:** one `const` block, one `var` block, and one
  `type` block, in that order, then `func` (`decorder`).
- **Identifiers are ASCII only** (`asciicheck`).

## Lint limits

`task cli:lint` runs `golangci-lint` with the repository's root `.golangci.yml`
(shared with `src/wails`); any finding fails it. The limits most likely to bite:

| Rule | Limit |
|---|---|
| Function length (revive `function-length`) | 40 statements |
| Cyclomatic complexity | 25 |
| Nested `if` complexity (`nestif`) | 8 |
| Line length | 140 characters |
| Function arguments | 4 |
| Return values | 3 |
| Public structs per file | 10 |
| Magic numbers (`mnd`) | literals other than 0-10, 100, 1024, and common file modes need a named constant |

Also enforced: no boolean flag parameters, no unused parameters or receivers
(name them `_`), no unhandled errors, and `context.Context` as the first
argument.

Fix findings instead of suppressing them. Add a suppression (`//nolint`,
`//revive:disable`, or an exclusion in `.golangci.yml`) only after the user
explicitly approves that specific suppression. When approved, scope it to the
smallest block, name the rule, and give the reason in a comment. The
`//revive:disable:line-length-limit` at the top of `strings.go` files is the one
standing exception.

Test files are not linted (`run.tests: false`), but they follow the same
conventions.

## Tests

- Use `testify` (`assert` and `require`). Tests sit beside the code as
  `*_test.go`.
- Mock S3 through `FileMoverS3ClientInterface` with the hand-written mocks in
  `core/transfer-api/mock/`. Add a mock there when a new S3 call needs one.
- Unit tests must not need AWS credentials, network access, or a running
  daemon. Use `t.TempDir()` for files.
- Tests that drive a real daemon belong in `e2e/` with the `e2e` build tag
  (`src/cli/e2e/README.md`).
- Run them with `task cli:test`, not a bare `go test`: it sets the flags CI
  uses (`-short`, coverage, inlining disabled).
- Do not skip, disable, or exclude a test or its code from coverage
  (`t.Skip`, build tags, coverage exclusions) without the user's explicit
  approval of that specific case.

## Dependencies

- `vendor/` is git-ignored and never committed. A stale local copy makes builds
  fail with an inconsistent-vendoring error; regenerate it or remove it.
- Keep `go.mod` and `go.sum` tidy and committed together.
- When you change the version of `google.golang.org/protobuf` or
  `connectrpc.com/connect`, update `PROTOC_GEN_GO_VERSION` or
  `PROTOC_GEN_CONNECT_GO_VERSION` in `.github/versions.env` to match.
