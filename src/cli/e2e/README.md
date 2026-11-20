# End-to-end tests

These tests run the real, built daemon (`filemoverexpress daemon`) as a separate process and drive
it over ConnectRPC, exactly as the GUI does. S3 is [AWS Emulator](https://github.com/aws/aws-emulator),
so no AWS account, credentials or bucket are needed. Every file has the `e2e` build tag, so plain
`go test ./...` does not run them.

## Running

```bash
# Inside the fme-e2e image, from any host with Docker (builds nothing on your machine):
task e2e:docker                      # uses the image fme-e2e:local; E2E_IMAGE=<ref> overrides it

# Directly, on Linux with aws-emulator on PATH:
task cli:e2e
task cli:e2e -- -run TestUploadSingleFile ./e2e/...    # extra arguments go to go test
```

The emulator is only distributed as a Linux package (Windows and macOS use Docker), which is why
`task e2e:docker` exists. Build the image locally, or pull one published by `build-containers.yml`:

```bash
args=$(sed -n 's/^\([A-Z_]*=.*\)$/--build-arg \1/p' .github/versions.env)
docker build -f .github/docker/ci.Dockerfile  $args -t fme-ci:local .
docker build -f .github/docker/e2e.Dockerfile $args --build-arg CI_IMAGE=fme-ci:local -t fme-e2e:local .
```

CI runs the same suite in the `e2e` job of `.github/workflows/ci.yml`.

## What the harness does

`TestMain` (`main_test.go`) starts one emulator on a free port (`emulator_test.go`), creates a
bucket, builds the daemon from the working tree (`daemon_test.go`), writes a daemon configuration
that points at the emulator (`config_test.go`), starts the daemon, and shuts it down through the
`Shutdown` RPC at the end. Each test gets a `testEnv` (`helpers_test.go`) with its own key prefix
and scratch directory; its objects are deleted afterwards. Objects are seeded and checked with a
separate S3 client, not with the daemon's own code.

| Variable | Effect |
|---|---|
| `E2E_EMULATOR_BIN` | Path of the `aws-emulator` binary (default: `aws-emulator` on `PATH`) |
| `E2E_EMULATOR_DIR`, `E2E_EMULATOR_ENDPOINT` | Use an emulator that is already running; the directory holds its `config`, `emulator_credentials` and `ca.pem` |
| `E2E_DAEMON_BINARY` | Test a prebuilt daemon instead of building one |
| `E2E_KEEP_WORKDIR` | Keep the temporary directory (daemon config, logs) for inspection |

The daemon's own log is `daemon.log` in that directory.

## Writing a test

```go
func TestSomething(t *testing.T) {
	env := newTestEnv(t)
	sum := env.writeFile("a.bin", 1*MiB, 1)                       // local file, returns its MD5
	job, tasks := env.waitJob(env.upload(profileDefault, false, "a.bin"))
	requireCleanJob(t, job, tasks)
	assert.Equal(t, sum, env.head("a.bin").Metadata[metaMD5])     // check S3 directly
}
```

Transfer profiles are fixed for the run (`config_test.go`): `default` (MD5), `nochecksum`, `xxh3`
and `missingbucket`. Add a profile there when a test needs different settings.

## Things to know

- **A failed transfer does not make the job fail.** The job ends `COMPLETED` with
  `HasTaskErrors` set and the failing task has status `ERROR`. Use `requireCleanJob`, and inspect
  the tasks when a failure is the expected outcome.
- **Port 50006 is fixed.** The daemon's local API cannot listen elsewhere, so the suite needs the
  port free (the harness checks first) and cannot run in parallel with another daemon or with a
  running File Mover Express.
- **Connection tuning is off.** The configuration sets `maxConnectionsPerHost` and
  `sendBufferBytes` to 0. With either set, the daemon uses its own HTTP client, which ignores the
  emulator's CA bundle, so those code paths are covered by unit tests only.
- **The emulator keeps at most 64 MiB per bucket**, counted over everything in it. Keep test data
  small and let the cleanup run.
- Every request needs an allowed `Origin` header; the test client sends the GUI's.
