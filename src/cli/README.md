# File Mover Express CLI

[![Go Version](https://img.shields.io/badge/Go-1.25+-blue.svg)](https://golang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

The CLI component is the core backend daemon of File Mover Express, written in Go. It provides high-performance file
transfer capabilities, job management, and gRPC services for communication with the GUI application.

## Overview

The CLI daemon handles all file transfer operations between local systems and Amazon S3, including:

- **File Discovery**: Scanning local directories and S3 prefixes for transfer operations
- **Transfer Management**: Upload and download operations with multipart support
- **Job Queue**: Priority-based job scheduling with pause/resume/cancel capabilities
- **Checksumming**: Multiple algorithms (MD5, XXHash, XXH3) with MHL format support
- **Hot Folders**: Automated monitoring and upload of new files
- **gRPC Service**: Backend API for GUI communication
- **S3 Operations**: List, delete, rename, and inventory generation

## Architecture

```
src/cli/
├── cmd/                        # Cobra command definitions
│   ├── root.go                 # Root command and global flags
│   ├── daemon.go               # Daemon service command
│   ├── s3.go                   # S3 operations command
│   └── s3_inventory.go         # S3 inventory generation
├── core/                       # Core transfer logic
│   ├── checksums/              # Checksum algorithms and management
│   ├── discovery/              # File and S3 object discovery
│   ├── download/               # Download operations
│   ├── upload/                 # Upload operations and hot folders
│   ├── filters/                # Path filtering and metadata filters
│   ├── job_manager/            # Job queue and worker management
│   ├── transfer-api/           # S3 client wrapper and operations
│   └── sorting/                # File sorting strategies
├── service/                    # gRPC service implementations
├── types/                      # Type definitions by domain
├── config/                     # Configuration management
├── events/                     # Event bus for internal messaging
├── logger/                     # Structured logging
├── utils/                      # Utility functions
└── e2e-tests/                  # End-to-end integration tests
```

## Prerequisites

- **Go** 1.25 or higher
- **golangci-lint** - Go linter ([installation guide](https://golangci-lint.run/usage/install/))
- **Protocol Buffers** - For generating gRPC code (installed via npm in root)
- **AWS Credentials** - Configured via `aws configure` or environment variables

## Building

### Quick Build

From the repository root:

```bash
# Build for current platform
npm run --prefix src/cli build

# Build for all platforms
npm run --prefix src/cli build:all

# Build for specific platforms
npm run --prefix src/cli build:mac      # macOS (Intel x64 and Apple Silicon ARM64)
npm run --prefix src/cli build:linux    # Linux (x64 and ARM64)
npm run --prefix src/cli build:win      # Windows (x64)
```

### Manual Build

From the `src/cli` directory:

```bash
npm run build:cli
```

Built binaries are placed in the `dist/` directory.

## Testing

### Unit Tests

```bash
# Run all tests
npm run --prefix src/cli test

# Run tests with coverage
go test ./... -coverprofile=coverage.txt

# Run tests for specific package
go test ./core/checksums/...

# Run tests with verbose output
go test -v ./...
```

### End-to-End Tests

E2E tests require AWS credentials and an S3 bucket:

```bash
# Set up test configuration
export AWS_REGION=us-west-2
export TEST_BUCKET=your-test-bucket

# Run e2e tests
npm run --prefix src/cli test:e2e

# Or manually
go test ./e2e-tests/... -v
```

## Linting

```bash
# Run linter from repository root
npm run lint:cli

# Or manually from src/cli directory
golangci-lint run

# Auto-fix issues where possible
golangci-lint run --fix
```

Linter configuration is in `.golangci.yml`.

## Usage

### Starting the Daemon

```bash
# Start daemon with default configuration
./dist/filemoverexpress daemon

# Start with custom configuration file
./dist/filemoverexpress daemon --config /path/to/config.yaml

# Start with custom port
./dist/filemoverexpress daemon --port 50051
```

### S3 Operations

```bash
# Upload files to S3
./dist/filemoverexpress s3 upload /local/path s3://bucket/prefix

# Download files from S3
./dist/filemoverexpress s3 download s3://bucket/prefix /local/path

# Generate S3 inventory report
./dist/filemoverexpress s3 inventory s3://bucket/prefix --output report.csv
```

### Configuration

The CLI uses a YAML configuration file (default: `~/.filemoverexpress/config.yaml`):

```yaml
# AWS Configuration
aws:
  region: us-west-2
  profile: default

# Transfer Settings
transfer:
  concurrency: 10
  part_size: 10485760  # 10MB
  checksum_algorithm: xxh3

# Hot Folder Settings
hot_folders:
  - local_path: /path/to/watch
    s3_prefix: s3://bucket/uploads
    enabled: true
```

For detailed configuration options, see the [Configuration Guide](../../docs/Configuration.md).

## Development

### Project Structure

- **cmd/**: Command-line interface definitions using Cobra
- **core/**: Core business logic for transfers, checksums, and job management
- **service/**: gRPC service implementations for GUI communication
- **types/**: Type definitions organized by domain (checksums, jobs, events, etc.)
- **config/**: Configuration file parsing and management
- **events/**: Event bus for internal component communication
- **logger/**: Structured logging with configurable levels
- **utils/**: Shared utility functions (filesystem, S3 paths, MHL)

### Adding New Features

1. Define types in appropriate `types/` subdirectory
2. Implement core logic in `core/` packages
3. Add service methods in `service/` if GUI access is needed
4. Update protobuf definitions in `../protobuf/` if adding new APIs
5. Add tests alongside implementation files (`*_test.go`)
6. Update documentation

### Code Style

- Follow standard Go conventions and idioms
- Use `gofmt` for formatting (enforced by linter)
- Write tests for new functionality
- Document exported functions and types
- Keep packages focused and cohesive

## Performance Optimization

The CLI includes several performance optimizations:

- **Auto-tuning**: Automatically adjusts concurrency based on file sizes
- **Multipart Uploads**: Parallel chunk uploads for large files
- **Connection Pooling**: Reuses HTTP connections to S3
- **Memory Management**: Streaming operations to minimize memory usage
- **Fast Checksums**: XXH3 algorithm for high-speed verification

## Troubleshooting

### Common Issues

**Build Failures**

```bash
# Clean and rebuild
rm -rf dist/
go clean -cache
go mod download
go build
```

**Test Failures**

```bash
# Ensure AWS credentials are configured
aws configure

# Check test bucket access
aws s3 ls s3://your-test-bucket/
```

**Linter Errors**

```bash
# Update golangci-lint
brew upgrade golangci-lint  # macOS
# or follow official installation guide

# Run with verbose output
golangci-lint run -v
```

For more troubleshooting information, see the [Troubleshooting Guide](../../docs/Troubleshooting.md).

## Contributing

Contributions to the CLI component are welcome. Please:

1. Write tests for new functionality
2. Ensure all tests pass: `go test ./...`
3. Run linter: `golangci-lint run`
4. Follow Go best practices and project conventions
5. Update documentation as needed

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for general contribution guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.
