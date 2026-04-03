# File Mover Express Protocol Buffers

[![Protocol Buffers](https://img.shields.io/badge/Protobuf-3.0+-blue.svg)](https://developers.google.com/protocol-buffers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This directory contains Protocol Buffer (protobuf) definitions that define the communication interface between the CLI daemon and GUI application. These definitions are used to generate type-safe client and server code for both Go and TypeScript.

## Overview

The protobuf definitions provide:

- **Type-Safe Communication**: Strongly-typed messages for CLI-GUI communication
- **Cross-Language Support**: Generate code for Go (CLI) and TypeScript (GUI)
- **Versioned API**: Structured API definitions with backward compatibility
- **gRPC Services**: RPC service definitions for remote procedure calls
- **Event System**: Event message definitions for real-time updates

## Architecture

```
src/protobuf/
├── buf.yaml                    # Buf configuration
├── buf.gen.yaml                # Code generation configuration
├── config.proto                # Configuration messages
├── events.proto                # Event system messages
├── inventory.proto             # S3 inventory messages
├── job.proto                   # Job management messages
├── metadata.proto              # File metadata messages
├── progress.proto              # Transfer progress messages
├── remote_daemon.proto         # Daemon service definitions
├── s3.proto                    # S3 operation messages
├── shared.proto                # Shared types and enums
└── supportfile.proto           # Support file messages
```

## Prerequisites

- **Node.js** 22 or higher (for buf via npm)
- **Protocol Buffer Compiler** (installed via npm dependencies)
- **Buf CLI** (installed automatically with npm dependencies)

## Generating Code

### Quick Generation

From the repository root:

```bash
# Generate code for both CLI and GUI
npm run proto:generate
```


### Manual Generation

From the `src/protobuf` directory:

```bash
# Generate using buf
buf generate

# Generate with specific output directory
buf generate --output ../cli/types/pbtypes
```

Generated code locations:
- **Go**: `../cli/types/pbtypes/`
- **TypeScript**: `../gui/src/connect/`

## Protocol Buffer Files

### Service Definitions

**remote_daemon.proto**
- Main gRPC service interface
- RPC methods for job management, file operations, configuration
- Bidirectional streaming for events

**progress.proto**
- Progress reporting service
- Real-time transfer progress updates
- Job status notifications

### Message Definitions

**job.proto**
- Job creation and management messages
- Job status and metadata
- Task definitions and progress

**config.proto**
- Configuration messages
- Settings for transfers, checksums, hot folders
- AWS credentials and region settings

**s3.proto**
- S3 operation messages
- List, upload, download, delete operations
- Bucket and prefix management

**events.proto**
- Event system messages
- Job events, progress events, error events
- System notifications

**metadata.proto**
- File and object metadata
- Timestamps, sizes, permissions
- Checksum information

**inventory.proto**
- S3 inventory report messages
- Inventory generation requests
- Report output formats

**shared.proto**
- Common types and enums
- Status codes, error types
- Shared data structures

**supportfile.proto**
- Support file generation messages
- System diagnostics and logs
- Debug information

## Message Examples

### Job Creation

```protobuf
message CreateJobRequest {
  string source_path = 1;
  string destination_path = 2;
  JobType job_type = 3;
  JobOptions options = 4;
}

message CreateJobResponse {
  string job_id = 1;
  JobStatus status = 2;
}
```

### Progress Updates

```protobuf
message ProgressEvent {
  string job_id = 1;
  int64 bytes_transferred = 2;
  int64 total_bytes = 3;
  double transfer_rate = 4;
  int64 eta_seconds = 5;
}
```

### Configuration

```protobuf
message Configuration {
  AWSConfig aws = 1;
  TransferConfig transfer = 2;
  ChecksumConfig checksum = 3;
  repeated HotFolderConfig hot_folders = 4;
}
```

## Code Generation Configuration

### buf.yaml

Defines the protobuf module and dependencies:

```yaml
version: v1
name: buf.build/awslabs/filemoverexpress
deps:
  - buf.build/googleapis/googleapis
```

### buf.gen.yaml

Configures code generation for each language:

```yaml
version: v1
plugins:
  # Go generation
  - plugin: go
    out: ../cli/types/pbtypes
    opt:
      - paths=source_relative
  
  # Go gRPC generation
  - plugin: go-grpc
    out: ../cli/types/pbtypes
    opt:
      - paths=source_relative
  
  # TypeScript generation
  - plugin: es
    out: ../gui/src/connect
    opt:
      - target=ts
  
  # TypeScript Connect generation
  - plugin: connect-es
    out: ../gui/src/connect
    opt:
      - target=ts
```

## Development Workflow

### Adding New Messages

1. Create or modify `.proto` file
2. Define message structure with field numbers
3. Add documentation comments
4. Generate code: `npm run proto:generate`
5. Update CLI and GUI code to use new messages
6. Test changes in both components

### Modifying Existing Messages

**Important**: Maintain backward compatibility

- Don't change field numbers
- Don't remove required fields
- Use `reserved` for deprecated fields
- Add new fields with new numbers

Example:

```protobuf
message JobOptions {
  int32 concurrency = 1;
  int64 part_size = 2;
  string checksum_algorithm = 3;
  
  // New field added in v1.1
  bool enable_compression = 4;
  
  // Deprecated field
  reserved 5;
  reserved "old_field_name";
}
```

### Versioning

Follow semantic versioning for API changes:

- **Major**: Breaking changes (field removal, type changes)
- **Minor**: New fields or messages (backward compatible)
- **Patch**: Documentation or comment updates

## Best Practices

### Message Design

- Use clear, descriptive field names
- Group related fields into nested messages
- Use enums for fixed sets of values
- Include documentation comments
- Keep messages focused and cohesive

### Field Numbering

- Reserve 1-15 for frequently used fields (1-byte encoding)
- Use 16+ for less common fields
- Never reuse field numbers
- Use `reserved` for removed fields

### Documentation

- Add comments for all messages and fields
- Explain enum values
- Document service methods
- Include usage examples

### Performance

- Use appropriate field types (int32 vs int64)
- Consider message size for large transfers
- Use streaming for large datasets
- Batch related operations

## Troubleshooting

### Common Issues

**Generation Failures**
```bash
# Clear generated code and regenerate
rm -rf ../cli/types/pbtypes/*
rm -rf ../gui/src/connect/*
npm run proto:generate
```

**Buf Not Found**
```bash
# Reinstall dependencies
npm install
```

**Type Errors After Generation**
```bash
# Ensure both CLI and GUI are updated
cd ../cli
go mod tidy

cd ../gui
npm install
```

**Breaking Changes**
```bash
# Use buf breaking to detect changes
buf breaking --against '.git#branch=main'
```

For more troubleshooting information, see the [Troubleshooting Guide](../../docs/Troubleshooting.md).

## Tools

### Buf CLI

Buf is a modern protobuf tool that provides:

- **Linting**: Enforce style and best practices
- **Breaking Change Detection**: Prevent API breakage
- **Code Generation**: Simplified plugin management
- **Dependency Management**: Handle protobuf dependencies

Common commands:

```bash
# Lint proto files
buf lint

# Check for breaking changes
buf breaking --against '.git#branch=main'

# Generate code
buf generate

# Format proto files
buf format -w
```

### Protocol Buffer Compiler

Direct protoc usage (if needed):

```bash
# Generate Go code
protoc --go_out=../cli/types/pbtypes \
       --go-grpc_out=../cli/types/pbtypes \
       *.proto

# Generate TypeScript code
protoc --es_out=../gui/src/connect \
       --connect-es_out=../gui/src/connect \
       *.proto
```

## Contributing

Contributions to the protobuf definitions are welcome. Please:

1. Follow protobuf style guide
2. Maintain backward compatibility
3. Add documentation comments
4. Test generated code in both CLI and GUI
5. Run `buf lint` before committing
6. Check for breaking changes with `buf breaking`

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for general contribution guidelines.

## Resources

- [Protocol Buffers Documentation](https://developers.google.com/protocol-buffers)
- [Buf Documentation](https://docs.buf.build/)
- [gRPC Documentation](https://grpc.io/docs/)
- [Connect Protocol](https://connect.build/)

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.
