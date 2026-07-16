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

# Strip stray whitespace/newlines from env vars (GitHub variable textarea can add CRLF)
CD_SIGNER_API_BASE_URL=$(printf '%s' "$CD_SIGNER_API_BASE_URL" | tr -d '[:space:]')
SIGNING_BUCKET=$(printf '%s' "$SIGNING_BUCKET" | tr -d '[:space:]')
BUNDLE_ID=$(printf '%s' "$BUNDLE_ID" | tr -d '[:space:]')
AWS_REGION=$(printf '%s' "$AWS_REGION" | tr -d '[:space:]')
export CD_SIGNER_API_BASE_URL SIGNING_BUCKET BUNDLE_ID AWS_REGION

# --- sigv4_request: a Python helper replacing awscurl ---
# awscurl is broken on macOS arm64 GitHub runners (system site-packages conflict).
# This uses botocore's SigV4 signer directly.
sigv4_request() {
  local method="$1" url="$2" body="${3:-}"
  python3 - "$method" "$url" "$body" <<'PYTHON'
import sys, os, json
import requests
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
from botocore.credentials import Credentials

method, url, body = sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else ""
region = os.environ["AWS_REGION"]
credentials = Credentials(
    os.environ["AWS_ACCESS_KEY_ID"],
    os.environ["AWS_SECRET_ACCESS_KEY"],
    os.environ.get("AWS_SESSION_TOKEN", ""),
)
headers = {"Content-Type": "application/json"}
request = AWSRequest(method=method, url=url, data=body, headers=headers)
SigV4Auth(credentials, "signer-builder-tools", region).add_auth(request)
response = requests.request(
    method=method,
    url=url,
    headers=dict(request.headers),
    data=body,
    timeout=30,
)
print(response.text)
PYTHON
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
  RESP=$(sigv4_request POST "${CD_SIGNER_API_BASE_URL}/v2/sign-tasks" "$(cat manifest.json)" 2>&1) || true
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
  R=$(sigv4_request GET "${CD_SIGNER_API_BASE_URL}/v2/sign-tasks/${TASK_ID}")
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
[ "$S" = "success" ] || { echo "ERROR: sign-task timed out after 90 polls (status: $S)" >&2; exit 1; }

# --- Download and extract signed binary ---
mkdir -p mcp-signed
aws s3 cp "s3://${SIGNING_BUCKET}/${OUT_KEY}" mcp-signed/out

echo "=== Downloaded signed output ==="
file mcp-signed/out || true
ls -la mcp-signed/out

cd mcp-signed
if file out | grep -qi 'zip archive'; then
  echo "Extracting as zip via ditto"
  ditto -x -k out .
elif file out | grep -qi 'gzip\|tar'; then
  echo "Extracting as tar/gzip"
  tar -xzf out
else
  echo "Unknown archive format, attempting tar then ditto"
  tar -xzf out 2>/dev/null || tar -xpf out 2>/dev/null || ditto -x -k out . 2>/dev/null || {
    echo "ERROR: could not extract signed output" >&2; exit 1
  }
fi

# CD Signer double-wraps: outer tar contains artifact.gz which contains the signed files
if [ -f artifact.gz ]; then
  echo "Unwrapping nested artifact.gz"
  tar -xzf artifact.gz
fi

echo "=== Extracted tree ==="
find . -type f | head -50
cd ..

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
