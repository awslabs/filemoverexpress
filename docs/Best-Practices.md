# Best Practices

To maximize benefits from File Mover Express, follow these recommended practices for optimal performance, security, and reliability.

## Amazon S3 Best Practices

### Bucket Configuration

**Naming and Structure:**
- Follow [S3 object key naming best practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html)
- Use consistent, logical folder structures
- Avoid special characters that might cause issues

**Transfer Acceleration:**
- Enable [S3 Transfer Acceleration](https://docs.aws.amazon.com/AmazonS3/latest/userguide/transfer-acceleration.html) for geographically distant transfers
- Test performance with and without acceleration to determine benefit

**Lifecycle Management:**
- Configure [lifecycle rules](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpu-abort-incomplete-mpu-lifecycle-config.html) to abort incomplete multipart uploads
- This minimizes storage costs from failed transfers
- See [AWS blog post](http://aws.amazon.com/blogs/aws-cloud-financial-management/discovering-and-deleting-incomplete-multipart-uploads-to-lower-amazon-s3-costs/) for cost optimization details

### Storage Classes

**Choose Appropriate Storage Class:**
- **Standard**: Frequently accessed data, immediate retrieval needed
- **Standard-IA**: Infrequently accessed but requires rapid access when needed
- **Glacier Flexible Retrieval**: Long-term archive, retrieval in minutes to hours
- **Glacier Deep Archive**: Lowest cost, retrieval in 12+ hours

**Important Notes:**
- You can upload directly to any storage class
- Glacier and Deep Archive objects cannot be downloaded directly through File Mover Express
- Objects must be restored before download (see [Restoring archived objects](https://docs.aws.amazon.com/AmazonS3/latest/userguide/restoring-objects.html))

## AWS Key Management Service (KMS)

### Encryption Best Practices

**Recommended Approach:**
- Use **AWS Key Management Service key (SSE-KMS)** when creating S3 buckets
- Choose customer-managed keys for cross-account access requirements
- Plan key selection carefully - difficult to change after bucket creation

**Key Management:**
- For more information about key types, see [Customer keys and AWS keys](https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html#key-mgmt)
- Ensure proper IAM permissions for key usage
- Consider key rotation policies for enhanced security

## Hardware Requirements

### Recommended Specifications

**Minimum Requirements:**
- **8 logical CPU cores**
- **8 GB RAM**
- **Adequate disk I/O throughput**

**Performance Considerations:**
- File Mover Express can run on lower specifications but with decreased performance
- Disk throughput must scale with network bandwidth
- Upgrade infrastructure (hardware, CPU, internet) for high-throughput scenarios

### Storage Considerations

**Local Storage:**
- Use SSDs for better I/O performance
- Ensure sufficient free space for temporary files
- Consider RAID configurations for high-throughput scenarios

**Network Storage:**
- Test hot folder functionality on network file systems (NFS, SMB)
- Some network file systems may not support change notifications
- Consider local staging for network-attached storage

## Configuration Best Practices

### Autotuning vs Manual Configuration

**Autotuning (Recommended):**
- Keep **Transfer autotuning** enabled for most users
- Automatically adjusts settings per file based on characteristics
- Provides optimal performance for mixed file sizes
- Comparable to manual settings for similar-sized files

**Manual Tuning:**
- Only for users with advanced hardware knowledge
- Can outperform autotuning in specific scenarios
- Requires careful testing and monitoring
- Risk of poor performance if configured incorrectly

### Performance Parameters

#### Threads
- **Purpose**: Split each file transfer into multiple parallel streams
- **Most effective**: Large files (> 1 GB)
- **Default**: 10 threads
- **Tuning**: Increase by increments of 5 until bandwidth is fully utilized
- **Monitor**: Watch transfer speeds in GUI for optimization

#### Chunk Size
- **Purpose**: Size (in MB) delivered by each thread
- **Recommendation**: 5-10 times the average file size
- **Example**: For 50 MB average files, use 55-60 MB chunks
- **Large files**: Less benefit for files > 1 GB
- **Range**: Keep between 25-100 MB for best all-around performance

#### Max Active Transfers
- **Purpose**: Number of files processed simultaneously
- **Most effective**: Multiple small files (< 1 GB)
- **Tuning guidelines**:

| File Size | Starting Value | Increment |
|-----------|----------------|-----------|
| < 1 MB | 100 | 20 |
| 1 MB - 100 MB | 50 | 10 |
| 100 MB - 1 GB | 25 | 5 |
| > 1 GB | 10 | 2 |

#### Checksums
- **Purpose**: File integrity verification
- **Recommended**: Total CPU cores minus 1
- **Algorithms**: MD5 (standard), XXHash/XXH3 (faster)
- **Security vs Speed**: MD5 most secure, XXH3 fastest
- **Note**: Checksums disabled by default in v2.5.0+, configurable per remote configuration

## Network Optimization

### Bandwidth Management

**Bandwidth Throttling (v2.5.0+):**
- Set target average speed in MB/sec
- File Mover Express limits to target ±10% variance
- Useful for shared network environments

**Network Considerations:**
- File Mover Express cannot exceed allocated bandwidth
- Coordinate with network administrators for high-throughput needs
- Monitor network utilization during transfers

### Latency Optimization

**Regional Deployment:**
- Deploy File Mover Express in AWS Region closest to your location
- Consider AWS Direct Connect for consistent, low-latency connections
- Test different regions to find optimal performance

**Connection Quality:**
- Stable internet connection crucial for large transfers
- Consider redundant connections for critical workflows
- Monitor for packet loss or connection instability

## Security Best Practices

### Access Control

**IAM Policies:**
- Use least-privilege principle
- Separate policies for different user roles
- Regular audit of permissions
- Consider temporary credentials for enhanced security

**Credential Management:**
- Use AWS CLI profiles instead of hardcoded credentials
- Rotate access keys regularly
- Consider IAM Identity Center for enterprise environments
- Never commit credentials to version control

### Network Security

**Remote Daemon Security:**
- Always use TLS for remote daemon connections
- Use strong pre-shared keys (follow NIST guidelines)
- Implement proper firewall rules
- Consider VPN for additional security layer

**Blocked Paths:**
- Configure `api_server.blocked_paths` to restrict access
- Default blocks include `.aws`, `.filemoverexpress`, system directories
- Use absolute paths for specific restrictions
- Test path blocking thoroughly

## Operational Best Practices

### Monitoring and Logging

**Enable Logging:**
```yaml
logging:
  directory: /path/to/logs/
  log_severity: info  # info, warn, error, fatal
```

**Log Management:**
- Regular log rotation to prevent disk space issues
- Monitor logs for error patterns
- Use structured logging for automated analysis

**Performance Monitoring:**
- Monitor transfer speeds and success rates
- Track bandwidth utilization
- Set up alerts for failed transfers

### Backup and Recovery

**Configuration Backup:**
- Regularly backup configuration files
- Version control configuration changes
- Document custom settings and rationale

**Transfer Verification:**
- Use checksum verification for critical transfers
- Implement verification workflows for important data
- Consider dual-destination uploads for critical content

### Maintenance

**Regular Updates:**
- Keep File Mover Express updated to latest version
- Monitor release notes for security updates
- Test updates in non-production environment first

**System Maintenance:**
- Regular cleanup of temporary files
- Monitor disk space usage
- Update AWS CLI and credentials as needed

## Workflow-Specific Best Practices

### Camera to Cloud

**Immediate Upload:**
- Use hot folders for automatic upload
- Configure appropriate storage class for immediate access
- Implement checksum verification for data integrity
- Consider bandwidth throttling to maintain network performance

### Archive Workflows

**Long-term Storage:**
- Use appropriate Glacier storage classes
- Plan for retrieval time requirements
- Implement proper metadata and tagging
- Consider lifecycle policies for automatic transitions

### Collaboration Workflows

**Multi-user Environments:**
- Use remote daemon for centralized processing
- Implement proper access controls
- Consider separate configurations per project/team
- Use consistent naming conventions

### Production Workflows

**High-Availability:**
- Implement redundant network connections
- Use multiple AWS regions for disaster recovery
- Monitor transfer success rates
- Implement automated retry mechanisms

## Troubleshooting Prevention

### Proactive Measures

**System Limits:**
- Increase maximum open files limit (Linux/macOS)
- Recommended minimum: 20,000 open files
- Monitor system resource usage
- Plan for peak usage scenarios

**Network Preparation:**
- Test network stability before large transfers
- Coordinate with network teams for high-bandwidth usage
- Implement network monitoring
- Have fallback connectivity options

**Capacity Planning:**
- Monitor disk space on source and destination
- Plan for temporary file storage during transfers
- Consider transfer time windows for large datasets
- Implement automated cleanup procedures

## Next Steps

- **[Performance Optimization](Performance-Optimization)** - Detailed performance tuning
- **[Security](Security)** - Comprehensive security guidelines
- **[Monitoring](Monitoring)** - Set up monitoring and alerting
- **[Troubleshooting](Troubleshooting)** - Resolve common issues