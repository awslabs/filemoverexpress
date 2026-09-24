# Configuration

File Mover Express can be configured using either the graphical user interface (GUI) or by editing the configuration file directly. This guide covers both methods.

## GUI Configuration

If you use an operating system with a desktop, you can configure File Mover Express through the GUI.

### Adding a Remote Configuration

Before you can transfer files with File Mover Express, you must add a remote configuration.

#### To add a remote configuration using the GUI

1. When you first open the application and do not have a remote configuration set up yet, select **Create a Remote Configuration** on the S3 Bucket file browser window.

2. Enter the following information in the "Add Remote Configuration" section and choose **Add**:

   **Basic Settings:**
   - **Remote Configuration name**: A name for your Remote Configuration. This can be anything, but cannot be changed later.
   - **S3 Bucket**: The name of the S3 bucket that you want to upload to and download from.
   - **AWS Region**: The AWS Region that your S3 bucket is located in.
   - **AWS named profile**: An AWS named profile to use for S3 access. If you choose to use an AWS Access Key or Secret Key instead, you can leave this field blank.

3. Configure the following **Advanced** settings:

   **Storage and Transfer Settings:**
   - **Storage Class**: The storage class to upload to. For more information, see [S3 Storage Classes](https://aws.amazon.com/s3/storage-classes/)
   - **Checksum Algorithm**: Determines which checksum algorithm is used for file integrity verification
   - **Local directory** (optional): The default directory to start browsing on your machine
   - **S3 bucket prefix** (optional): The default S3 directory to start browsing in

   **Filtering Options:**
   - **Filter**: Filter files based on format using valid regular expressions. Example: `^.*\.(mov)$` only uploads files ending in .mov
   - **Max Age**: Defines maximum time period for files. Acceptable units are m, h, d, and w (minutes, hours, days, weeks). Example: "2d" will process files from the last 2 days
   - **File order list** (optional): Type a file extension and press Enter to define transfer priority. Extensions not listed are transferred last.

   **Network and Performance:**
   - **S3 Access Point/VPC Endpoint**: The address of your endpoint (e.g., `vpce-1a2b3c4d-5e6f.s3.us-east-1.vpce.amazonaws.com`)
   - **Transfer autotuning**: Enabled by default, dynamically sets number of threads and chunk size. We recommend keeping it enabled.
     - **Number of threads**: Number of individual threads used to transfer each file
     - **Chunk size**: Size of the chunk (in megabytes) delivered by each thread
   - **Use S3 Transfer Acceleration**: When enabled, transfers will use S3 Transfer Acceleration
   - **Enable metadata filter**: When enabled, automatically filters system metadata files (files starting with `._`, `thumbs.db`, `.DS_Store`)

4. Choose **Save**.

## CLI Configuration

If you aren't using an OS with a desktop, you can configure File Mover Express using the command line interface.

### Editing the Configuration File

#### To edit the configuration file

1. **Open the configuration file** with any text editor:
   - **Windows**: Navigate to `User/<your username>/.filemoverexpress/filemoverexpress.yaml`
   - **macOS**: Press `Cmd+Shift+G`, enter `~/.filemoverexpress`, open `configuration.yaml`
   - **Linux**: Open `~/.filemoverexpress/configuration.yaml`

2. **Define global settings** in the configuration file:
   ```yaml
   general:
     maxActiveChecksums: 8    # Number of checksums processed simultaneously
     maxActiveTransfers: 10   # Number of files processed simultaneously
   ```

3. **Define at least one remote configuration**:
   ```yaml
   protocols:
     s3:
       transferProfiles:
         my-configuration:
           bucket: "my-s3-bucket"
           region: "us-west-2"
           profile: "my-aws-profile"
           storageClass: "standard"
           autoTuning: true
           checksums:
             algorithm: "md5-hex"
   ```

### Configuration Parameters

#### Required Parameters

- **bucket**: S3 bucket name for uploads and downloads
- **region**: AWS Region where your bucket is located
- **profile**: AWS named profile for S3 access

#### Optional Parameters

**Storage Settings:**
- **storageClass**: Storage class for uploads (default: `standard`)
  - Accepted values: `reduced_redundancy`, `standard_ia`, `onezone_ia`, `intelligent_tiering`, `glacier`, `deep_archive`, `glacier_ir`

**Performance Settings:**
- **autoTuning**: Automatically tune chunk size and threads (default: `true`)
- **chunkSize**: Chunk size in MB (not required if autoTuning is true)
- **threads**: Number of threads per file (not required if autoTuning is true)

**File Processing:**
- **checksums.algorithm**: Algorithm for file integrity (default: `md5-hex`)
  - Options: `md5-hex`, `xxhash`, `xxhash64`, `xxh3`
- **maxAge**: Only transfer files within time window (e.g., `2d`, `3500`)
- **fileOrder**: Comma-separated file extensions for transfer priority (e.g., `".mov,.txt"`)
- **filter**: Regular expression for file filtering (e.g., `"^.*\.(mov)$"`)
- **enableMetadataFilter**: Filter system metadata files (default: `false`)

**Network Settings:**
- **accelerated**: Use S3 Transfer Acceleration (default: `false`)

**Path Settings:**
- **paths**:
  - **local**: Default local path for transfers
  - **remote**: Default S3 path for transfers

> **Note:** Configuration keys use camelCase (e.g., `transferProfiles`, `storageClass`, `autoTuning`).
> Snake_case variants like `transfer_profiles` or `storage_class` are **not** recognized and will be silently ignored.

### Hot Folder Configuration

Configure hot folders to automatically upload files when they're added to monitored directories:

```yaml
hotFolders:
  - enabled: true
    localSourceFolder: /Users/user/myhotfolder
    name: my_hot_folder
    remoteConfigurations:
      - remoteConfigurationName: my-configuration
        s3DestinationFolder: my/s3/prefix
```

The optional `forceInitialUpload` key (default `false`) controls the initial/reload sweep: by default it skips files already in S3, so restarting the daemon doesn't re-upload a folder that's already synced. Set it to `true` to re-upload the whole folder on every start/config change. See [Hot Folders](Hot-Folders) for details.

### Remote Daemon Configuration

The remote daemon feature lets you control File Mover Express running on one computer from another computer over a network — useful for managing transfers on a remote workstation or server without needing to be physically present.

When remote access is enabled, all communication is encrypted and protected by a password you choose (called a pre-shared key, or PSK).

#### How it works

1. File Mover Express runs as a daemon on the host machine with remote access turned on
2. You connect to it from another machine using the GUI or CLI
3. The connection is secured with TLS (encrypted) and your PSK (password-protected)

#### Setting up remote access

**Step 1 — Choose a password for your connection**

This is your pre-shared key. Pick something strong — at least 8 characters. You'll need it on both the host machine and any machine connecting to it.

> **Important:** Use alphanumeric characters for both your password and your secret passphrase. Special characters like `$`, `!`, `#`, backticks, and quotes can be interpreted by the shell during interactive input or when setting environment variables, causing encryption/decryption mismatches. If you must use special characters, wrap values in single quotes (e.g., `export FME_PSK_SECRET='my$ecret'`).

**Step 2 — Encrypt your password**

For security, File Mover Express does not store your password in plain text. Run this command on the host machine to encrypt it:

```bash
filemoverexpress crypto encrypt
```

You'll be asked for:
- A secret passphrase — think of this as the master key that locks your password. Keep it safe.
- The password (PSK) you chose in Step 1

The tool will show you an encrypted version of your password and offer to save it to your configuration file automatically. Choose yes.

**Step 3 — Save your secret passphrase as an environment variable**

The daemon needs your secret passphrase available when it starts up so it can unlock your password. Set it like this before starting the daemon:

```bash
# macOS / Linux
export FME_PSK_SECRET="your-secret-passphrase"
filemoverexpress daemon --remote

# Windows (PowerShell)
$env:FME_PSK_SECRET="your-secret-passphrase"
filemoverexpress daemon --remote
```

> The daemon will refuse to start if `FME_PSK_SECRET` is not set.

**Step 4 — Set up TLS certificates**

TLS certificates encrypt the connection between machines. Remote access requires TLS to be enabled. See the [Security guide](Security.md) for instructions on setting up certificates.

#### Configuration reference

```yaml
apiServer:
  enabled: true
  remote:
    enabled: true                  # Turn on remote access
    key: "<encrypted-psk>"         # Paste the encrypted value from Step 2
    ports: [50006]                 # Port(s) to listen on (must be an array)
    address: "0.0.0.0"             # Listen on all network interfaces
  tls:
    enabled: true                  # Required for remote access
    certificateFile: "/path/to/cert.pem"
    keyFile: "/path/to/key.pem"
  blockedPaths:                    # Folders the remote user cannot access
    - ".aws"
    - ".ssh"
  allowedOrigins:                  # Origins allowed to connect (for CORS)
    - "http://localhost:4200"      # Required if using ng serve for GUI development
  permissions:
    allowUIConfiguration: false    # Allow remote user to change settings
    allowLocalRenameDelete: false  # Allow remote user to rename/delete local files
    allowRemoteRenameDelete: false # Allow remote user to rename/delete S3 files
```

#### If you need to recover your password

To decrypt and view an encrypted PSK value:

```bash
filemoverexpress crypto decrypt
```

#### Tips

- Use alphanumeric characters for your secret passphrase and PSK to avoid shell interpolation issues
- Keep your secret passphrase somewhere safe — if you lose it, you'll need to re-encrypt your PSK
- Never share your secret passphrase or commit it to version control
- The `key` field in the config must contain the **encrypted output** from `crypto encrypt`, not your raw password
- The `blocked_paths` list is a good way to prevent remote users from accessing sensitive folders on the host machine

#### Connecting from the GUI

Once the remote daemon is running, connect to it from the File Mover Express desktop app on another machine.

**Step 1 — Trust the daemon's TLS certificate on your local machine**

The GUI uses HTTPS to connect to the remote daemon. If the daemon uses a self-signed certificate (common for internal servers), your local machine must trust it or the connection will fail silently.

Copy the certificate from the daemon machine to your local machine, then:

**macOS:**
```bash
# Copy cert from remote (e.g., via scp)
scp user@remote-host:/etc/fme/cert.pem ~/Desktop/fme-cert.pem

# Add to Keychain and trust it
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain ~/Desktop/fme-cert.pem
```

Alternatively, double-click the `.pem` file to open it in Keychain Access, then right-click → Get Info → Trust → set "When using this certificate" to **Always Trust**.

**Windows:**
1. Rename the `.pem` file to `.crt`
2. Double-click it → Install Certificate → Local Machine → Place in "Trusted Root Certification Authorities"

> If you skip this step, the GUI will show "An unexpected connection error occurred" with no further details.

**Step 2 — Add the daemon in the GUI**

1. Open File Mover Express on your local machine
2. Click the daemon selector dropdown (top-left, shows "Local" by default)
3. Click **Add Daemon**
4. Fill in the fields:
   - **Name**: A label for this connection (e.g., "Render Farm", "EC2 Server")
   - **Host**: The IP address or hostname of the remote machine
   - **Port**: The port the daemon is listening on (default: `50006`)
   - **Key**: Your **plaintext pre-shared key** — the raw password you chose in Step 1 of the daemon setup (NOT the encrypted value from the config file)
5. **Use encryption (TLS)** will be enabled automatically (required for remote daemons)
6. Click **Save**

**Step 3 — Connect**

Select the new daemon from the dropdown. The GUI will connect and you'll see the remote machine's local filesystem on the left and S3 on the right, just like a local session.

#### Troubleshooting remote connections

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| "An unexpected connection error occurred" | TLS certificate not trusted locally | Install the daemon's cert on your machine (see Step 1 above) |
| "An unexpected connection error occurred" | Firewall blocking the port | Open port 50006 (or your configured port) in the security group / firewall |
| "No Active Session" after clicking Connect | Wrong host, port, or daemon not running | Verify the daemon is running on the remote machine (`ps aux \| grep filemoverexpress`) |
| Connection drops intermittently | Network timeout or unstable connection | Check network path; consider a stable VPN or direct connection |
| "Authentication failed" | Wrong pre-shared key | Enter the **plaintext** password, not the encrypted value from the config |

## Validating Configuration

After configuring File Mover Express, validate your setup:

```bash
filemoverexpress validate-credentials [remote-configuration-name]
```

This command:
- Checks your AWS credentials
- Verifies File Mover Express can connect to Amazon S3
- Lists objects in the specified bucket

## Configuration File Location

The configuration file is located at:
- **Windows**: `C:\Users\username\.filemoverexpress\configuration.yaml`
- **macOS/Linux**: `~/.filemoverexpress/configuration.yaml`

You can override the default location using the `filemoverexpress_CONFIG_DIR` environment variable.

## Next Steps

After configuration:
- [Getting Started](Getting-Started) - Learn basic usage
- [Using the GUI](Using-the-GUI) - Explore the graphical interface
- [Using the CLI](Using-the-CLI) - Learn command-line operations