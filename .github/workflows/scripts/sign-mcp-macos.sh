#!/usr/bin/env bash
# Signs the fme-mcp binary via CD Signer using the executables signing path.
#
# Expected environment variables:
#   AWS_REGION, CD_SIGNER_API_BASE_URL, SIGNING_BUCKET, BUNDLE_ID,
#   BUCKET_ACCESS_ROLE, APPLE_TEAM_ID, ARCH,
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN (from OIDC)
#
# Expected: unsigned/fme-mcp exists in the current working directory.
# Requires: python3 with requests + botocore installed.
set -euo pipefail

# Resolve the directory this script lives in, so we can find companion scripts
# (e.g. sigv4_request.py) regardless of the caller's working directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ==============================================================================
# Configuration
# ==============================================================================

MAX_CREATE_ATTEMPTS=6
INITIAL_RETRY_DELAY=15
MAX_RETRY_DELAY=120

MAX_POLL_ATTEMPTS=90
POLL_INTERVAL=10

# ==============================================================================
# Utility functions
# ==============================================================================

# Prints an error message to stderr and exits with code 1.
die() {
    echo "ERROR: $*" >&2
    exit 1
}

# Prints an informational message to stdout.
info() {
    echo "[INFO] $*"
}

# Makes a SigV4-signed HTTP request using botocore via the companion Python script.
#
# awscurl is broken on macOS arm64 GitHub runners (system site-packages conflict),
# so we use botocore's SigV4 signer directly (see sigv4_request.py).
#
# Arguments:
#   $1 - HTTP method (GET, POST, etc.)
#   $2 - URL
#   $3 - Request body (optional, defaults to empty string)
#
# Outputs:
#   The response body on stdout.
sigv4_request() {
    local method="$1"
    local url="$2"
    local body="${3:-}"

    python3 "${SCRIPT_DIR}/sigv4_request.py" "$method" "$url" "$body"
}

# ==============================================================================
# Step functions
# ==============================================================================

# Strips stray whitespace and CRLF from environment variables that may have been
# corrupted by GitHub variable textareas.
sanitize_environment() {
    info "Sanitizing environment variables..."

    CD_SIGNER_API_BASE_URL=$(printf '%s' "$CD_SIGNER_API_BASE_URL" | tr -d '[:space:]')
    SIGNING_BUCKET=$(printf '%s' "$SIGNING_BUCKET" | tr -d '[:space:]')
    BUNDLE_ID=$(printf '%s' "$BUNDLE_ID" | tr -d '[:space:]')
    AWS_REGION=$(printf '%s' "$AWS_REGION" | tr -d '[:space:]')

    export CD_SIGNER_API_BASE_URL SIGNING_BUCKET BUNDLE_ID AWS_REGION
}

# Packages the unsigned fme-mcp binary into the nested tar.gz structure that the
# CD Signer service expects.
#
# Output: mcp-pkg/package.tar.gz
package_unsigned_binary() {
    info "Packaging unsigned fme-mcp binary for signing..."

    rm -rf mcp-pkg mcp-signed
    mkdir -p mcp-pkg/EXECUTABLES_TO_SIGN

    cp unsigned/fme-mcp mcp-pkg/EXECUTABLES_TO_SIGN/fme-mcp

    (
        cd mcp-pkg
        gtar -czf artifact.gz EXECUTABLES_TO_SIGN
        gtar -czf package.tar.gz artifact.gz
    )

    info "Package created at mcp-pkg/package.tar.gz"
}

# Uploads the unsigned package to the signing S3 bucket.
#
# Sets global variables:
#   IN_KEY  - S3 key where the unsigned package was uploaded
#   OUT_KEY - S3 key where the signed artifact will appear
upload_to_s3() {
    IN_KEY="pre-signed/fme-mcp-${ARCH}.tar.gz"
    OUT_KEY="signed/fme-mcp-${ARCH}-signed.tar.gz"

    info "Uploading unsigned package to s3://${SIGNING_BUCKET}/${IN_KEY}"
    aws s3 cp mcp-pkg/package.tar.gz "s3://${SIGNING_BUCKET}/${IN_KEY}"
}

# Builds the JSON manifest that describes the signing request to the CD Signer
# service — what to sign, which certificate to use, and where to find/put the
# artifacts in S3.
#
# Output: manifest.json in the current directory.
build_manifest() {
    info "Building signing manifest..."

    cat > manifest.json <<EOF
{
  "manifest": {
    "type": "app",
    "os": "osx",
    "name": "EXECUTABLES_TO_SIGN",
    "outputs": [{ "label": "macos", "path": "EXECUTABLES_TO_SIGN" }],
    "app": {
      "identifier": "${BUNDLE_ID}.mcp",
      "signing_requirements": {
        "certificate_type": "developerIDAppDistribution",
        "team_id": "${APPLE_TEAM_ID}"
      }
    }
  },
  "s3ArtifactLocations": {
    "bucketAccessRole": "${BUCKET_ACCESS_ROLE}",
    "bucket": "${SIGNING_BUCKET}",
    "inputKey": "${IN_KEY}",
    "outputKey": "${OUT_KEY}"
  }
}
EOF

    info "Manifest contents:"
    cat manifest.json
    echo ""
}

# Submits the signing request to the CD Signer API. Retries with exponential
# backoff on rate-limit (429) responses.
#
# Sets global variable:
#   TASK_ID - the sign-task identifier returned by the API
create_sign_task() {
    info "Submitting sign-task to CD Signer API..."

    TASK_ID=""
    local retry_delay="$INITIAL_RETRY_DELAY"

    for attempt in $(seq 1 "$MAX_CREATE_ATTEMPTS"); do
        local response
        response=$(sigv4_request POST "${CD_SIGNER_API_BASE_URL}/v2/sign-tasks" "$(cat manifest.json)" 2>&1) || true

        echo "----- response (attempt ${attempt}/${MAX_CREATE_ATTEMPTS}) -----"
        echo "$response"
        echo "-----"

        # Try to extract the task ID from the response JSON.
        TASK_ID=$(printf '%s' "$response" | jq -r '.signTaskId // empty' 2>/dev/null || true)

        if [ -n "$TASK_ID" ]; then
            info "Created sign-task: ${TASK_ID}"
            return 0
        fi

        # If the failure is a rate-limit (429), back off and retry.
        if printf '%s' "$response" | grep -qi "Too Many Requests"; then
            info "Rate-limited (429). Retrying in ${retry_delay}s..."
            sleep "$retry_delay"

            # Exponential backoff, capped at MAX_RETRY_DELAY.
            retry_delay=$(( retry_delay * 2 ))
            if [ "$retry_delay" -gt "$MAX_RETRY_DELAY" ]; then
                retry_delay="$MAX_RETRY_DELAY"
            fi
            continue
        fi

        # Non-retryable error — bail out immediately.
        die "sign-task not created (non-retryable response above)"
    done

    die "sign-task not created after ${MAX_CREATE_ATTEMPTS} attempts"
}

# Polls the CD Signer API until the sign-task reaches a terminal state
# (success or failure). Times out after MAX_POLL_ATTEMPTS polls.
poll_sign_task() {
    info "Polling sign-task status (up to ${MAX_POLL_ATTEMPTS} attempts, ${POLL_INTERVAL}s interval)..."

    local task_status="unknown"

    for poll_number in $(seq 1 "$MAX_POLL_ATTEMPTS"); do
        local poll_response
        poll_response=$(sigv4_request GET "${CD_SIGNER_API_BASE_URL}/v2/sign-tasks/${TASK_ID}")
        task_status=$(printf '%s' "$poll_response" | jq -r '.status // "unknown"')

        echo "Poll ${poll_number}/${MAX_POLL_ATTEMPTS}: ${task_status}"

        if [ "$task_status" = "success" ]; then
            info "Sign-task completed successfully."
            return 0
        fi

        if [ "$task_status" = "failure" ]; then
            echo "ERROR: signing failed. Full response:" >&2
            printf '%s' "$poll_response" | jq . >&2
            exit 1
        fi

        # Still in progress — wait and try again.
        sleep "$POLL_INTERVAL"
    done

    die "sign-task timed out after ${MAX_POLL_ATTEMPTS} polls (last status: ${task_status})"
}

# Downloads the signed artifact from S3 and extracts the fme-mcp binary.
# Handles both zip (via ditto) and tar archive formats, as the signing service
# may return either.
#
# Output: signed-fme-mcp in the current directory.
download_and_extract_signed_binary() {
    info "Downloading signed artifact from s3://${SIGNING_BUCKET}/${OUT_KEY}"

    mkdir -p mcp-signed
    aws s3 cp "s3://${SIGNING_BUCKET}/${OUT_KEY}" mcp-signed/out

    # --- Debug: inspect the downloaded file before extraction ---
    info "Downloaded file details:"
    ls -la mcp-signed/out
    file mcp-signed/out

    local file_size
    file_size=$(wc -c < mcp-signed/out | tr -d '[:space:]')
    if [ "$file_size" -eq 0 ]; then
        die "Downloaded artifact is empty (0 bytes)"
    fi
    info "Downloaded artifact size: ${file_size} bytes"

    (
        cd mcp-signed

        # The signing service may return either a zip or a tar archive.
        local file_type
        file_type=$(file out)
        info "Detected file type: ${file_type}"

        if echo "$file_type" | grep -qi 'zip archive'; then
            info "Extracting signed artifact (zip format via ditto)..."
            ditto -x -k out .
        elif echo "$file_type" | grep -qi 'gzip\|tar'; then
            info "Extracting signed artifact (tar/gzip format)..."
            tar -xpf out
        else
            info "WARNING: Unrecognized file type '${file_type}'. Attempting tar extraction as fallback..."
            tar -xpf out
        fi

        # --- Debug: show what extraction produced ---
        info "Contents after first extraction:"
        find . -not -name out | sort

        # The signed artifact may contain a nested artifact.gz layer.
        if [ -f artifact.gz ]; then
            info "Extracting nested artifact.gz..."
            file artifact.gz
            tar -xpf artifact.gz

            info "Contents after nested extraction:"
            find . -not -name out -not -name artifact.gz | sort
        else
            info "No nested artifact.gz found (skipping second extraction)"
        fi
    )

    # --- Debug: show the full tree of extracted files ---
    info "Full mcp-signed/ directory tree:"
    find mcp-signed -type f -exec ls -la {} \;

    # Locate the signed binary in the extracted output.
    local signed_path
    signed_path=$(find mcp-signed -name fme-mcp -type f | head -n1)

    if [ -z "$signed_path" ]; then
        echo "ERROR: signed binary not found after extraction." >&2
        echo "Directory listing of mcp-signed/:" >&2
        find mcp-signed -ls >&2
        echo "" >&2
        echo "Expected to find a file named 'fme-mcp' somewhere in mcp-signed/" >&2
        die "signed binary not found"
    fi

    info "Found signed binary at: ${signed_path}"
    ls -la "$signed_path"
    file "$signed_path"

    cp "$signed_path" signed-fme-mcp
    chmod +x signed-fme-mcp

    info "signed-fme-mcp ready ($(wc -c < signed-fme-mcp | tr -d '[:space:]') bytes)"
}

# Verifies the code signature on the signed binary. Fails if the signature is
# invalid or if the binary is only ad-hoc signed (meaning the real signing
# didn't apply).
verify_signature() {
    info "Verifying code signature..."

    codesign --verify --strict --verbose=2 signed-fme-mcp

    # Ensure it is NOT ad-hoc signed (ad-hoc means it was never properly signed).
    local codesign_output
    codesign_output=$(codesign --display --verbose=2 signed-fme-mcp 2>&1)

    if echo "$codesign_output" | grep -qi "Signature=adhoc"; then
        die "fme-mcp is still ad-hoc signed — signing did not apply correctly"
    fi

    info "fme-mcp signed and verified successfully."
}

# ==============================================================================
# Main
# ==============================================================================

main() {
    sanitize_environment
    package_unsigned_binary
    upload_to_s3
    build_manifest
    create_sign_task
    poll_sign_task
    download_and_extract_signed_binary
    verify_signature
}

main "$@"
