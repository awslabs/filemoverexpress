# syntax=docker/dockerfile:1
# check=skip=InvalidDefaultArgInFrom
#
# General CI image: everything the lint, test and build jobs need, preinstalled.
# Build from the repository root (see .github/workflows/build-containers.yml):
#
#   docker build -f .github/docker/ci.Dockerfile \
#       $(sed -n 's/^\([A-Z_]*=.*\)$/--build-arg \1/p' .github/versions.env) .
#
# Versions come from .github/versions.env; none are defaulted here on purpose.

ARG GO_VERSION
ARG NODE_VERSION

# Official toolchain images supply Go and Node for both amd64 and arm64.
FROM golang:${GO_VERSION}-bookworm AS go
FROM node:${NODE_VERSION}-bookworm-slim AS node

# Ubuntu 24.04 matches the ubuntu-latest runners that CI used before, and is the
# release that ships libwebkitgtk-6.0-dev (needed by the Wails 3 Linux build).
FROM ubuntu:24.04

ARG TASK_VERSION
ARG WAILS_VERSION
ARG GOLANGCI_LINT_VERSION
ARG PROTOC_GEN_GO_VERSION
ARG PROTOC_GEN_CONNECT_GO_VERSION

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        curl \
        git \
        libgtk-4-dev \
        libwebkitgtk-6.0-dev \
        pkg-config \
    && rm -rf /var/lib/apt/lists/*

COPY --from=go /usr/local/go /usr/local/go
COPY --from=node /usr/local/ /usr/local/

ENV GOPATH=/go \
    GOTOOLCHAIN=local \
    PATH=/go/bin:/usr/local/go/bin:${PATH}

# Compile the Go-based tools once, here, instead of in every CI job.
# golangci-lint is built from source with this image's Go: a prebuilt binary built
# with an older Go refuses to lint modules that declare a newer go version.
RUN go install "github.com/go-task/task/v3/cmd/task@v${TASK_VERSION}" \
    && go install "github.com/wailsapp/wails/v3/cmd/wails3@${WAILS_VERSION}" \
    && go install "github.com/golangci/golangci-lint/v2/cmd/golangci-lint@${GOLANGCI_LINT_VERSION}" \
    && go install "google.golang.org/protobuf/cmd/protoc-gen-go@${PROTOC_GEN_GO_VERSION}" \
    && go install "connectrpc.com/connect/cmd/protoc-gen-connect-go@${PROTOC_GEN_CONNECT_GO_VERSION}" \
    && go clean -cache -modcache

# Prime the dependency caches so jobs unpack from disk instead of downloading.
#
# The repository does not vendor Go modules (src/*/vendor is git-ignored), so without this
# every job downloads them. Neither cache is part of the image tag: a job still fetches
# whatever is missing, so a dependency bump never needs a new image. The scheduled run of
# build-containers.yml rebuilds the image to keep the caches fresh.
#
# Only the manifests are copied, so this layer is rebuilt when a manifest changes and is
# otherwise served from the build cache.
ENV npm_config_cache=/opt/npm-cache
WORKDIR /tmp/prime
COPY src/cli/go.mod src/cli/go.sum src/cli/
COPY src/wails/go.mod src/wails/go.sum src/wails/
RUN (cd src/cli && go mod download) && (cd src/wails && go mod download)
# node_modules itself is not kept: the job checks out the repository elsewhere.
COPY package.json package-lock.json ./
COPY src/gui/package.json src/gui/
COPY src/protobuf/package.json src/protobuf/
RUN npm ci --no-audit --no-fund \
    && rm -rf /tmp/prime
WORKDIR /

# setup-environment skips its own tool installs when this is set.
ENV FME_BUILDER_CONTAINER=true

RUN node --version && npm --version && go version && task --version \
    && wails3 version && golangci-lint --version \
    && protoc-gen-go --version && protoc-gen-connect-go --version
