# Code Signing Runbook

How File Mover Express signs and notarizes its desktop release artifacts in CI, how to
operate the pipeline, and how to troubleshoot it.

> Status: **macOS signing is implemented.** Windows (Authenticode) signing is planned and
> not yet wired into the release. Linux artifacts are published unsigned.

## Overview

Release artifacts are built and signed entirely in GitHub Actions (`.github/workflows/`):

- **macOS** — the Wails `.app` is signed with an Apple **Developer ID** certificate via an
  internal signing service, packaged into a `.dmg`, then **notarized and stapled** with the
  Apple notary service so it passes Gatekeeper.
- **Windows** — *(planned)* the NSIS installer `.exe` will be Authenticode-signed.
- **Linux** — published as-is (unsigned).

Signing is **gated behind a repository variable** (`MACOS_SIGNING_ENABLED`) so the normal
build keeps working before the signing infrastructure and credentials are configured.

## Workflows

| Workflow | Trigger | Runner | What it does |
|---|---|---|---|
| `release.yml` | tag `v*` or manual dispatch | per-platform | Builds installers, then (if enabled) calls the signing workflows and uses their output |
| `sign-macos.yml` | `workflow_call` | macOS | Signs the `.app`, then builds a `.dmg` from the signed app |
| `notarize-macos.yml` | `workflow_call` | macOS | Notarizes + staples the `.dmg`; independently re-runnable |

The macOS path is split on purpose: notarization is slow and occasionally flaky, so it is a
separate, idempotent workflow that can be re-run on an already-signed artifact without
re-signing.

### Flow

```
release.yml (generate-installer: builds the .app)
   └─ sign-macos.yml      → signed .app → .dmg
        └─ notarize-macos.yml → notarized + stapled .dmg → published
```

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

## Infrastructure prerequisites

These are provisioned once (outside this repo) and are required before signing can run:

- A **signing AWS account** with: the artifact-exchange S3 bucket; an IAM role the signer
  service assumes to access that bucket; a GitHub **OIDC provider** and an IAM role
  (`AWS_MACOS_SIGNING_ROLE_ARN`) whose trust policy is scoped to this repository
  (`repo:awslabs/filemoverexpress:*`) and which holds the signing-API + `iam:PassRole`
  permissions. (Provisioned by the internal signer CDK package.)
- **Signing-service onboarding** completed and the app/team allowlisted to sign.
- An **Apple Developer Program** account/team and an app-specific password for notarization.

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

## Verifying a build locally

For a `.dmg` you downloaded from a release:

```bash
xcrun stapler validate "File Mover Express.dmg"
spctl --assess --type install --verbose "File Mover Express.dmg"
# After mounting, for the .app:
codesign --verify --deep --strict --verbose=2 "/Volumes/.../FileMoverExpressUI.app"
```

## Related

- Installation status of signed artifacts: `docs/Installation.md`
- Workflow sources: `.github/workflows/sign-macos.yml`, `.github/workflows/notarize-macos.yml`,
  `.github/workflows/release.yml`
