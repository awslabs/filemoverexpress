# Using the CLI

The File Mover Express command-line interface provides powerful scripting capabilities and advanced control over file transfers.

## Basic Commands

### Starting the Daemon

The daemon must be running for GUI connectivity:

```bash
filemoverexpress daemon
```

**Options:**
- `--remote`: Start as remote daemon for multi-user access
- `--address=<address>`: Specify listening address
- `--ports=<ports>`: Specify listening ports

### Uploading Files

Upload files from your local system to Amazon S3:

```bash
filemoverexpress upload [remote-configuration] [paths...]
```

**Examples:**
```bash
# Upload a single file
filemoverexpress upload my-config ./video.mp4

# Upload a directory
filemoverexpress upload my-config ./project-files/

# Upload multiple items
filemoverexpress upload my-config ./file1.mov ./file2.mov ./folder/
```

### Downloading Files

Download files from Amazon S3 to your local system:

```bash
filemoverexpress download [remote-configuration] [local-destination] [s3-prefix]
```

**Examples:**
```bash
# Download specific file
filemoverexpress download my-config ./downloads/ my-folder/video.mp4

# Download entire folder
filemoverexpress download my-config ./downloads/ project-files/

# Download to current directory
filemoverexpress download my-config ./ important-file.txt
```

## Path Handling

### Relative vs Absolute Paths

**Relative Paths (Recommended for Uploads):**
- Don't start with `/` (forward slash)
- Preserve directory structure in S3
- Example: `dir/file.txt` uploads as `dir/file.txt` in S3

**Absolute Paths:**
- Full file path from root
- File Mover Express strips path and uploads file only
- Example: `/Users/username/dir/file.txt` uploads as `file.txt` in S3

**Important Notes:**
- Cannot mix relative and absolute paths in same command
- Relative paths with `..` are not supported
- For downloads, use relative destination paths only

## Command Flags

### Global Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--help` | List available flags and commands | `filemoverexpress --help` |
| `--profile` | AWS named profile | `--profile my_profile` |
| `--prefix` | S3 prefix path | `--prefix my/s3/path` |

### Transfer Control Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--force` | Force transfer regardless of conflicts | `--force` |
| `--retry-count` | Number of retry attempts on error | `--retry-count 4` |
| `--max-active-transfers` | Max concurrent file transfers | `--max-active-transfers 10` |
| `--max-active-checksums` | Max concurrent checksums (upload only) | `--max-active-checksums 5` |

### Performance Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--auto-tuning` | Enable automatic performance tuning | `--auto-tuning true` |
| `--chunk-size` | Chunk size in MB | `--chunk-size 50` |
| `--threads` | Number of threads per transfer | `--threads 10` |

### File Processing Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--checksum-algorithm` | Checksum algorithm (md5, xxhash, xxhash64, xxh3) | `--checksum-algorithm xxhash64` |
| `--enable-metadata-filter` | Filter system metadata files | `--enable-metadata-filter` |
| `--filter` | Regular expression file filter | `--filter "^.*\.(mov)$"` |
| `--max-age` | Only process files within time window | `--max-age "2d"` |

### System Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--no-sleep` | Prevent macOS sleep during transfers | `--no-sleep true` |

## Advanced Usage

### Filtering Files

**By File Extension:**
```bash
# Only upload .mov files
filemoverexpress upload my-config ./footage/ --filter "^.*\.(mov)$"

# Upload video files only
filemoverexpress upload my-config ./media/ --filter "^.*\.(mov|mp4|avi)$"
```

**By Age:**
```bash
# Upload files from last 2 days
filemoverexpress upload my-config ./daily-footage/ --max-age "2d"

# Upload files from last 3600 seconds
filemoverexpress upload my-config ./recent/ --max-age "3600"
```

**Metadata Filtering:**
```bash
# Exclude system files (.DS_Store, Thumbs.db, ._* files)
filemoverexpress upload my-config ./project/ --enable-metadata-filter
```

### Performance Tuning

**High-Performance Upload:**
```bash
filemoverexpress upload my-config ./large-files/ \
  --max-active-transfers 20 \
  --threads 15 \
  --chunk-size 100 \
  --max-active-checksums 8
```

**Conservative Settings:**
```bash
filemoverexpress upload my-config ./files/ \
  --max-active-transfers 5 \
  --threads 5 \
  --chunk-size 25
```

**Auto-tuned (Recommended):**
```bash
filemoverexpress upload my-config ./files/ --auto-tuning true
```

### Scripting Examples

**Batch Upload Script:**
```bash
#!/bin/bash
REMOTE_CONFIG="production-bucket"
SOURCE_DIR="/media/daily-footage"

# Upload today's footage
filemoverexpress upload $REMOTE_CONFIG $SOURCE_DIR \
  --max-age "1d" \
  --filter "^.*\.(mov|mp4)$" \
  --enable-metadata-filter \
  --retry-count 3
```

**Backup Script with Error Handling:**
```bash
#!/bin/bash
set -e

REMOTE_CONFIG="backup-bucket"
BACKUP_DIR="/important-data"
LOG_FILE="/var/log/backup.log"

echo "Starting backup at $(date)" >> $LOG_FILE

if filemoverexpress upload $REMOTE_CONFIG $BACKUP_DIR --force; then
    echo "Backup completed successfully at $(date)" >> $LOG_FILE
else
    echo "Backup failed at $(date)" >> $LOG_FILE
    exit 1
fi
```

## Hot Folders via CLI

Configure hot folders in the configuration file for automatic uploads:

### Configuration Example

```yaml
hot_folders:
  - enabled: true
    local_source_folder: /Users/user/watch-folder
    name: auto_upload
    remote_configurations:
      - remote_configuration_name: my-config
        s3_destination_folder: auto-uploads/
```

### Multiple Hot Folders

```yaml
hot_folders:
  - enabled: true
    local_source_folder: /media/camera-1
    name: camera_1_upload
    remote_configurations:
      - remote_configuration_name: production
        s3_destination_folder: camera-1/
      - remote_configuration_name: backup
        s3_destination_folder: camera-1-backup/
  
  - enabled: true
    local_source_folder: /media/camera-2
    name: camera_2_upload
    remote_configurations:
      - remote_configuration_name: production
        s3_destination_folder: camera-2/
```

## Utility Commands

### Validate Credentials

Test your AWS configuration:

```bash
filemoverexpress validate-credentials [remote-configuration]
```

### Generate Support File

Create diagnostic information for troubleshooting:

```bash
filemoverexpress support-file
```

Output location:
- **Windows**: `C:\Users\username\.filemoverexpress\support-files\`
- **macOS/Linux**: `~/.filemoverexpress/support-files/`

### Bucket Inventory

Generate detailed bucket reports:

```bash
filemoverexpress inventory [remote-configuration] [options]
```

**Options:**
- `--output-format`: Format (json, yaml, csv, xml)

**Example:**
```bash
filemoverexpress inventory my-config --output-format csv
```

## Environment Variables

### Configuration Directory

Override default configuration location:

```bash
export filemoverexpress_CONFIG_DIR=/custom/config/path
filemoverexpress upload my-config ./files/
```

**Default Locations:**
- **Windows**: `C:\Users\username\.filemoverexpress\`
- **macOS/Linux**: `~/.filemoverexpress/`

## Error Handling and Debugging

### Common Exit Codes

- `0`: Success
- `1`: General error
- `2`: Configuration error
- `3`: Network/AWS error

### Verbose Output

Enable detailed logging by setting log level in configuration:

```yaml
logging:
  log_severity: info  # debug, info, warn, error, fatal
  directory: /path/to/logs/
```

### Debugging Network Issues

```bash
# Test with minimal settings
filemoverexpress upload my-config ./test-file.txt \
  --max-active-transfers 1 \
  --threads 1 \
  --retry-count 1
```

## Integration Examples

### CI/CD Pipeline

```bash
# In your build script
if [ "$BUILD_SUCCESS" = "true" ]; then
    filemoverexpress upload artifacts-bucket ./build-output/ \
      --prefix "builds/$BUILD_NUMBER/" \
      --force
fi
```

### Cron Job

```bash
# Daily backup at 2 AM
0 2 * * * /usr/local/bin/filemoverexpress upload backup-config /data/daily/ --max-age "1d"
```

### Docker Container

```dockerfile
FROM alpine:latest
RUN apk add --no-cache ca-certificates
COPY filemoverexpress /usr/local/bin/
COPY config.yaml /root/.filemoverexpress/configuration.yaml
ENTRYPOINT ["filemoverexpress"]
```

## Next Steps

- **[Hot Folders](Hot-Folders)** - Automated file monitoring and uploads
- **[Remote Daemon](Remote-Daemon)** - Multi-user and high-performance setups
- **[Performance Optimization](Performance-Optimization)** - Tune for your workload
- **[Troubleshooting](Troubleshooting)** - Resolve common issues