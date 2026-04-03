# Troubleshooting

This guide helps you resolve common issues with File Mover Express. We recommend enabling logging for better diagnostics.

## Enable Logging

Configure logging in your `configuration.yaml` file:

```yaml
logging:
  directory: /path/to/logs/
  log_severity: info  # debug, info, warn, error, fatal
```

## Generate Support Files

Create diagnostic information to help troubleshoot issues:

### Using GUI
1. Open File Mover Express
2. Select the dropdown menu (≡) and choose **Support**
3. Choose download location in the file browser

### Using CLI
```bash
filemoverexpress support-file
```

**Output locations:**
- **Windows**: `C:\Users\username\.filemoverexpress\support-files\`
- **macOS/Linux**: `~/.filemoverexpress/support-files/`

## GUI Issues

### File Mover Express Won't Connect

**Problem**: GUI shows disconnected status or won't enter "Connected" state.

**Solutions:**

1. **Check API Server Configuration**
   - Open configuration file: `~/.filemoverexpress/configuration.yaml`
   - Verify `api_server.enabled` is set to `true`
   - If missing or `false`, GUI cannot communicate with CLI

2. **Restart the Daemon**
   ```bash
   filemoverexpress daemon
   ```

3. **Check for Port Conflicts**
   - Default port: 50005
   - Ensure no other applications are using this port
   - Check firewall settings

### Connection Issues After Upgrade

**Problem**: Upgraded from v1.x to v2.0 and GUI won't connect.

**Solution**: Delete **Local Daemon** from the **Local File System Dropdown** menu. Component naming has been updated and may affect prior configurations.

### GUI Performance Issues

**Symptoms**: Slow interface, unresponsive controls, transfer delays.

**Solutions:**

1. **Restart File Mover Express**
2. **Check System Resources**
   - Monitor CPU and memory usage
   - Close unnecessary applications
   - Ensure adequate disk space

3. **Review Transfer Settings**
   - Lower max active transfers if system is overwhelmed
   - Reduce thread counts for resource-constrained systems

## CLI Issues

### Credential Problems

**Error Messages:**
```
FATAL [202X-XX-XX XX:XX:XX] Failed establishing a session to AWS:
InvalidAccessKeyId: The AWS Access Key Id you provided does not exist in our records.
```

```
FATAL [202X-XX-XX XX:XX:XX] Failed establishing a session to AWS:
ExpiredToken: The provided token has expired.
```

**Solutions:**

1. **Refresh AWS Credentials**
   - Follow [AWS CLI configuration guide](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html)
   - Verify profile configuration: `aws configure list --profile [profile-name]`
   - Test credentials: `aws --profile [profile-name] sts get-caller-identity`

2. **Check IAM Permissions**
   - Verify IAM policy includes required S3 permissions
   - Ensure KMS permissions if using encrypted buckets
   - Test bucket access: `aws --profile [profile-name] s3 ls s3://[bucket-name]`

### Invalid Remote Configuration

**Error**: `FATAL [202X-XX-XX XX:XX:XX] Invalid transfer profile. Valid transfer profiles:`

**Solutions:**

1. **Check Configuration File**
   - Verify remote configuration exists in `configuration.yaml`
   - Check spelling of configuration name
   - Ensure YAML formatting is correct

2. **Validate Configuration Structure**
   ```yaml
   protocols:
     s3:
       transfer_profiles:
         - name: "my-config"
           bucket: "my-bucket"
           region: "us-west-2"
           profile: "my-aws-profile"
   ```

3. **File Location Issues**
   - **Windows**: Don't run CMD.exe or PowerShell as administrator
   - Ensure you're editing the correct user's configuration file
   - Check `filemoverexpress_CONFIG_DIR` environment variable

### Network and I/O Errors

**Error**: `FATAL [202X-XX-XX XX:XX:XX] Unrecoverable error: retryable: RequestError:`

**Causes and Solutions:**

1. **Network Connectivity Issues**
   - **Problem**: Internet disconnection or firewall restrictions
   - **Solution**: Check network connectivity and firewall rules

2. **Storage I/O Problems**
   - **Problem**: Storage device cannot handle File Mover Express load
   - **Solution**: Reduce concurrent operations
   
   **GUI Method:**
   1. Open Settings (≡ menu)
   2. Change **Max active transfers** and **Number of threads** to `1`
   3. Save and retry transfer
   
   **CLI Method:**
   ```bash
   filemoverexpress upload my-config ./files/ \
     --max-active-transfers 1 \
     --threads 1
   ```
   
   Gradually increase values until you find stable configuration.

### Path Issues

**Error**: `WARN [202X-XX-XX XX:XX:XX] Absolute paths are not supported, ignoring /media/drive`

**Problem**: Using absolute paths where relative paths are required.

**Solutions:**

1. **Use Relative Paths**
   - Remove leading `/` (Linux/macOS) or `C:\` (Windows)
   - Navigate to parent directory and use relative path

2. **Examples**
   ```bash
   # Wrong
   filemoverexpress upload my-config /Users/username/files/
   
   # Correct (from /Users/username/)
   filemoverexpress upload my-config files/
   ```

### Connection Errors

**Error**: `Unable to open connection.`

**Causes and Solutions:**

1. **Multiple File Mover Express Instances**
   - **Problem**: Another File Mover Express application is running
   - **Solution**: Close other instances before starting new one

2. **Port Permission Issues**
   - **Problem**: User lacks permission to listen on specified port
   - **Solution**: 
     - Use ports 1024 or higher (non-privileged)
     - Ensure user has appropriate permissions
     - Change port in configuration if needed

3. **Port Already in Use**
   - **Problem**: Another program is using the same port
   - **Solution**: 
     - Stop conflicting program
     - Change File Mover Express port in configuration
     - Use `netstat` or `lsof` to identify port usage

## Performance Issues

### Slow Transfer Speeds

**Diagnosis Steps:**

1. **Check Network Bandwidth**
   ```bash
   # Test with minimal settings
   filemoverexpress upload my-config ./test-file.txt \
     --max-active-transfers 1 \
     --threads 1
   ```

2. **Monitor System Resources**
   - CPU utilization
   - Memory usage
   - Disk I/O rates
   - Network utilization

**Solutions:**

1. **Network Optimization**
   - Enable S3 Transfer Acceleration for distant regions
   - Check for network congestion
   - Consider bandwidth throttling if sharing network

2. **Hardware Optimization**
   - Upgrade to SSD storage for better I/O
   - Increase available RAM
   - Use faster network connection

3. **Configuration Tuning**
   - Enable autotuning: `--auto-tuning true`
   - Adjust thread counts based on file sizes
   - Optimize chunk sizes for your data

### High Resource Usage

**Symptoms**: System becomes unresponsive, high CPU/memory usage.

**Solutions:**

1. **Reduce Concurrent Operations**
   ```bash
   # Conservative settings
   filemoverexpress upload my-config ./files/ \
     --max-active-transfers 5 \
     --threads 5 \
     --max-active-checksums 2
   ```

2. **Limit Checksum Operations**
   - Reduce `max_active_checksums` in configuration
   - Consider disabling checksums for non-critical transfers
   - Use faster checksum algorithms (XXH3 vs MD5)

## Hot Folder Issues

### Hot Folder Not Working

**Problem**: Files added to monitored folder aren't automatically uploaded.

**Solutions:**

1. **Check File System Support**
   - Hot folders require file system change notifications
   - May not work on some network file systems (NFS, SMB)
   - Test with local file system first

2. **Verify Configuration**
   ```yaml
   hot_folders:
     - enabled: true  # Must be true
       local_source_folder: /full/path/to/folder  # Must be absolute path
       name: unique_name
       remote_configurations:
         - remote_configuration_name: valid_config_name
   ```

3. **Check Permissions**
   - Ensure File Mover Express can read the monitored directory
   - Verify write permissions for subdirectories
   - Check file system permissions

### Unwanted Initial Upload

**Problem**: Hot folder uploads entire directory when first enabled.

**Solution**: This is expected behavior. Cancel the initial job in GUI if not desired. Subsequent uploads will only include new/modified files.

## Remote Daemon Issues

### Cannot Connect to Remote Daemon

**Problem**: GUI cannot connect to remote daemon.

**Solutions:**

1. **Verify TLS Configuration**
   - TLS is required for remote daemon
   - Check certificate and key file paths
   - Ensure certificates are valid and trusted

2. **Check Network Connectivity**
   - Verify host/IP address is correct
   - Test port connectivity: `telnet [host] [port]`
   - Check firewall rules on both client and server

3. **Validate Configuration**
   ```yaml
   api_server:
     remote:
       enabled: true
       key: "secure-key"
       ports: 50006
       address: "0.0.0.0"
     tls:
       enabled: true
       certificate_file: "/path/to/cert.pem"
       key_file: "/path/to/key.pem"
   ```

### Remote Daemon Performance Issues

**Problem**: Slow transfers or timeouts when using remote daemon.

**Solutions:**

1. **Network Optimization**
   - Ensure adequate bandwidth between client and daemon
   - Check for network latency issues
   - Consider local network vs internet connections

2. **Resource Allocation**
   - Ensure daemon machine has adequate resources
   - Monitor CPU, memory, and disk I/O on daemon host
   - Adjust transfer settings for remote environment

## Advanced Troubleshooting

### Debug Mode

Enable detailed logging for troubleshooting:

```yaml
logging:
  log_severity: debug
  directory: /path/to/debug/logs/
```

### Network Diagnostics

**Test AWS Connectivity:**
```bash
# Test basic S3 access
aws --profile [profile-name] s3 ls s3://[bucket-name]

# Test with File Mover Express
filemoverexpress validate-credentials [remote-config]
```

**Network Tools:**
```bash
# Check DNS resolution
nslookup s3.amazonaws.com

# Test connectivity
ping s3.amazonaws.com

# Check port connectivity
telnet s3.amazonaws.com 443
```

### System Limits

**Increase File Descriptor Limits (Linux/macOS):**
```bash
# Check current limit
ulimit -n

# Increase limit (temporary)
ulimit -n 20000

# Permanent increase (add to ~/.bashrc or /etc/security/limits.conf)
echo "* soft nofile 20000" >> /etc/security/limits.conf
echo "* hard nofile 20000" >> /etc/security/limits.conf
```

## Getting Additional Help

### Information to Gather

When seeking help, collect:

1. **System Information**
   - Operating system and version
   - File Mover Express version
   - Hardware specifications

2. **Configuration Details**
   - Sanitized configuration file (remove credentials)
   - Command line used
   - Environment variables

3. **Error Information**
   - Complete error messages
   - Log files
   - Support file output

4. **Reproduction Steps**
   - Exact steps to reproduce issue
   - File types and sizes involved
   - Network environment details

### Support Channels

1. **GitHub Issues**: [File Mover Express Repository](https://github.com/awslabs/filemoverexpress)
2. **AWS Support Center**: [AWS Support](https://console.aws.amazon.com/support/) (for AWS-related issues)
3. **Community Forums**: AWS community forums and Stack Overflow

### Before Contacting Support

1. **Search Existing Issues**: Check GitHub issues for similar problems
2. **Try Basic Solutions**: Restart application, check configuration
3. **Gather Information**: Collect all relevant diagnostic information
4. **Test Isolation**: Try to reproduce with minimal configuration

## Next Steps

- **[Performance Optimization](Performance-Optimization)** - Tune for better performance
- **[Best Practices](Best-Practices)** - Prevent common issues
- **[Security](Security)** - Secure your File Mover Express deployment