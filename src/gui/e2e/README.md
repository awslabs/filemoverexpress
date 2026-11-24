# Browser end-to-end tests

[Playwright](https://playwright.dev) tests that use the GUI in Chromium against a real backend:

- the desktop app (`src/wails`) built with the Wails `server` tag, which serves the GUI over HTTP
  instead of opening a native window ([Wails guide](https://wails.io/guides/e2e-testing/));
- the real `filemoverexpress` daemon;
- [AWS Emulator](https://github.com/aws/aws-emulator) as S3, with a seeded bucket.

The daemon and emulator come from the Go e2e suite (`src/cli/e2e`): its `TestServeEnvironment`
starts them, seeds data, prints the details and waits. Nothing needs an AWS account.

## Running

```bash
# From the repository root, inside the fme-e2e image (any host with Docker):
task e2e:docker SUITE=gui
task e2e:docker SUITE=gui -- --grep upload       # extra arguments go to playwright test

# Directly, on Linux with aws-emulator on PATH and Playwright's Chromium installed,
# after `task generate`:
task gui:e2e
```

`task gui:e2e` builds the GUI, the desktop app's web build (`e2e/.bin/fme-server`) and the backend
test binary (`e2e/.bin/e2e.test`), then runs Playwright. Screenshots and traces of failed tests are
in `e2e/test-results` (with `task e2e:docker`, in `e2e/out`). Open a trace with
`npx playwright show-trace <trace.zip>`.

## How it fits together

`support/global-setup.ts` starts the backend and waits for its `E2E_READY` line, then starts the
desktop app with the backend's `HOME`. The app finds the running daemon through the pid file in
`HOME/.filemoverexpress` and does not start its own; a `.first-launch-complete` marker there skips
the welcome dialog. The daemon's `apiServer.allowedOrigins` contains the app's address, which the
daemon requires for browser requests. `support/global-teardown.ts` stops both.

| Variable | Effect |
|---|---|
| `E2E_GUI_PORT` | Port of the desktop app's web build (default 8080) |
| `E2E_BACKEND_BINARY`, `E2E_APP_BINARY` | Use other builds of the two binaries |

## Writing tests

Use the helpers in `support/app.ts`: `MainScreen` for the window, and its `local` and `s3` panes.
They find elements by role, name and visible text, as a user would; the GUI has no test ids. Seeded
S3 objects and local files are listed in `support/environment.ts` and created in
`src/cli/e2e/serve_test.go`; keep the two in step.

Things to know:

- One backend serves all tests, so they run one at a time and share state. A test that changes
  data (an upload) should use names no other test depends on, or run in a serial `describe`.
- Transfers start by dragging a row from one pane to the other; `MainScreen.drag` does this with
  pointer events, then the test confirms the dialog.
- A download from the GUI is relative to the S3 folder being shown: `seed/readme.txt` downloaded
  while viewing `seed/` arrives as `readme.txt`.
- Native file dialogs, menus and the system tray do not exist in the web build and are not covered.
