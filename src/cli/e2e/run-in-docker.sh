#!/usr/bin/env bash
# Runs the e2e suites inside the fme-e2e image against a read-only copy of the repository mounted
# at /src. Used by `task e2e:docker`; nothing in the working tree is modified.
#
#   run-in-docker.sh [daemon|gui|all] [extra arguments for the selected suite]
set -euo pipefail

suite="${1:-all}"
shift || true

mkdir -p /work "${HOME}/.filemoverexpress"
# Copy the sources without the host's dependency and build directories.
tar -C /src --exclude=./node_modules --exclude='./src/*/node_modules' --exclude=./.git \
    --exclude=./.agent-workspace --exclude=./dist --exclude='./src/*/vendor' \
    --exclude=./src/gui/e2e/.bin -cf - . | tar -C /work -xf -

cd /work
npm ci --prefer-offline --no-audit --no-fund
export PATH="/work/node_modules/.bin:${PATH}"

# When a writable /out is mounted, keep the Playwright results (screenshots, traces) there.
save_gui_results() {
    if [ -d /out ] && [ -w /out ]; then
        cp -r /work/src/gui/e2e/test-results /work/src/gui/e2e/playwright-report /out/ 2>/dev/null || true
    fi
}

case "${suite}" in
    daemon)
        task proto:generate
        cd src/cli && go test -tags e2e -count=1 -v "${@:-./e2e/...}"
        ;;
    gui)
        task generate
        trap save_gui_results EXIT
        task gui:e2e -- "$@"
        ;;
    all)
        task generate
        (cd src/cli && go test -tags e2e -count=1 -v ./e2e/...)
        trap save_gui_results EXIT
        task gui:e2e
        ;;
    *)
        echo "usage: run-in-docker.sh [daemon|gui|all] [args...]" >&2
        exit 2
        ;;
esac
