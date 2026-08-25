# .github/docker/fme-builder.Dockerfile
FROM node:22-bookworm AS base

# Install Go
ARG GO_VERSION=1.25.3
RUN curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz" | tar -C /usr/local -xz
ENV PATH="/usr/local/go/bin:${PATH}"
ENV GOPATH="/go"
ENV PATH="${GOPATH}/bin:${PATH}"

# Install Task (go-task)
RUN sh -c "$(curl --location https://taskfile.dev/install.sh)" -- -d -b /usr/local/bin

# Install buf CLI
ARG BUF_VERSION=1.67.0
RUN curl -fsSL "https://github.com/bufbuild/buf/releases/download/v${BUF_VERSION}/buf-Linux-x86_64" -o /usr/local/bin/buf \
    && chmod +x /usr/local/bin/buf

# Install Go protobuf codegen plugins (required by buf.gen.yaml local: directives)
RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@latest \
    && go install connectrpc.com/connect/cmd/protoc-gen-connect-go@latest

# Install golangci-lint
ARG GOLANGCI_LINT_VERSION=2.1.6
RUN curl -fsSL https://raw.githubusercontent.com/golangci/golangci-lint/HEAD/install.sh | sh -s -- -b /usr/local/bin v${GOLANGCI_LINT_VERSION}

# Install Chrome for Karma headless testing
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    && rm -rf /var/lib/apt/lists/*
ENV CHROME_BIN=/usr/bin/chromium
ENV CHROMIUM_BIN=/usr/bin/chromium

# Mark this as the FME builder container for setup-environment detection
ENV FME_BUILDER_CONTAINER=true

# Set working directory
WORKDIR /workspace

# Pre-install npm dependencies (layer cached unless lockfile changes)
COPY package.json package-lock.json ./
COPY src/gui/package.json src/gui/
RUN npm ci

# Final verification
RUN node --version && go version && task --version && buf --version && golangci-lint version \
    && protoc-gen-go --version && protoc-gen-connect-go --version
