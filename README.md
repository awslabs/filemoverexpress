# File Mover Express for AWS

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Go Version](https://img.shields.io/badge/Go-1.25+-blue.svg)](https://golang.org/)
[![Node Version](https://img.shields.io/badge/Node-22+-green.svg)](https://nodejs.org/)

File Mover Express is a high-performance file transfer application designed to accelerate media asset workflows between local systems and Amazon S3. Built for digital imaging technicians and content creators, it provides both command-line and graphical interfaces for efficient, reliable file transfers.

## Key Features

- **High-Performance Transfers**: Auto-tuned parallel processing for optimal throughput
- **Multipart Upload Optimization**: Large files are automatically split into chunks and uploaded in parallel, with built-in retry and resume so interrupted transfers pick up where they left off
- **Drag & Drop GUI**: A simple graphical interface — drag files in, choose your S3 destination, and go
- **Command-Line Interface**: Full CLI for scripting, automation, and headless environments
- **Hot Folders**: Point File Mover Express at a folder and it will automatically upload anything new that appears in it
- **Secure**: All transfers use HTTPS, and AWS IAM controls who can access your S3 buckets
- **Remote Daemon**: Run File Mover Express on one machine and control it from another over an encrypted connection, protected by a password you set
- **Checksumming & MHL Support**: Optional file integrity verification. XXH3 and xxHash64 are the fastest options — significantly quicker than MD5 or SHA. MD5, SHA1, and SHA256 are available for workflows that require them. Reads MHL files for camera-to-cloud verification workflows.
- **Cross-Platform**: Works on macOS, Windows, and Linux
- **Multi-Region**: Works with any AWS region where S3 is available

## Quick Start

**Prerequisites:** Go 1.24+, Node.js 22+, Git, golangci-lint

```bash
# 1. Clone and install
git clone https://github.com/awslabs/filemoverexpress.git
cd filemoverexpress
npm install

# 2. Generate protobuf code (installs missing Go plugins automatically)
npm run proto

# 3. Build the CLI
npm run build:cli

# 4. Build the GUI and package the desktop app
npm run build:gui
npm run package

# 5. Configure AWS credentials
aws configure
```

The packaged desktop app will be in `dist/` — for example `dist/File Mover Express-darwin-arm64/` on Apple Silicon.

**macOS** — optionally move to Applications:
```bash
cp -r "dist/File Mover Express-darwin-arm64/File Mover Express.app" /Applications/
```

**Windows** — optionally move to Program Files:
```powershell
Move-Item "dist\File Mover Express-win32-x64" "C:\Program Files\File Mover Express"
```

**Next steps:**
- Using the GUI? See the [GUI Guide](docs/Using-the-GUI.md)
- Prefer the CLI? See the [CLI Guide](docs/Using-the-CLI.md)
- Full installation details and troubleshooting: [Installation Guide](docs/Installation.md)

## Documentation

Comprehensive documentation is available in the [GitHub Wiki](https://github.com/awslabs/filemoverexpress/wiki):

- [Getting Started](https://github.com/awslabs/filemoverexpress/wiki/Getting-Started) - Quick start guide and basic usage
- [Installation](https://github.com/awslabs/filemoverexpress/wiki/Installation) - Detailed installation instructions for all platforms
- [Configuration](https://github.com/awslabs/filemoverexpress/wiki/Configuration) - Setup and configuration options
- [Using the GUI](https://github.com/awslabs/filemoverexpress/wiki/Using-the-GUI) - Graphical interface guide
- [Using the CLI](https://github.com/awslabs/filemoverexpress/wiki/Using-the-CLI) - Command-line usage and scripting
- [Best Practices](https://github.com/awslabs/filemoverexpress/wiki/Best-Practices) - Performance optimization and security recommendations
- [Troubleshooting](https://github.com/awslabs/filemoverexpress/wiki/Troubleshooting) - Common issues and solutions

## Architecture

File Mover Express consists of several components:

```
filemoverexpress/
├── src/
│   ├── cli/                    # Go CLI daemon and backend services
│   ├── gui/                    # Angular GUI application
│   ├── electron/               # Electron wrapper for desktop deployment
│   ├── protobuf/               # Protocol buffer definitions for communication
│   ├── installers/             # Platform-specific installer packages
│   └── userguide/              # Sphinx-based documentation source
├── tools/                      # Build and deployment automation scripts
├── CONTRIBUTING.md             # Guidelines for contributing to the project
├── SECURITY.md                 # Security policy and vulnerability reporting
└── README.md                   # Project overview and setup instructions
```

## Development

### Building from Source

**Prerequisites**: Go 1.24+, Node.js 22+, Angular CLI, golangci-lint

```bash
# Install dependencies
npm install

# Generate protobuf code
npm run proto

# Build for all supported platforms
npm run build:all

# Build CLI for specific platforms
npm run build:cli           # All CLI platforms
npm run --prefix src/cli build:mac      # macOS (Intel x64 and Apple Silicon ARM64)
npm run --prefix src/cli build:linux    # Linux (x64 and ARM64)
npm run --prefix src/cli build:windows  # Windows (x64)

# Build GUI
npm run build:gui           # Production GUI build

# Run tests
npm run test:all            # Run all tests
npm run test:cli            # Run CLI tests only
npm run test:gui            # Run GUI tests only

# Run linting
npm run lint:all            # Lint all code
npm run lint:cli            # Lint CLI code only
npm run lint:gui            # Lint GUI code only

# Clean build artifacts
npm run clean:all           # Clean all build artifacts
npm run clean:cli           # Clean CLI artifacts only
npm run clean:gui           # Clean GUI artifacts only
```

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run proto` | Generate protobuf code for CLI and GUI |
| `npm run build:all` | Build both CLI and GUI components |
| `npm run build:cli` | Build CLI for all platforms (macOS, Linux, Windows) |
| `npm run build:gui` | Build GUI production bundle |
| `npm run test:all` | Run all tests (CLI and GUI) |
| `npm run test:cli` | Run CLI unit and integration tests |
| `npm run test:gui` | Run GUI unit tests via Karma |
| `npm run lint:all` | Lint all code (CLI and GUI) |
| `npm run lint:cli` | Run golangci-lint on Go code |
| `npm run lint:gui` | Run ESLint on TypeScript/Angular code |
| `npm run clean:all` | Remove all build artifacts |
| `npm run clean:cli` | Remove CLI build artifacts |
| `npm run clean:gui` | Remove GUI build artifacts |
| `npm run userguide` | Build user guide documentation |

### Environment Variables

You can customize builds using environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `VERSION` | Override version number | Value from package.json |
| `PRODUCT_NAME` | Override product name | `filemoverexpress` |
| `BUILD_MODE` | Set to `dev` for development builds | `release` |

**Examples:**

```bash
# Build with custom version
VERSION=2.0.0 npm run build:cli

# Build with custom product name
PRODUCT_NAME=myapp npm run build:cli

# Build in development mode (includes debug symbols, adds "dev" suffix)
BUILD_MODE=dev npm run --prefix src/cli build:mac
```

### Platform-Specific Builds

Build CLI binaries for specific platforms:

```bash
# macOS only (both Intel x64 and Apple Silicon ARM64)
npm run --prefix src/cli build:mac

# Linux only (both x64 and ARM64)
npm run --prefix src/cli build:linux

# Windows only (x64)
npm run --prefix src/cli build:windows

# All platforms in parallel
npm run --prefix src/cli build:all
```

Built binaries are placed in `src/cli/dist/` with platform-specific naming:
- macOS: `filemoverexpress-darwin-amd64`, `filemoverexpress-darwin-arm64`
- Linux: `filemoverexpress-linux-amd64`, `filemoverexpress-linux-arm64`
- Windows: `filemoverexpress-windows-amd64.exe`

### Development Workflow

1. Fork the repository
2. Create a feature branch following the naming convention: `type/description`
3. Make changes and ensure all tests pass
4. Follow the guidelines in [CONTRIBUTING.md](CONTRIBUTING.md)
5. Submit a pull request with a clear description of changes

## Security

Security is a top priority for this project. Please review the [Security Policy](SECURITY.md) for information on:

- Vulnerability reporting process
- Security best practices
- Supported versions and security updates

**Important**: Do not report security vulnerabilities through public GitHub issues. Follow the responsible disclosure process outlined in the security policy.

## Contributing

We welcome contributions from the community. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on:

- Code of conduct and community guidelines
- Development process and coding standards
- Pull request submission process
- Testing requirements

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

File Mover Express is maintained by AWS Labs on a best-effort basis. For support and assistance:

- **Documentation**: Consult the [GitHub Wiki](https://github.com/awslabs/filemoverexpress/wiki) for comprehensive guides
- **Bug Reports**: Submit issues via [GitHub Issues](https://github.com/awslabs/filemoverexpress/issues)
- **Feature Requests**: Use [GitHub Issues](https://github.com/awslabs/filemoverexpress/issues) with appropriate labels
- **Questions**: Ask questions in [GitHub Discussions](https://github.com/awslabs/filemoverexpress/discussions)

## Project Status

- **Current Version**: 1.0.x
- **Development Status**: Active
- **Platform Support**: macOS (Intel x64 and Apple Silicon ARM64), Windows (x64), Linux (x64 and ARM64)
- **AWS Region Support**: All regions where Amazon S3 is available

File Mover Express accelerates media workflows by providing reliable, high-performance file transfers between local systems and Amazon S3.
