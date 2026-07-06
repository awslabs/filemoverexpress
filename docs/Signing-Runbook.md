# Code Signing Runbook

How File Mover Express signs and notarizes its desktop release artifacts in CI, how to
operate the pipeline, and how to troubleshoot it.

> Status: **macOS and Windows signing are implemented.** macOS is signed + notarized; the
> Windows installer is Authenticode-signed via AWS Code Signer (validated against a test
> profile — production profiles pending Wallaby onboarding). Linux artifacts are unsigned.

## Overview

Release artifacts are built and signed entirely in GitHub Actions (`.github/workflows/`):

- **macOS** — the Wails `.app` is signed with an Apple **Developer ID** certificate via an
  internal signing service, packaged into a `.dmg`, then **notarized and stapled** with the
  Apple notary service so it passes Gatekeeper.
- **Windows** — the NSIS installer `.exe` is **Authenticode-signed** via the AWS Code Signer
  (Wallaby) **S3-bridge**: the unsigned `.exe` is uploaded to a signing bucket, an in-account
  Lambda auto-signs it with AWS Signer, and the signed `.exe` is downloaded and verified.
- **Linux** — published as-is (unsigned).

Signing is **gated behind repository variables** (`MACOS_SIGNING_ENABLED`,
`WINDOWS_SIGNING_ENABLED`) so the normal build keeps working before the signing
infrastructure and credentials are configured.

## Workflows

| Workflow | Trigger | Runner | What it does |
|---|---|---|---|
| `release.yml` | tag `v*` or manual dispatch | per-platform | Builds installers, then (if enabled) calls the signing workflows and uses their output |
| `sign-macos.yml` | `workflow_call` | macOS | Signs the `.app`, then builds a `.dmg` from the signed app |
| `notarize-macos.yml` | `workflow_call` | macOS | Notarizes + staples the `.dmg`; independently re-runnable |
| `sign-windows.yml` | `workflow_call` | Ubuntu | Uploads the NSIS `.exe` to the AWS Code Signer S3-bridge, waits for the signed object, verifies Authenticode (fail closed) |

The macOS path is split on purpose: notarization is slow and occasionally flaky, so it is a
separate, idempotent workflow that can be re-run on an already-signed artifact without
re-signing.

### Flow

```
release.yml (generate-installer)
   ├─ macOS:   sign-macos.yml → signed .app → .dmg
   │              └─ notarize-macos.yml → notarized + stapled .dmg → published
   └─ Windows: sign-windows.yml → Authenticode-signed .exe → published
```

`sign-macos` and `sign-windows` are independent jobs (both only `needs: generate-installer`,
`fail-fast: false`, `if: !cancelled()`), so a failure on one platform does not block the other.

## Required GitHub configuration

Set these in the repository under **Settings → Secrets and variables → Actions**. The actual
values come from your signing AWS account and Apple Developer account (kept out of this public
doc on purpose).

### Repository variables

`MACOS_SIGNING_ENABLED` must be a **repository** variable (a job `if:` in `release.yml` reads
it, and job-level `if:` cannot see environment-scoped variables).

| Variable | Purpose |
|---|---|
| `MACOS_SIGNING_ENABLED` | `true` to turn on the macOS sign + notarize jobs in `release.yml` |
| `CD_SIGNER_REGION` | AWS region of the signing API |
| `CD_SIGNER_API_BASE_URL` | Base URL of the signing API |
| `MACOS_SIGNING_BUCKET` | S3 bucket used to exchange artifacts with the signer (`pre-signed/`, `signed/`) |
| `MACOS_BUNDLE_ID` | The app bundle identifier registered for signing; must match the app's `CFBundleIdentifier` |

### `signing` environment secrets

Create a GitHub **environment** named `signing` (with branch protection) and add:

| Secret | Purpose |
|---|---|
| `AWS_MACOS_SIGNING_ROLE_ARN` | IAM role assumed by GitHub Actions via OIDC to call the signing API |
| `CD_SIGNER_BUCKET_ACCESS_ROLE` | IAM role the signer assumes to read/write the signing bucket |
| `APPLE_TEAM_ID` | Apple Developer Team ID |
| `APPLE_ID` | Apple ID used by `notarytool` (use a team/role account, not personal) |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for that Apple ID (appleid.apple.com → Sign-In & Security) |

> The non-secret config (bucket name, region, API URL, bundle id) are variables; the role
> ARNs and Apple credentials are environment secrets so they are branch-protected and
> rotatable. Authentication to AWS is via GitHub OIDC — there are no long-lived AWS keys.

### Windows (AWS Code Signer)

Repository variables:

| Variable | Purpose |
|---|---|
| `WINDOWS_SIGNING_ENABLED` | `true` to turn on the `sign-windows` job in `release.yml` (must be a **repository** variable — read by a job `if:`) |
| `AWS_SIGNING_ACCOUNT_ID` | Signing AWS account id; the unsigned/signed bucket names are derived from it (`<acct>-fme-unsigned` / `-fme-signed`) |
| `AWS_SIGNING_REGION` | AWS region of the signing buckets |
| `WINDOWS_SIGNING_PROFILE_IDENTIFIER` | *(optional)* Signer profile identifier; defaults to the app's known value |
| `WINDOWS_SIGNING_PLATFORM` | *(optional)* Signer platform id; defaults to `AuthenticodeSigner-SHA256-RSA` |
| `WINDOWS_SIGNING_REQUIRE_TRUSTED_CHAIN` | *(optional)* `true` to require a fully trusted cert chain (production EV cert). Leave unset for **test** profiles, whose chain is not publicly trusted |

`signing` environment secret:

| Secret | Purpose |
|---|---|
| `AWS_SIGNING_ROLE_ARN` | IAM role assumed via OIDC with direct access to the signing S3 buckets |

**How the S3-bridge works (the key contract matters):** the workflow uploads the unsigned
`.exe` to `s3://<acct>-fme-unsigned/{profileIdentifier}/{signingPlatform}/{run}-{attempt}/<exe>`.
The SigningLambda parses the **first two key segments** to resolve the signing profile from SSM
(`{ApplicationName}.{profileIdentifier}.{signingPlatform}.ProfileName`/`.ProfileOwner`), so that
prefix is **mandatory**. AWS Signer writes the signed object to `{uploadedKey}-{jobId}` in the
signed bucket, so the workflow polls that prefix (a timeout means the signing job failed —
fail closed) rather than the original key.

> **Test vs production profiles:** the same profile identifier/platform is retained when
> production profiles are issued — only the SSM `ProfileName`/`ProfileOwner` values change. So
> no workflow change is needed to move to production; just set
> `WINDOWS_SIGNING_REQUIRE_TRUSTED_CHAIN=true` once the production (EV) profile is active.

## Infrastructure prerequisites

These are provisioned once (outside this repo) and are required before signing can run:

- A **signing AWS account** with: the artifact-exchange S3 bucket; an IAM role the signer
  service assumes to access that bucket; a GitHub **OIDC provider** and an IAM role
  (`AWS_MACOS_SIGNING_ROLE_ARN`) whose trust policy is scoped to this repository
  (`repo:awslabs/filemoverexpress:*`) and which holds the signing-API + `iam:PassRole`
  permissions. (Provisioned by the internal signer CDK package.)
- **Signing-service onboarding** completed and the app/team allowlisted to sign.
- An **Apple Developer Program** account/team and an app-specific password for notarization.
- For **Windows**: **Wallaby / AWS Code Signer onboarding** completed in the signing account —
  the unsigned/signed S3 buckets + auto-signing Lambda deployed, the OIDC caller role granted
  direct bucket access, and signing profiles issued (SSM `ProfileName`/`ProfileOwner`
  parameters present). Test profiles are enough to validate the pipeline; production EV
  profiles are issued after the application security review is approved.

If you run from a fork, the OIDC role trust policy must be widened to that fork's repo path,
or OIDC `AssumeRoleWithWebIdentity` will be denied.

## How to cut a signed release

1. Ensure `MACOS_SIGNING_ENABLED=true` and the variables/secrets above are set.
2. Push a tag `vX.Y.Z` (or use **Actions → release → Run workflow** with a version).
3. `release.yml` builds installers, signs + notarizes the macOS `.dmg`, and the signed
   artifacts are produced as `notarized-installer-mac-<arch>`.

## How to test signing (before a real release)

1. Set the variables/secrets and make sure the `signing` environment allows your test branch.
2. **Actions → release → Run workflow**, pick your branch, set a throwaway version
   (e.g. `0.0.1-signtest`).
3. Watch the `sign-macos` and `notarize-macos` jobs for each architecture.

### Success criteria

- `sign-macos`: `codesign --verify --deep --strict` passes (no `Signature=adhoc`); a
  `signed-installer-mac-<arch>` artifact is produced.
- `notarize-macos`: `notarytool` returns `Accepted`; `stapler validate` and
  `spctl --assess --type install` pass; a `notarized-installer-mac-<arch>` artifact is produced.
- `sign-windows`: the signed object appears in the signed bucket, `osslsigncode verify` finds a
  signature (fail closed if none), and a `signed-installer-win-<arch>` artifact is produced.
  With a **test** profile the cert chain is not publicly trusted, so leave
  `WINDOWS_SIGNING_REQUIRE_TRUSTED_CHAIN` unset (signature-present is the gate); set it `true`
  for production.

## Notarization retry procedure

Notarization can take ~15 minutes and occasionally fails transiently on Apple's side. Because
`notarize-macos.yml` is separate and idempotent, you can retry it on the **already-signed**
`.dmg` without re-signing:

- Re-run the failed `notarize-macos` job from the workflow run, **or**
- Trigger `notarize-macos.yml` against the existing `signed-installer-mac-<arch>` artifact.

The Apple submission id is printed in the job log; use it with `xcrun notarytool log <id>` to
see why a submission was rejected.

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| OIDC `AssumeRoleWithWebIdentity` denied | The signing role trust policy doesn't match the repo/branch running the workflow (it is scoped to `repo:awslabs/filemoverexpress:*`). Running from a fork needs the trust widened. |
| `sign-macos` can't find the signed `.app` after download | The signer's `signed/` output layout differs from what the download step expects; the step prints a `find` dump — adjust the extraction to match. |
| Notarization rejected: "not signed with a valid Developer ID / hardened runtime" | The signing step didn't apply hardened runtime; confirm the signing certificate type and that hardened runtime is enabled for the signed app. |
| Sign-task rejected on authorization | The manifest `identifier` (`MACOS_BUNDLE_ID`) doesn't match the app identity registered/allowlisted for signing. |
| Sign-task times out | The signer never wrote to `signed/`; check the signing-service status and that the bucket-access role is passed correctly. |
| `release.yml` macOS/Windows build fails in `setup-environment` | The Linux dependency step must be guarded to Linux runners only (it is, via `if: runner.os == 'Linux'`). |
| Gatekeeper assessment fails on a downloaded `.dmg` | The ticket wasn't stapled, or the app inside isn't Developer ID-signed; re-check the sign + staple steps. |
| `sign-windows` times out waiting for the signed object | The SigningLambda never produced output — usually the upload key was wrong (it MUST be `{profileIdentifier}/{signingPlatform}/…` so the Lambda can resolve the SSM profile), or the profile SSM params don't exist. Check the Lambda logs in the signing account. |
| `sign-windows` fails "no Authenticode signature" | The downloaded object isn't signed; confirm the signing job succeeded and that the profile is active. |
| `sign-windows` verify fails on chain trust | Expected with **test** profiles (chain not publicly trusted). Leave `WINDOWS_SIGNING_REQUIRE_TRUSTED_CHAIN` unset for test; set `true` only once a production EV profile is active. |
| Windows build fails at `makensis`/NSIS | makensis must be on PATH (installed on Windows runners in `setup-environment`); NSIS template placeholders must be resolved (the Windows Taskfile passes `INFO_*` defines and renders the association macros). |

## Verifying a build locally

For a `.dmg` you downloaded from a release:

```bash
xcrun stapler validate "File Mover Express.dmg"
spctl --assess --type install --verbose "File Mover Express.dmg"
# After mounting, for the .app:
codesign --verify --deep --strict --verbose=2 "/Volumes/.../FileMoverExpressUI.app"
```

For a Windows installer `.exe`:

```powershell
# Windows
Get-AuthenticodeSignature .\FileMoverExpressUI-amd64-installer.exe | Format-List
```

```bash
# any platform with osslsigncode
osslsigncode verify -in FileMoverExpressUI-amd64-installer.exe
```

A **test**-profile signature will show a valid signature but an untrusted chain; a production
EV signature verifies fully and clears SmartScreen over time.

## Related

- Installation status of signed artifacts: `docs/Installation.md`
- Workflow sources: `.github/workflows/sign-macos.yml`, `.github/workflows/notarize-macos.yml`,
  `.github/workflows/sign-windows.yml`, `.github/workflows/release.yml`
