#!/usr/bin/env bash
# Signs the fme-mcp binary via CD Signer using the executables signing path.
#
# Expected environment variables:
#   AWS_REGION, CD_SIGNER_API_BASE_URL, SIGNING_BUCKET, BUNDLE_ID,
#   BUCKET_ACCESS_ROLE, APPLE_TEAM_ID, ARCH
#
# Expected: unsigned/fme-mcp exists in the current working directory.
# Requires: awscurl installed in the active Python (python3 -m awscurl).
set -euo pipefail

# Wrapper function to invoke awscurl via the explicit Python binary from setup-python,
# avoiding conflicts with stale system-installed versions on macOS GitHub runners.
# PYTHON_BIN is set by the workflow's install-deps step.
PYTHON="${PYTHON_BIN:-python3}"
awscurl() {
  "${PYTHON}" -m awscurl "$@"
}

rm -rf mcp-pkg mcp-signed
mkdir -p mcp-pkg/EXECUTABLES_TO_SIGN
cp unsigned/fme-mcp mcp-pkg/EXECUTABLES_TO_SIGN/fme-mcp
( cd mcp-pkg && gtar -czf artifact.gz EXECUTABLES_TO_SIGN && gtar -czf package.tar.gz artifact.gz )

IN_KEY="pre-signed/fme-mcp-${ARCH}.tar.gz"
OUT_KEY="signed/fme-mcp-${ARCH}-signed.tar.gz"
aws s3 cp mcp-pkg/package.tar.gz "s3://${SIGNING_BUCKET}/${IN_KEY}"

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

echo "Submitting fme-mcp sign-task:"
cat manifest.json

# --- Create sign-task with retry ---
TASK_ID=""
DELAY=15
MAX_DELAY=120
for attempt in 1 2 3 4 5 6; do
  RESP=$(awscurl --service signer-builder-tools --region "$AWS_REGION" -X POST \
    --header "Content-Type: application/json" --data @manifest.json \
    "${CD_SIGNER_API_BASE_URL}/v2/sign-tasks" 2>&1) || true
  echo "----- response (attempt ${attempt}) -----"
  echo "$RESP"
  echo "-----"
  TASK_ID=$(printf '%s' "$RESP" | jq -r '.signTaskId // empty' 2>/dev/null || true)
  [ -n "$TASK_ID" ] && break
  if printf '%s' "$RESP" | grep -qi "Too Many Requests"; then
    sleep "$DELAY"
    DELAY=$(( DELAY * 2 > MAX_DELAY ? MAX_DELAY : DELAY * 2 ))
    continue
  fi
  echo "ERROR: sign-task not created (non-retryable response above)" >&2
  exit 1
done
[ -n "$TASK_ID" ] || { echo "ERROR: sign-task not created after retries" >&2; exit 1; }
echo "Created sign-task: ${TASK_ID}"

# --- Poll until terminal ---
for i in $(seq 1 90); do
  R=$(awscurl --service signer-builder-tools --region "$AWS_REGION" -X GET \
    --header "Content-Type: application/json" \
    "${CD_SIGNER_API_BASE_URL}/v2/sign-tasks/${TASK_ID}")
  S=$(printf '%s' "$R" | jq -r '.status // "unknown"')
  echo "Poll ${i}: ${S}"
  case "$S" in
    success) break ;;
    failure)
      echo "ERROR: signing failed" >&2
      printf '%s' "$R" | jq . >&2
      exit 1 ;;
    *) sleep 10 ;;
  esac
done

# --- Download and extract signed binary ---
mkdir -p mcp-signed
aws s3 cp "s3://${SIGNING_BUCKET}/${OUT_KEY}" mcp-signed/out
( cd mcp-signed
  if file out | grep -qi 'zip archive'; then ditto -x -k out .; else tar -xpf out 2>/dev/null || true; fi
  [ -f artifact.gz ] && tar -xpf artifact.gz 2>/dev/null || true )

SIGNED=$(find mcp-signed -name fme-mcp -type f | head -n1)
[ -n "$SIGNED" ] || { echo "ERROR: signed binary not found" >&2; find mcp-signed >&2; exit 1; }
cp "$SIGNED" signed-fme-mcp
chmod +x signed-fme-mcp

# --- Verify signature (fail closed) ---
echo "=== Verify signature ==="
codesign --verify --strict --verbose=2 signed-fme-mcp
if codesign --display --verbose=2 signed-fme-mcp 2>&1 | grep -qi "Signature=adhoc"; then
  echo "ERROR: fme-mcp is still ad-hoc signed" >&2
  exit 1
fi
echo "fme-mcp signed and verified"
