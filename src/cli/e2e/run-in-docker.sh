#!/usr/bin/env bash
# Runs the e2e suite inside the fme-e2e image against a read-only copy of the repository mounted
# at /src. Used by `task e2e:docker`; nothing in the working tree is modified.
set -euo pipefail

mkdir -p /work "${HOME}/.filemoverexpress"
# Copy the sources without the host's dependency and build directories.
tar -C /src --exclude=./node_modules --exclude='./src/*/node_modules' --exclude=./.git \
    --exclude=./.agent-workspace --exclude=./dist --exclude='./src/*/vendor' -cf - . | tar -C /work -xf -

cd /work
npm ci --prefer-offline --no-audit --no-fund
export PATH="/work/node_modules/.bin:${PATH}"
task proto:generate
cd src/cli
exec go test -tags e2e -count=1 -v "${@:-./e2e/...}"
