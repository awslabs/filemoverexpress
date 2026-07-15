# Getting Started

This guide will help you get up and running with File Mover Express quickly.

## Prerequisites

Before starting, ensure you have completed:

1. **[Installation](Installation.md)** — Download and install File Mover Express
2. **[IAM Permissions](Security.md#required-iam-permissions)** — AWS credentials and S3 access
3. **[Configuration](Configuration.md)** — Add a Remote Configuration for your S3 bucket

## Quick Start Guide

### Step 1: Launch File Mover Express

**GUI Mode:**

Open File Mover Express from your Applications folder (macOS), Start Menu (Windows), or wherever you installed it.

If you built from source, you can also launch it from the `dist/` folder or run the daemon directly:

```bash
filemoverexpress daemon
```

The GUI will be accessible at `http://localhost:4200` when running `ng serve` from the `src/gui` folder. See [Development](Development.md) for details.

**CLI Mode:**
```bash
filemoverexpress daemon
```

### Step 2: Verify Connection

#### Using GUI
1. Open File Mover Express
2. Check that your remote configuration shows a green checkmark (connected status)
3. If not connected, verify your configuration settings

#### Using CLI
```bash
filemoverexpress validate-credentials [remote-configuration-name]
```

### Step 3: Your First Transfer

#### Upload Files (GUI)
1. **Select source files**: In the Local file browser (left side), navigate to and select files/folders
2. **Choose destination**: In the S3 Bucket file browser (right side), select your remote configuration
3. **Start transfer**: Drag and drop files from left to right
4. **Monitor progress**: View transfer status in the Jobs tab

#### Upload Files (CLI)
```bash
filemoverexpress upload [remote-configuration] [local-path]
```

Example:
```bash
filemoverexpress upload my-config ./my-video-files/
```

#### Download Files (GUI)
1. **Select source files**: In the S3 Bucket file browser (right side), select files/folders
2. **Choose destination**: In the Local file browser (left side), navigate to destination
3. **Start transfer**: Drag and drop files from right to left
4. **Monitor progress**: View transfer status in the Jobs tab

#### Download Files (CLI)
```bash
filemoverexpress download [remote-configuration] [local-destination] [s3-prefix]
```

Example:
```bash
filemoverexpress download my-config ./downloads/ my-folder/video.mp4
```

## Understanding the Interface

### GUI Layout

The File Mover Express GUI consists of three main areas:

1. **Local File Browser (Left)**: Browse your local file system
   - File System dropdown: Select local drives, favorites, or remote daemons
   - Navigation: Click folders to browse, use breadcrumbs to go back

2. **S3 Bucket File Browser (Right)**: Browse your S3 buckets
   - Remote Configuration dropdown: Select configured S3 destinations
   - Navigation: Browse S3 objects and prefixes

3. **Bottom Panel Tabs**:
   - **Jobs**: Monitor active transfers, pause/resume/cancel operations
   - **Logs**: View detailed transfer logs and application messages
   - **Bucket Reports**: Generate and view S3 bucket inventory reports

### Job Management

In the Jobs tab, you can:

- **View Progress**: See real-time transfer progress, speed, and ETA
- **Control Transfers**: 
  - Pause/Resume individual jobs
  - Cancel unwanted transfers
  - Rename jobs for better organization
- **Generate Reports**: Create detailed transfer reports
- **View Details**: Click Action button for detailed job information

## Common Workflows

### Camera to Cloud Workflow
1. Connect camera storage device
2. Select footage in Local file browser
3. Choose production S3 bucket in Remote Configuration
4. Drag and drop to start upload
5. Monitor progress and verify checksums

### Work-in-Progress Sync
1. Set up Hot Folder monitoring for active project directory
2. Configure automatic upload to designated S3 prefix
3. Files automatically upload when added/modified
4. Team members can download latest versions

### Archive and Delivery
1. Select final project files
2. Choose appropriate S3 storage class (e.g., Glacier for long-term archive)
3. Upload with checksum verification
4. Generate bucket report for delivery confirmation

### Multi-Location Collaboration
1. Set up remote daemon on high-bandwidth machine
2. Connect GUI from multiple workstations
3. Centralize transfers through daemon
4. Share access to common project buckets

## Performance Tips

### Optimize for Your Content

**Large Files (>1GB)**:
- Enable autotuning (recommended)
- Use higher thread counts if manually tuning
- Ensure adequate local disk I/O

**Many Small Files**:
- Increase max active transfers
- Consider lower thread counts per file
- Use file order prioritization for critical files

**Mixed File Sizes**:
- Keep autotuning enabled
- Monitor transfer speeds and adjust if needed

### Network Optimization

- **Use S3 Transfer Acceleration** for geographically distant buckets
- **Set bandwidth throttling** if you need to limit network usage
- **Choose nearest AWS Region** for your S3 bucket

## Troubleshooting Quick Fixes

### Connection Issues
- Verify AWS credentials: `aws --profile [profile-name] sts get-caller-identity`
- Check IAM policy permissions
- Confirm S3 bucket exists and is accessible

### Slow Transfers
- Check network bandwidth utilization
- Verify disk I/O isn't bottlenecked
- Consider adjusting thread/transfer settings
- Enable S3 Transfer Acceleration if geographically distant

### GUI Won't Connect
- Ensure `apiServer.enabled` is `true` in configuration
- Restart File Mover Express daemon
- Check for port conflicts (default: 50005)

## Next Steps

Now that you're familiar with the basics:

- **[Using the GUI](Using-the-GUI)** - Detailed GUI features and workflows
- **[Using the CLI](Using-the-CLI)** - Advanced CLI usage and scripting
- **[Hot Folders](Hot-Folders)** - Set up automated monitoring and uploads
- **[Remote Daemon](Remote-Daemon)** - Configure multi-user or high-performance setups
- **[Best Practices](Best-Practices)** - Optimize performance and security
- **[Checksums](Checksums)** - Understand file integrity verification

## Getting Help

If you need assistance:

1. Check the **[Troubleshooting](Troubleshooting)** guide
2. Review logs in the GUI Logs tab or CLI output
3. Generate a support file: GUI Settings → Support, or `filemoverexpress support-file`
4. Open an issue on [GitHub](https://github.com/awslabs/filemoverexpress) with:
   - Your configuration (remove sensitive information)
   - Error messages or logs
   - Steps to reproduce the issue