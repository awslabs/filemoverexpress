#!/usr/bin/env bash
# Prints the content-addressed tag of a CI image: a hash of every file that goes into it.
#
#   image-tag.sh ci    tag of the general CI image
#   image-tag.sh e2e   tag of the end-to-end image (also covers the CI image it is built on)
#
# Used by the build workflow (to name what it pushes) and by resolve-image (to find it),
# so both always agree. Add a file here when a Dockerfile starts to depend on it.
set -euo pipefail

kind="${1:-}"
self="$(realpath "${BASH_SOURCE[0]}")"
cd "$(git rev-parse --show-toplevel)"

hash_files() {
    # Sort so the result does not depend on glob or locale ordering.
    LC_ALL=C sort <<<"$(printf '%s\n' "$@")" | xargs sha256sum | sha256sum | cut -c1-16
}

# Dependency manifests (go.sum, package-lock.json) are deliberately not inputs: they only warm
# caches, and a job fetches anything the image lacks. Hashing them would send every dependency
# bump down the slow no-image path. The scheduled rebuild keeps the caches fresh instead.
ci_files=(
    .github/versions.env
    .github/docker/ci.Dockerfile
    .github/docker/ci.Dockerfile.dockerignore
)

case "${kind}" in
    ci)
        hash_files "${ci_files[@]}"
        ;;
    e2e)
        ci_tag="$(bash "${self}" ci)"
        {
            echo "ci-tag ${ci_tag}"
            hash_files .github/versions.env .github/docker/e2e.Dockerfile .github/docker/e2e.Dockerfile.dockerignore
        } | sha256sum | cut -c1-16
        ;;
    *)
        echo "usage: image-tag.sh ci|e2e" >&2
        exit 2
        ;;
esac
