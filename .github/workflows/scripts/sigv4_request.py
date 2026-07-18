#!/usr/bin/env python3
"""Makes a SigV4-signed HTTP request using botocore.

This replaces awscurl, which is broken on macOS arm64 GitHub runners due to
system site-packages conflicts. It uses botocore's SigV4 signer directly.

Usage:
    python3 sigv4_request.py <METHOD> <URL> [BODY]

Arguments:
    METHOD  - HTTP method (GET, POST, etc.)
    URL     - Full URL to send the request to
    BODY    - Request body (optional, defaults to empty string)

Required environment variables:
    AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
    AWS_SESSION_TOKEN (optional, for temporary credentials from OIDC)

Outputs:
    The response body on stdout.
"""

import sys
import os

import requests
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
from botocore.credentials import Credentials


def main():
    if len(sys.argv) < 3:
        print("Usage: sigv4_request.py <METHOD> <URL> [BODY]", file=sys.stderr)
        sys.exit(1)

    method = sys.argv[1]
    url = sys.argv[2]
    body = sys.argv[3] if len(sys.argv) > 3 else ""

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


if __name__ == "__main__":
    main()
