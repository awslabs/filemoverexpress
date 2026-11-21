# CI images

Two images carry the CI toolchain so jobs do not install it on every run.

| Image | Dockerfile | Platforms | Contents |
|---|---|---|---|
| `filemoverexpress-ci` | `ci.Dockerfile` | linux/amd64, linux/arm64 | Go, Node, Task, Wails 3, golangci-lint, protobuf plugins, GTK 4 and WebKitGTK 6 packages, warm Go module and npm caches |
| `filemoverexpress-e2e` | `e2e.Dockerfile` | linux/amd64 | The CI image plus AWS Emulator and Playwright with Chromium |

Both are published to `ghcr.io/<owner>/` by `.github/workflows/build-containers.yml`.

## Versions

Every tool version lives in `.github/versions.env`. The Dockerfiles, `setup-environment` (the
fallback that installs tools on the runner) and the image tags all read it. To upgrade a tool,
change it there. When the Go `go` directive in `src/*/go.mod` changes, change `GO_VERSION` too:
the image sets `GOTOOLCHAIN=local`, so a mismatch fails loudly instead of downloading a toolchain.

## Tags and fork behaviour

A tag is a hash of the Dockerfile, its `.dockerignore` and `versions.env`
(`.github/scripts/image-tag.sh`). Dependency lockfiles are not part of it: they only warm caches,
and a job fetches anything missing. A weekly run rebuilds the images under the same tag to refresh
those caches.

`ci.yml` looks for the matching image, first under the owner of the repository it runs in and then
under `awslabs`. If it finds none (for example in a pull request that changes the Dockerfile or
`versions.env`), the jobs run on the plain runner and install the tools as before. The end-to-end
job is skipped in that case.

Images are pushed only by `build-containers.yml`, with the repository's own `GITHUB_TOKEN`.

## Private packages

The `awslabs` packages cannot be made public, so every pull is authenticated. `resolve-image` logs
in to GHCR with the workflow's `GITHUB_TOKEN`, and each container job passes the same token as
container credentials. Jobs that pull an image need `packages: read`. The credentials are built in
the job's `container:` expression, not in a `resolve-image` output, because GitHub drops job
outputs that contain a secret.

The token can read an `awslabs` package only if the package grants access to this repository
(Package settings -> Manage Actions access). Packages published by `build-containers.yml` are linked
to the repository by their source label and inherit its access.

A pull request from a fork gets a read-only token that belongs to the base repository, so it can
pull the `awslabs` images when the package allows it. If a lookup fails for any reason, the jobs run
on the plain runner and install the toolchain, and the end-to-end job is skipped. A fork can run
`build-containers.yml` to publish its own images; its own workflows pull them with its own token.

## Building locally

```bash
# From the repository root. Same build arguments the workflow uses.
args=$(sed -n 's/^\([A-Z_]*=.*\)$/--build-arg \1/p' .github/versions.env)
docker build -f .github/docker/ci.Dockerfile $args -t fme-ci:local .
docker build -f .github/docker/e2e.Dockerfile $args --build-arg CI_IMAGE=fme-ci:local -t fme-e2e:local .
```
