# Hot Folders

Hot Folders enable automatic monitoring of local directories and upload new or modified files to Amazon S3. This feature is ideal for automated workflows where files are continuously added to specific directories.

## Overview

The Hot Folder feature recursively monitors all file system events within specified directories. When you add or modify files in a monitored folder, File Mover Express automatically uploads them to designated S3 buckets.

**Key Benefits:**
- **Automated Uploads**: No manual intervention required
- **Real-time Monitoring**: Files upload as soon as they're added/modified
- **Multiple Destinations**: Upload to multiple S3 buckets from single folder
- **Recursive Monitoring**: Monitors all subdirectories automatically

## Requirements and Limitations

**Initial sync skips files already in S3 (configurable):**
By default, when a hot folder is first enabled, the daemon restarts, or the hot folder configuration changes, File Mover Express scans the source folder but **skips files that already exist in S3** — only new or changed files are uploaded. This means restarting the daemon or re-adding a hot folder no longer re-uploads an entire directory that was already synced. The existing-object check is the same one used for regular uploads (see the checksum note below).

If your workflow depends on the previous behavior — re-uploading *every* file in the folder on each initial sync — set `forceInitialUpload: true` on the hot folder (see [Configuration Parameters](#configuration-parameters-1)). This flag affects only the initial/reload sweep; files detected live by the watcher after startup are always uploaded regardless of the flag.

**Duplicate detection with checksums requires File Mover Express metadata:**
When checksumming is enabled on a transfer profile, the object-already-exists check compares checksum values stored in S3 object metadata (e.g., `xxh3`, `xxhash64`, `md5-hex`). These metadata fields are only written by File Mover Express during upload. Files uploaded to S3 by other tools (AWS CLI, S3 console, third-party clients) will not have this metadata, so File Mover Express may re-upload them even if the content is identical. With checksumming disabled, the check uses file size and last-modified time, which works regardless of how the file was originally uploaded.

### File System Support

**Compatible Systems:**
- Local file systems (NTFS, APFS, ext4, etc.)
- File systems that support change notifications

**Potential Issues:**
- Some network file systems (NFS, SMB) may not work
- Functionality depends on file server configuration
- Test thoroughly with your specific network storage

### System Requirements

**Performance Considerations:**
- Monitor system resources with active hot folders
- Large directories may impact performance
- Consider file system I/O capabilities

## Configuration Methods

### GUI Configuration

#### Method 1: Settings Menu
1. Open File Mover Express
2. Select dropdown menu (≡) and choose **Settings**
3. In **Hot Folders** section, choose **Add Hot Folder**

#### Method 2: Context Menu
1. Right-click on a folder in the Local file browser
2. Choose **Configure Hot Folder**

#### Configuration Parameters

**Basic Settings:**
- **Name**: Unique identifier for this hot folder configuration
- **Remote Configuration Name**: Target S3 configuration from dropdown
- **Local Source Folder**: Full path to monitor (e.g., `/media/drive`)
- **S3 Destination Folder**: Target S3 prefix (leave blank for bucket root)

**Advanced Options:**
- **Multiple Destinations**: Click (+) icon to add additional S3 targets
- **Enable/Disable**: Toggle hot folder monitoring on/off

### CLI Configuration

Edit your `configuration.yaml` file to add hot folder configurations:

#### Basic Hot Folder

```yaml
hotFolders:
  - enabled: true
    localSourceFolder: /Users/user/myhotfolder
    name: my_hot_folder
    remoteConfigurations:
      - remoteConfigurationName: example_configuration
        s3DestinationFolder: my/s3/prefix
```

#### Forcing a full re-upload on the initial sweep

By default the initial/reload sweep skips files already in S3. To preserve the
legacy behavior and re-upload the entire folder on every daemon start or config
change, set `forceInitialUpload: true`:

```yaml
hotFolders:
  - enabled: true
    localSourceFolder: /Users/user/myhotfolder
    name: my_hot_folder
    forceInitialUpload: true   # re-upload everything on each initial/reload sweep
    remoteConfigurations:
      - remoteConfigurationName: example_configuration
        s3DestinationFolder: my/s3/prefix
```

#### Multiple Hot Folders

```yaml
hotFolders:
  - enabled: true
    localSourceFolder: /Media/drive
    name: camera_footage
    remoteConfigurations:
      - remoteConfigurationName: production_bucket
        s3DestinationFolder: camera-1/daily/
      - remoteConfigurationName: backup_bucket
        s3DestinationFolder: camera-1-backup/
  
  - enabled: true
    localSourceFolder: /Users/editor/projects
    name: project_sync
    remoteConfigurations:
      - remoteConfigurationName: work_bucket
        s3DestinationFolder: projects/active/
```

#### Configuration Parameters

| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| `enabled` | Yes | Enable/disable this hot folder | `true` |
| `localSourceFolder` | Yes | Full path to monitor | `/path/to/folder` |
| `name` | Yes | Unique identifier | `camera_uploads` |
| `forceInitialUpload` | No | Re-upload every file on the initial/reload sweep instead of skipping files already in S3. Defaults to `false`. | `false` |
| `remoteConfigurations` | Yes | Array of S3 destinations | See examples below |

**Remote Configuration Parameters:**
| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| `remoteConfigurationName` | Yes | Name of S3 configuration | `my_bucket_config` |
| `s3DestinationFolder` | No | S3 prefix for uploads | `uploads/camera/` |

## Usage Examples

### Camera to Cloud Workflow

**Scenario**: Automatically upload camera footage as it's captured

```yaml
hotFolders:
  - enabled: true
    localSourceFolder: /Volumes/CameraCard/DCIM
    name: camera_auto_upload
    remoteConfigurations:
      - remoteConfigurationName: production_footage
        s3DestinationFolder: daily-footage/
      - remoteConfigurationName: backup_storage
        s3DestinationFolder: camera-backup/
```

**Workflow:**
1. Camera writes files to `/Volumes/CameraCard/DCIM`
2. File Mover Express detects new files immediately
3. Uploads begin automatically to both production and backup buckets
4. Files maintain directory structure in S3

### Multi-Camera Setup

**Scenario**: Multiple cameras uploading to organized S3 structure

```yaml
hotFolders:
  - enabled: true
    localSourceFolder: /media/camera-A
    name: camera_a_uploads
    remoteConfigurations:
      - remoteConfigurationName: project_bucket
        s3DestinationFolder: shoot-2024/camera-A/
  
  - enabled: true
    localSourceFolder: /media/camera-B
    name: camera_b_uploads
    remoteConfigurations:
      - remoteConfigurationName: project_bucket
        s3DestinationFolder: shoot-2024/camera-B/
```

### Post-Production Sync

**Scenario**: Automatically sync edited content to cloud storage

```yaml
hotFolders:
  - enabled: true
    localSourceFolder: /projects/current/exports
    name: export_sync
    remoteConfigurations:
      - remoteConfigurationName: client_delivery
        s3DestinationFolder: client-deliverables/
      - remoteConfigurationName: archive_storage
        s3DestinationFolder: project-archive/exports/
```

## Operational Behavior

### Initial Upload

**First Activation / Restart / Config Change:**
- When a hot folder is first enabled — and again on every daemon restart or hot folder config change — File Mover Express scans the source folder and uploads files that are **not already in S3** (or whose content has changed). Files already uploaded are skipped, so restarts don't re-push the whole directory.
- To re-upload the entire folder on every sweep regardless of what's in S3, set `forceInitialUpload: true` (see [Configuration Parameters](#configuration-parameters-1)).
- You can cancel this initial job in the GUI if not desired.

**Subsequent Operations:**
- Only new or modified files are uploaded
- File Mover Express tracks file modification times
- Deleted files are not automatically removed from S3

**Files still being written:**
- The watcher debounces activity **per hot folder**: if any file in a hot folder was written within the last few seconds, that hot folder's pending files wait for the next cycle. This prevents partially-copied files from being uploaded mid-write, and prevents a single large copy from spawning duplicate jobs while it finishes.

### File Processing

**Supported Operations:**
- **New Files**: Automatically uploaded when created
- **Modified Files**: Re-uploaded when changed
- **Moved Files**: Treated as new files in new location
- **Renamed Files**: Original remains in S3, renamed file uploaded as new

**File System Events:**
- Create: File uploaded immediately
- Modify: File re-uploaded after modification
- Move into folder: Treated as new file
- Move out of folder: No action (file remains in S3)

### Error Handling

**Upload Failures:**
- Failed uploads are retried according to retry configuration
- Persistent failures are logged for review
- Hot folder monitoring continues despite individual file failures

**Network Issues:**
- Uploads queue during network outages
- Resume automatically when connectivity restored
- No files are lost during temporary disconnections

## Management and Monitoring

### GUI Management

**Hot Folder Status:**
- View active hot folders in Settings
- Monitor upload progress in Jobs tab
- See detailed logs in Logs tab

**Controls:**
- **Enable/Disable**: Toggle monitoring without deleting configuration
- **Edit Configuration**: Modify paths and destinations
- **Delete**: Remove hot folder configuration entirely

### CLI Management

**Configuration Changes:**
- Edit `configuration.yaml` file
- Restart daemon to apply changes: `filemoverexpress daemon`
- Changes take effect immediately upon restart

**Monitoring:**
```bash
# View daemon logs for hot folder activity
tail -f ~/.filemoverexpress/logs/filemoverexpress.log
```

### Performance Monitoring

**System Impact:**
- Monitor CPU usage during active monitoring
- Check disk I/O rates for large directories
- Watch network bandwidth utilization

**Optimization:**
- Limit number of concurrent hot folders
- Use appropriate transfer settings for file types
- Consider file filtering for specific file types only

## Advanced Configuration

### File Filtering

Combine hot folders with file filtering for selective uploads:

```yaml
protocols:
  s3:
    transferProfiles:
      video_only_config:
        bucket: "my-bucket"
        region: "us-west-2"
        profile: "my-profile"
        filter: "^.*\\.(mov|mp4|avi)$"  # Only video files

hotFolders:
  - enabled: true
    localSourceFolder: /media/mixed-content
    name: video_filter_upload
    remoteConfigurations:
      - remoteConfigurationName: video_only_config
        s3DestinationFolder: video-content/
```

### Multiple Destination Strategies

**Redundancy Strategy:**
```yaml
hotFolders:
  - enabled: true
    localSourceFolder: /critical/footage
    name: critical_backup
    remoteConfigurations:
      - remoteConfigurationName: primary_storage
        s3DestinationFolder: primary/
      - remoteConfigurationName: backup_storage
        s3DestinationFolder: backup/
      - remoteConfigurationName: archive_storage
        s3DestinationFolder: archive/
```

**Workflow Distribution:**
```yaml
hotFolders:
  - enabled: true
    localSourceFolder: /incoming/raw
    name: workflow_distribution
    remoteConfigurations:
      - remoteConfigurationName: editing_bucket
        s3DestinationFolder: raw-footage/
      - remoteConfigurationName: backup_bucket
        s3DestinationFolder: raw-backup/
      - remoteConfigurationName: archive_bucket
        s3DestinationFolder: long-term-archive/
```

## Troubleshooting

### Hot Folder Not Working

**Check File System Support:**
```bash
# Test with a simple file creation
touch /path/to/hotfolder/test-file.txt
# Check if upload begins automatically
```

**Verify Configuration:**
- Ensure `enabled: true` in configuration
- Check that `localSourceFolder` path exists and is accessible
- Verify `remoteConfigurationName` matches existing configuration
- Confirm File Mover Express has read permissions on directory

**Common Issues:**
- **Network File Systems**: May not support change notifications
- **Permissions**: File Mover Express needs read access to monitored directory
- **Path Format**: Use absolute paths for `localSourceFolder`

### Performance Issues

**High CPU Usage:**
- Reduce number of active hot folders
- Monitor smaller directory trees
- Check for excessive file system activity

**Slow Uploads:**
- Review transfer configuration settings
- Check network bandwidth availability
- Consider file size and transfer optimization

**Memory Usage:**
- Large directories may consume more memory
- Monitor system resources during operation
- Consider breaking large directories into smaller hot folders

### Network File System Issues

**NFS/SMB Compatibility:**
- Test hot folder functionality with your specific setup
- Some network file systems don't support change notifications
- Consider local staging area for network-attached storage

**Workarounds:**
- Use local directory with sync to network storage
- Implement polling-based monitoring scripts
- Consider alternative file monitoring solutions

## Best Practices

### Directory Organization

**Structured Approach:**
- Use consistent directory naming conventions
- Organize by project, date, or camera
- Keep directory trees reasonably sized for performance

**Example Structure:**
```
/media/
├── camera-A/
│   ├── 2024-01-15/
│   └── 2024-01-16/
├── camera-B/
│   ├── 2024-01-15/
│   └── 2024-01-16/
└── exports/
    ├── rough-cuts/
    └── final-deliverables/
```

### Security Considerations

**Access Control:**
- Limit hot folder access to authorized users only
- Use appropriate file system permissions
- Consider encryption for sensitive content

**Network Security:**
- Secure network file systems with appropriate protocols
- Use VPN for remote hot folder access
- Monitor for unauthorized file additions

### Operational Procedures

**Monitoring:**
- Regularly check hot folder status and logs
- Monitor S3 storage usage and costs
- Set up alerts for failed uploads

**Maintenance:**
- Periodically review and clean up old hot folder configurations
- Update S3 configurations as needed
- Test hot folder functionality after system changes

## Next Steps

- **[Using the GUI](Using-the-GUI)** - Manage hot folders through the interface
- **[Using the CLI](Using-the-CLI)** - Configure hot folders via command line
- **[Performance Optimization](Performance-Optimization)** - Optimize hot folder performance
- **[Best Practices](Best-Practices)** - Implement hot folder best practices
