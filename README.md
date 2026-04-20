# File Mover Express for AWS

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Go Version](https://img.shields.io/badge/Go-1.24+-blue.svg)](https://golang.org/)
[![Node Version](https://img.shields.io/badge/Node-22+-green.svg)](https://nodejs.org/)

File Mover Express is a high-performance file transfer application designed to accelerate media asset workflows between local systems and Amazon S3. Unlike traditional transfer clients that tie transfers to your desktop session, File Mover Express runs a daemon-based transfer engine that can live on any machine — your workstation, a server in the data center, or an EC2 instance — while you control it from the GUI or CLI over an encrypted connection. Built for digital imaging technicians and content creators, it provides both command-line and graphical interfaces for efficient, reliable file transfers.

## Key Features

- **High-Performance Transfers**: Auto-tuned parallel processing using native S3 APIs — your files go directly to S3 with no intermediary servers
- **Multipart Upload Optimization**: Large files are automatically split into chunks and uploaded in parallel, with configurable retry on failures and the ability to pause and resume active transfers
- **Drag & Drop GUI**: A simple graphical interface — drag files in, choose your S3 destination, and go
- **Command-Line Interface**: Full CLI for scripting, automation, and headless environments
- **Hot Folders**: Point File Mover Express at a folder and it will automatically upload anything new that appears in it
- **Secure**: All transfers use HTTPS, and AWS IAM controls who can access your S3 buckets
- **Remote Daemon**: Run File Mover Express on one machine and control it from another over an encrypted connection, protected by a password you set
- **Checksumming & MHL Support**: Optional file integrity verification, with XXH3 being the fastest option. XXHash, XXHash64 and MD5 are available for workflows that require them. Reads MHL files for camera-to-cloud verification workflows.
- **Cross-Platform**: Works on macOS, Windows, and Linux
- **Multi-Region**: Works with any AWS region where S3 is available

## Quick Start

### Step 1 — Install File Mover Express

**Download a pre-built installer** from the [Releases page](https://github.com/awslabs/filemoverexpress/releases) and double-click to install.

> **Note:** Installers are currently self-signed or unsigned (may depend on platform). macOS will show a Gatekeeper warning — right-click the app and choose Open to bypass it. Windows will show a SmartScreen warning — click "More info" then "Run anyway".

Prefer to build from source? See [Building from Source](docs/Installation.md).

---

### Step 2 — Set up AWS

Before you can transfer files, you need an S3 bucket and AWS credentials.

1. **Create an S3 bucket** if you don't have one — see the [Amazon S3 User Guide](https://docs.aws.amazon.com/AmazonS3/latest/userguide/creating-bucket.html)
2. **Set up IAM permissions** — see the [required IAM permissions](docs/Security.md#required-iam-permissions) for the minimum policy
3. **Configure your credentials** by opening Terminal (macOS/Linux) or CMD (Windows):

```bash
aws configure
```

You'll be prompted for your AWS Access Key ID, Secret Access Key, and default region.

> Don't have the AWS CLI? [Install it here](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).

---

### Step 3 — Configure File Mover Express

Launch File Mover Express and add a Remote Configuration pointing to your S3 bucket. See the [Configuration Guide](docs/Configuration.md) for full details.

---

### Step 4 — Start transferring

- Using the GUI? See the [GUI Guide](docs/Using-the-GUI.md)
- Prefer the CLI? See the [CLI Guide](docs/Using-the-CLI.md)
- New to the app? See [Getting Started](docs/Getting-Started.md) for your first transfer

## Documentation

- [Getting Started](docs/Getting-Started.md) — Quick start guide and basic usage
- [Configuration](docs/Configuration.md) — Setup and configuration options
- [Using the GUI](docs/Using-the-GUI.md) — Graphical interface guide
- [Using the CLI](docs/Using-the-CLI.md) — Command-line usage and scripting
- [Best Practices](docs/Best-Practices.md) — Performance optimization and security
- [Troubleshooting](docs/Troubleshooting.md) — Common issues and solutions
- [Development](docs/Development.md) — Building from source, architecture, and contributing

## Security

Please review the [Security Policy](SECURITY.md) for vulnerability reporting and security best practices.

For the IAM permissions required by File Mover Express, see the [Security guide](docs/Security.md).

## Contributing

We welcome contributions. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines and see [Development](docs/Development.md) for setting up your environment.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Support

- **Bug Reports**: [GitHub Issues](https://github.com/awslabs/filemoverexpress/issues)
- **Feature Requests**: [GitHub Issues](https://github.com/awslabs/filemoverexpress/issues)
- **Questions**: [GitHub Discussions](https://github.com/awslabs/filemoverexpress/discussions)
