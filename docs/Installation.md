# Installation

## Download

Download the latest installer for your platform from the [Releases page](https://github.com/awslabs/filemoverexpress/releases).

| Platform | File |
|----------|------|
| macOS (Apple Silicon) | `filemoverexpress-macos-arm64.dmg` |
| macOS (Intel) | `filemoverexpress-macos-x64.dmg` |
| Windows (x64) | `filemoverexpress-windows-amd64-installer.exe` |
| Windows (arm64) | `filemoverexpress-windows-arm64-installer.exe` |
| Linux (headless daemon) | `filemoverexpress-linux-amd64` / `filemoverexpress-linux-arm64` |

> **Linux is headless-only.** There is no Linux desktop GUI download - Linux ships the
> CLI daemon, which you run on a server, render farm, or cloud instance and drive from a
> GUI on another machine over a remote-daemon connection. Follow the
> [Headless Linux Installation](Headless-Linux-Installation.md) guide instead of the
> desktop steps below.

> **Note on code signing:** macOS `.dmg` releases are signed with an **Apple Developer ID
> Application** certificate belonging to Amazon's Apple Developer team (**AMZN Mobile LLC**, Apple
> **Team ID `94KV3E626L`**) and **notarized** by Apple, so they install and launch without a
> Gatekeeper workaround. Windows installers are **Authenticode-signed** via AWS Code Signer under
> the organization **"Amazon Web Services, Inc."**; SmartScreen may still show a warning until the
> certificate builds reputation — click "More info" then "Run anyway" if so. Linux artifacts are
> unsigned.
>
> Because anyone could build and self-sign an app named "File Mover Express", confirm the
> signature is Amazon's before trusting a download — see [Verifying the signature](#verifying-the-signature).
> For how signing works in the release pipeline, see the [Code Signing Runbook](Signing-Runbook.md).

---

## Install

**macOS**

1. Open the `.dmg` and drag File Mover Express to Applications.
2. Launch File Mover Express from Applications as normal.

   Because the app is signed and notarized, macOS Gatekeeper opens it without any warning or
   workaround.

   > **Older or self-built apps:** If you have an older unsigned build (or one you built from
   > source) and macOS reports it as "damaged", the app is quarantined, not broken. Remove the
   > quarantine flag with:
   > ```bash
   > sudo xattr -rd com.apple.quarantine /Applications/File\ Mover\ Express.app
   > ```

**Windows**

Run the installer and follow the prompts. The installer is Authenticode-signed; if SmartScreen
still shows a warning (the certificate reputation builds over time), click "More info" then
"Run anyway".

**Linux** - Linux is headless-only; there is no desktop AppImage. Install the CLI daemon by
following the [Headless Linux Installation](Headless-Linux-Installation.md) guide.

---

## Verifying the signature

Anyone can build and self-sign an app called "File Mover Express", so a signature alone doesn't
prove it came from Amazon. Before trusting a download, confirm the signing **identity** matches
the values below. If it doesn't match, don't run it.

**macOS** — check notarization and the signing identity (replace the `.dmg` name with the file you
downloaded):

```bash
# 1. Gatekeeper / notarization: expect "accepted" and "source=Notarized Developer ID"
spctl --assess --type install --verbose=2 "filemoverexpress-macos-arm64.dmg"

# 2. Signing identity of the installed app
codesign -dv --verbose=4 "/Applications/File Mover Express.app" 2>&1 \
  | grep -E "^Identifier=|^TeamIdentifier=|^Authority="
```

Expect the output to include:

- `Identifier=com.amazon.filemoverexpress`
- `TeamIdentifier=94KV3E626L`
- an `Authority=Developer ID Application: …` line ending in `(94KV3E626L)`, followed by Apple's
  `Developer ID Certification Authority` / `Apple Root CA` authorities

The **Team ID `94KV3E626L`** is the decisive check — it identifies Amazon's Apple Developer team
(AMZN Mobile LLC). If it's anything else, the app was not signed by Amazon.

**Windows** — check the Authenticode signer (PowerShell):

```powershell
$sig = Get-AuthenticodeSignature ".\filemoverexpress-windows-amd64-installer.exe"
$sig.Status                         # expect: Valid
$sig.SignerCertificate.Subject      # expect organization O="Amazon Web Services, Inc."
```

Expect `Status: Valid` and a certificate subject whose organization (`O=`) is
**"Amazon Web Services, Inc."**. If the organization is anything else, the installer was not signed
by Amazon.

> Until the production (EV) certificate builds SmartScreen reputation, Windows may still warn even
> for a correctly signed installer — the signer-organization check above is the reliable way to
> confirm authenticity.

---

## Build from source

If you prefer to build from source, see the [Development guide](Development.md).

---

## Uninstall

**1. Stop the daemon** if it's running:

```bash
# macOS / Linux
pkill filemoverexpress

# Windows (PowerShell)
Stop-Process -Name filemoverexpress -ErrorAction SilentlyContinue
```

**2. Remove the application:**

- **macOS**: Delete from Applications
- **Windows**: Use Add/Remove Programs, or delete the installation folder
- **Linux**: Remove the CLI daemon binary (e.g. `sudo rm /usr/local/bin/filemoverexpress`)

**3. Remove configuration and logs** (optional — skip this if you want to keep your transfer profiles):

```bash
# macOS / Linux
rm -rf ~/.filemoverexpress

# Windows (PowerShell)
Remove-Item -Recurse -Force "$env:USERPROFILE\.filemoverexpress"
```

---

## Next Steps

1. [Set up AWS credentials and IAM permissions](Security.md#required-iam-permissions)
2. [Configure File Mover Express](Configuration.md) — add your S3 bucket as a Remote Configuration
3. [Getting Started](Getting-Started.md) — your first transfer
