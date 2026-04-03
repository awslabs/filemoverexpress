# Checksums

File Mover Express performs checksums to verify file integrity during transfers. This ensures that files are not corrupted during upload or download operations.

## Overview

File Mover Express uses checksums to verify the integrity of *data on disk* compared to the *data in the bucket*. If there is a checksum mismatch, File Mover Express uploads the file again. A mismatch occurs if you have changed the file since the original upload.

> **Note**: As of File Mover Express v2.5.0, checksums are disabled by default and can be configured in the Remote Configuration menu.

## Types of Checksums

### Native Checksums

**How it works:**
- File Mover Express calculates checksums in the background during uploads
- Uses a local database to cache calculated checksums
- Reuses cached values for unchanged files
- Only recalculates if file was modified since last checksum

**Performance impact:**
- CPU count impacts checksum performance
- Checksums are processed before uploads begin
- Can be parallelized for better performance

### Media Hash List (MHL) Checksums

If you want to skip the native checksum process, provide a Media Hash List (MHL) file in the upload directory.

**MHL Support:**
- File Mover Express treats MHL as authoritative source
- Appends checksum value to uploaded object's metadata
- Must contain one of these fields:
  - `<md5>HEXVALUE</md5>`
  - `<xxhash64>HEXVALUE</xxhash64>`
  - `<xxhash64be>HEXVALUE</xxhash64be>`

**MHL File Placement:**
- Place MHL in same folder as files being uploaded
- Can be in any parent folder of the files
- Single MHL file can reference files in subdirectories
- Recommended: One MHL file with checksums for most/all files in folder

**Learn more**: [About Media Hash List](https://mediahashlist.org/)

## Checksum Algorithms

File Mover Express supports multiple checksum algorithms:

| Algorithm | Description | Use Case |
|-----------|-------------|----------|
| **MD5** | Most standard and secure | Industry standard, maximum compatibility |
| **XXHash** | Faster than MD5 | Good balance of speed and reliability |
| **XXHash64** | 64-bit version of XXHash | Better performance on 64-bit systems |
| **XXH3** | Latest XXHash algorithm | Fastest option, best for high-throughput |

### Choosing an Algorithm

**Security vs Speed Trade-off:**
- **MD5**: Most secure and widely supported
- **XXH3**: Fastest performance
- **XXHash64**: Good middle ground

**Configuration:**
```yaml
protocols:
  s3:
    transfer_profiles:
      - name: "my-config"
        checksum_algorithm: "xxh3"  # md5-hex, xxhash, xxhash64, xxh3
```

## Configurable Checksums

### Concurrent Checksum Processing

**Default Behavior:**
- Uses one less than total logical core count for concurrent checksums
- Example: 12 logical cores = maximum 11 concurrent checksums
- Minimum threshold is always 1
- Default: 1 checksum runs at a time

**Configuration:**
```yaml
max_active_checksums: 8  # Adjust based on your CPU cores
```

**Recommended Value:**
- Total CPU cores minus 1
- Monitor system performance and adjust as needed
- Consider other applications running on the system

### Performance Tuning

**When to Adjust:**
- Reduce checksums to free up resources for other programs
- Increase for faster processing on high-core systems
- Balance with transfer and other system operations

**GUI Configuration:**
1. Open Settings (≡ menu)
2. Navigate to Remote Configuration settings
3. Adjust **Max active checksums** value
4. Save configuration

**CLI Configuration:**
```bash
filemoverexpress upload my-config ./files/ --max-active-checksums 4
```

## Checksum Verification Process

### Upload Process

1. **File Discovery**: File Mover Express scans selected files
2. **Checksum Calculation**: 
   - Check local database for cached checksum
   - Calculate if file is new or modified
   - Use MHL checksum if available
3. **Upload**: Transfer file to S3 with checksum metadata
4. **Verification**: Compare local and remote checksums

### Download Process

1. **File Selection**: Choose files to download from S3
2. **Download**: Transfer file from S3 to local system
3. **Verification**: Calculate local checksum and compare with S3 metadata
4. **Validation**: Ensure file integrity during transfer

### Checksum Mismatch Handling

**If checksums don't match:**
- File Mover Express automatically retries the transfer
- Uses retry count configuration for number of attempts
- Logs checksum mismatch for troubleshooting
- Fails transfer if all retries are exhausted

## Database Management

### Checksum Cache Database

**Location:**
- **Windows**: `C:\Users\username\.filemoverexpress\checksum-cache.db`
- **macOS/Linux**: `~/.filemoverexpress/checksum-cache.db`

**Purpose:**
- Stores calculated checksums for files
- Avoids recalculation for unchanged files
- Improves performance for repeated transfers

**Management:**
- Database is automatically created and maintained
- No manual intervention typically required
- Can be deleted to force recalculation of all checksums

### Custom Database Location

Override default location using environment variable:

```bash
export filemoverexpress_CONFIG_DIR=/custom/path/
filemoverexpress upload my-config ./files/
```

## Best Practices

### Performance Optimization

**For High-Throughput Scenarios:**
- Use XXH3 algorithm for fastest processing
- Set max active checksums to CPU cores minus 1
- Consider disabling checksums for non-critical transfers
- Use MHL files when available to skip calculation

**For Maximum Security:**
- Use MD5 algorithm for industry standard verification
- Always enable checksum verification for critical data
- Verify MHL files are from trusted sources
- Monitor checksum mismatch rates

### Workflow Integration

**Media Production:**
- Generate MHL files during capture/editing
- Include MHL files in transfer packages
- Verify checksums at each workflow stage
- Maintain checksum records for archival

**Automated Workflows:**
- Include checksum verification in scripts
- Monitor for checksum failures in logs
- Implement retry logic for failed verifications
- Alert on persistent checksum issues

## Troubleshooting Checksums

### Common Issues

**Slow Checksum Processing:**
- Reduce max active checksums
- Use faster algorithm (XXH3)
- Check disk I/O performance
- Consider SSD storage for better performance

**Checksum Mismatches:**
- Verify file hasn't been modified during transfer
- Check for disk errors or corruption
- Ensure stable network connection
- Review MHL file accuracy if using external checksums

**High CPU Usage:**
- Reduce concurrent checksum operations
- Balance with other system processes
- Monitor system resources during transfers
- Consider checksum-free transfers for non-critical data

### Debugging

**Enable Detailed Logging:**
```yaml
logging:
  log_severity: debug
  directory: /path/to/logs/
```

**Monitor Checksum Operations:**
- Check logs for checksum calculation times
- Monitor CPU usage during checksum phase
- Verify database operations are completing
- Review retry patterns for failed checksums

## Advanced Configuration

### Disabling Checksums

**Per Remote Configuration:**
```yaml
protocols:
  s3:
    transfer_profiles:
      - name: "fast-transfer"
        checksum_algorithm: "none"  # Disables checksums
```

**Use Cases for Disabled Checksums:**
- Non-critical data transfers
- High-speed requirements
- Resource-constrained environments
- When using external verification methods

### Custom Checksum Workflows

**External Verification:**
- Generate checksums outside File Mover Express
- Provide MHL files for verification
- Implement post-transfer validation
- Use S3 object metadata for verification

**Hybrid Approaches:**
- Use checksums for critical files only
- Implement selective verification based on file type
- Combine with external monitoring systems
- Integrate with media asset management systems

## Next Steps

- **[Performance Optimization](Performance-Optimization)** - Tune checksum performance
- **[Best Practices](Best-Practices)** - Implement checksum best practices
- **[Using the CLI](Using-the-CLI)** - Configure checksums via command line
- **[Configuration](Configuration)** - Set up checksum algorithms