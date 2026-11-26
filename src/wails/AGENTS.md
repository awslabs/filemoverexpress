# src/wails: desktop app

Go module `github.com/awslabs/filemoverexpress/gui`. A Wails 3 app that hosts the
Angular GUI and starts the daemon as a separate process. For what each file
does, see `README.md`; for the overall layout, `.agents/architecture.md`.

## Conventions

- **Bound service:** exported methods of `FMEApp` (`app.go` and its siblings)
  become TypeScript bindings. After adding, renaming, or changing one, run
  `task generate` and update the callers in `src/gui/src/app/services/wails/`
  (`.agents/codegen.md`).
- **Platform code:** split by file suffix (`_darwin.go`, `_windows.go`,
  `_unix.go`, `_other.go`) or an explicit `//go:build` line. Every platform
  must keep compiling; `task wails:lint` checks Linux, macOS, and Windows.
- **Declarations:** one `const` block, one `var` block, and one `type` block per
  file, in that order, then functions (`decorder`). Name numbers other than
  0 to 10, 100, and 1024 as constants (`mnd`); file modes are in
  `constants.go`.
- **Processes:** a program or daemon that must outlive the call is started with
  `exec.CommandContext(context.Background(), ...)` and a comment saying why. A
  cancellable context would kill it when the call returns.
- **Errors:** return them, or log them where the caller cannot act. Do not
  ignore a returned error.
- The code follows the same style and lint rules as `src/cli`
  (`src/cli/AGENTS.md`).

## Lint

`task wails:lint` runs `golangci-lint` with the root `.golangci.yml`, the same
file as `src/cli`. It builds with the `server` tag and without CGO, so it runs
on any host. Any finding fails it. Fix findings instead of suppressing them.
Add a suppression only after the user explicitly approves that specific one.

## Tests

- Tests sit beside the code as `*_test.go` and use `testify`.
- The package embeds the GUI build (`frontend/dist/browser`). Run
  `task gui:build` first, or the tests do not compile.
- Run them with `task test:wails`.
- Do not skip, disable, or exclude a test or its code from coverage without the
  user's explicit approval of that specific case.
