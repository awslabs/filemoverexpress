# Headless Linux Installation

This guide covers installing File Mover Express as a headless CLI daemon on Linux — no desktop environment required. This is the recommended setup for remote servers, render farms, and cloud instances where you want to run transfers unattended or control them remotely from a GUI on another machine.

## Download

Download the CLI binary for your architecture from the [Releases page](https://github.com/awslabs/filemoverexpress/releases):

| Architecture | File |
|---|---|
| x86_64 (Intel/AMD) | `filemoverexpress-linux-amd64` |
| ARM64 (Graviton, etc.) | `filemoverexpress-linux-arm64` |

## Install

```bash
# Download (replace URL with the latest release)
curl -Lo filemoverexpress https://github.com/awslabs/filemoverexpress/releases/latest/download/filemoverexpress-linux-amd64

# Make executable and move to PATH
chmod +x filemoverexpress
sudo mv filemoverexpress /usr/local/bin/

# Verify
filemoverexpress --version
```

## Configure AWS credentials

File Mover Express uses AWS named profiles for authentication. Install the AWS CLI and configure a profile:

```bash
# Install AWS CLI (if not already present)
# See https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html

# Create a named profile with your credentials
aws configure --profile my-studio
```

You'll be prompted for:
- AWS Access Key ID
- AWS Secret Access Key
- Default region (e.g. `us-west-2`)
- Default output format (press Enter to skip)

## Configure File Mover Express

Create the configuration directory and file:

```bash
mkdir -p ~/.filemoverexpress
```

Create `~/.filemoverexpress/configuration.yaml`:

```yaml
transfer_profiles:
  - name: my-studio
    aws_profile: my-studio
    bucket: your-bucket-name
    region: us-west-2
    remote_configurations:
      - remote_configuration_name: rushes
        s3_destination_folder: incoming/rushes
```

See [Configuration](Configuration.md) for all available options including checksums, bandwidth throttling, and hot folders.

## Run the daemon

### Basic (local only)

Start the daemon for local CLI transfers:

```bash
filemoverexpress daemon
```

### Remote access (connect from GUI on another machine)

To allow the GUI on another machine to connect and control transfers remotely:

**1. Set up a pre-shared key (PSK) for authentication:**

```bash
filemoverexpress crypto encrypt
```

Follow the prompts to encrypt your chosen password. Say yes when asked to save it to the configuration file.

**2. Start with remote access enabled:**

```bash
export FME_PSK_SECRET="your-secret-passphrase"
filemoverexpress daemon --remote
```

See [Remote Daemon Configuration](Configuration.md#remote-daemon-configuration) for full details on TLS and security setup.

## Run as a systemd service

For production use, run the daemon as a systemd service so it starts automatically and restarts on failure.

Create `/etc/systemd/system/filemoverexpress.service`:

```ini
[Unit]
Description=File Mover Express daemon
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=fme
Group=fme
ExecStart=/usr/local/bin/filemoverexpress daemon --remote
Environment=FME_PSK_SECRET=your-secret-passphrase
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

> **Security note:** For production, use a systemd credential or `EnvironmentFile` to store the PSK rather than embedding it directly in the unit file.

Enable and start:

```bash
# Create a dedicated user (optional but recommended)
sudo useradd --system --create-home --shell /usr/sbin/nologin fme

# Copy config to the fme user's home
sudo mkdir -p /home/fme/.filemoverexpress
sudo cp ~/.filemoverexpress/configuration.yaml /home/fme/.filemoverexpress/
sudo chown -R fme:fme /home/fme/.filemoverexpress

# Copy AWS credentials
sudo mkdir -p /home/fme/.aws
sudo cp ~/.aws/credentials /home/fme/.aws/
sudo cp ~/.aws/config /home/fme/.aws/
sudo chown -R fme:fme /home/fme/.aws

# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable filemoverexpress
sudo systemctl start filemoverexpress

# Check status
sudo systemctl status filemoverexpress
sudo journalctl -u filemoverexpress -f
```

## Scripting transfers

Once the daemon is running (or even without it for one-shot transfers), you can script uploads and downloads directly:

```bash
# Upload a directory
filemoverexpress upload my-studio ./camera-rolls/day-01/

# Download from S3
filemoverexpress download my-studio ./local-output/ incoming/rushes/

# Upload with specific remote configuration
filemoverexpress upload my-studio ./footage/ --remote-configuration rushes
```

## Connect from the GUI

On a macOS or Windows machine running the File Mover Express desktop app:

1. Open the **File System** dropdown in the Local browser panel
2. Select **Add Remote Daemon**
3. Enter the hostname/IP and port (default: `50006`) of the Linux server
4. Enter the PSK password you configured

You can now browse the remote server's filesystem and drag-and-drop transfers as if you were sitting at that machine.

## Firewall considerations

If running with remote access, ensure the daemon port is accessible:

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 50006/tcp

# firewalld (RHEL/CentOS)
sudo firewall-cmd --permanent --add-port=50006/tcp
sudo firewall-cmd --reload
```

## Next steps

- [Configuration](Configuration.md) — transfer profiles, hot folders, checksums, throttling
- [Using the CLI](Using-the-CLI.md) — full CLI command reference
- [Security](Security.md) — IAM permissions, TLS, and network security
- [Troubleshooting](Troubleshooting.md) — common issues and solutions
