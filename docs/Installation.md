# Installation

## Download

Download the latest installer for your platform from the [Releases page](https://github.com/awslabs/filemoverexpress/releases).

| Platform | File |
|----------|------|
| macOS (Apple Silicon) | `File Mover Express-darwin-arm64.dmg` |
| macOS (Intel) | `File Mover Express-darwin-amd64.dmg` |
| Windows | `File Mover Express-win32-x64-setup.exe` |
| Linux | `File Mover Express-linux-x64.AppImage` |

> **Note:** Installers are currently self-signed or unsigned (may depend on platform). macOS will show a Gatekeeper warning — right-click the app and choose Open to bypass it. Windows will show a SmartScreen warning — click "More info" then "Run anyway".

---

## Install

**macOS**

1. Open the `.dmg` and drag File Mover Express to Applications.

2. **Before launching for the first time**, open Terminal and run:

   ```bash
   sudo xattr -rd com.apple.quarantine /Applications/File\ Mover\ Express.app
   ```

   This removes the quarantine flag that macOS applies to unsigned apps downloaded from the internet.

   > **Why is this needed?** The installers are not yet code-signed or notarized with Apple. macOS Gatekeeper will report the app as "damaged" and refuse to open it. The app is not actually damaged — it's quarantined. The command above removes that restriction. This is a known issue ([#41](https://github.com/awslabs/filemoverexpress/issues/41)) and will be resolved when code signing is added to the release pipeline.

3. Launch File Mover Express from Applications as normal.
   
**Windows**

Run the installer and follow the prompts. Windows SmartScreen may show a warning — click "More info" then "Run anyway".

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
