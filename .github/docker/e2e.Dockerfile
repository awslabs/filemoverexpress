# syntax=docker/dockerfile:1
# check=skip=InvalidDefaultArgInFrom
#
# End-to-end test image: the general CI image plus AWS Emulator (the S3 backend)
# and Playwright with Chromium (the GUI layer). amd64 only.
#
#   docker build -f .github/docker/e2e.Dockerfile \
#       --build-arg CI_IMAGE=<ci image reference> \
#       $(sed -n 's/^\([A-Z_]*=.*\)$/--build-arg \1/p' .github/versions.env) .

ARG CI_IMAGE
FROM ${CI_IMAGE}

ARG AWS_EMULATOR_VERSION
ARG PLAYWRIGHT_VERSION

ENV DEBIAN_FRONTEND=noninteractive

# AWS Emulator, installed from the signed Debian package. The key fingerprint is the one
# published in the AWS Emulator user guide; the build fails if it differs.
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends gnupg; \
    cd /tmp; \
    base=https://downloads.aws.com/aws-emulator/packages/aws-emulator/LTS; \
    pkg="aws-emulator_${AWS_EMULATOR_VERSION}-1_amd64.deb"; \
    curl -fsSLO "${base}/${pkg}"; \
    curl -fsSLO "${base}/${pkg}.sig"; \
    curl -fsSLo aws-publishing.asc https://downloads.aws.com/keys/gpg/current.asc; \
    gpg --import aws-publishing.asc; \
    fpr="$(gpg --with-colons --fingerprint ssm-publishing@amazon.com | awk -F: '/^fpr/ {print $10; exit}')"; \
    test "${fpr}" = "98BCF336A3BE53B734E967C52E5BF49BD940F624"; \
    gpg --verify "${pkg}.sig" "${pkg}"; \
    apt-get install -y --no-install-recommends "./${pkg}"; \
    rm -rf /tmp/* /root/.gnupg /var/lib/apt/lists/*; \
    aws-emulator -v

# Telemetry is on by default; tests never send usage data.
ENV EMULATOR_TELEMETRY=off

# Playwright and its Chromium, with the browser's system libraries. The browsers live
# outside the home directory so they survive the runner overriding HOME. The npm
# package installed here is only used to download the browser; the repository's own
# @playwright/test dependency must be the same version (see PLAYWRIGHT_VERSION).
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN set -eux; \
    mkdir /tmp/playwright; \
    cd /tmp/playwright; \
    npm init -y >/dev/null; \
    npm install --no-audit --no-fund "@playwright/test@${PLAYWRIGHT_VERSION}"; \
    npx playwright install --with-deps chromium; \
    chmod -R a+rX "${PLAYWRIGHT_BROWSERS_PATH}"; \
    rm -rf /tmp/playwright /var/lib/apt/lists/*
