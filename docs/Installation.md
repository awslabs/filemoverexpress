# Installation

## Download

Download the latest installer for your platform from the [Releases page](https://github.com/awslabs/filemoverexpress/releases).

| Platform | File |
|----------|------|
| macOS (Apple Silicon) | `File Mover Express-darwin-arm64.dmg` |
| macOS (Intel) | `File Mover Express-darwin-amd64.dmg` |
| Windows | `File Mover Express-win32-x64-setup.exe` |
| Linux | `File Mover Express-linux-x64.AppImage` |

> **Note on code signing:** macOS `.dmg` releases are signed with an Apple Developer ID
> certificate and **notarized** by Apple, so they install and launch without a Gatekeeper
> workaround. Windows installers are **Authenticode-signed** via AWS Code Signer; SmartScreen may
> still show a warning until the signing certificate builds reputation — click "More info" then
> "Run anyway" if so. Linux artifacts are unsigned. For how signing works in the release
> pipeline, see the [Code Signing Runbook](Signing-Runbook.md).

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

**Linux** — make the AppImage executable and run it:
```bash
chmod +x "File Mover Express-linux-x64.AppImage"
./"File Mover Express-linux-x64.AppImage"
```

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
- **Linux**: Delete the AppImage file

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
