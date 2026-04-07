# Security

Security is a top priority for File Mover Express. This document outlines security considerations, best practices, and how to report security vulnerabilities.

## Security Model

File Mover Express operates under AWS's shared responsibility model:

- **AWS Responsibility**: Security of the cloud infrastructure (S3, IAM, KMS, etc.)
- **Your Responsibility**: Security in the cloud (credentials, access policies, data encryption, network security)

## Security Features

### Data Protection

**Encryption in Transit:**
- All data transfers to/from S3 use HTTPS/TLS encryption
- Remote daemon connections require TLS certificates
- No data is transmitted in plain text over networks

**Encryption at Rest:**
- Supports S3 server-side encryption (SSE-S3, SSE-KMS)
- Local checksum database uses file system security
- Configuration files should be protected with appropriate permissions

**Data Integrity:**
- Checksum verification ensures file integrity during transfers
- Multiple checksum algorithms supported (MD5, XXHash, XXH3)
- Automatic retry on checksum mismatches

### Access Control

**AWS IAM Integration:**
- Uses AWS IAM for S3 bucket access control
- Supports IAM roles, users, and policies
- Compatible with AWS IAM Identity Center (SSO)
- Follows principle of least privilege

**Credential Management:**
- Uses AWS CLI profiles for credential storage
- Supports temporary credentials and session tokens
- No hardcoded credentials in application
- Credentials stored using AWS CLI security standards

**Remote Daemon Security:**
- All remote connections are encrypted using TLS — this is required and cannot be disabled
- Access is protected by a password you choose (pre-shared key / PSK)
- Your PSK is never stored in plain text — it must be encrypted before saving to the config file using `filemoverexpress crypto encrypt`
- The daemon unlocks your PSK at startup using a secret passphrase you store as the `FME_PSK_SECRET` environment variable, keeping sensitive credentials out of config files
- Use `blocked_paths` to prevent remote users from accessing sensitive folders on the host machine
- Use `permissions` to control what actions remote users are allowed to perform

## Security Best Practices

### Credential Security

**AWS Credentials:**
- Use IAM roles instead of long-term access keys when possible
- Rotate access keys regularly
- Use AWS IAM Identity Center for enterprise environments
- Never commit credentials to version control
- Use temporary credentials for enhanced security

**Configuration Security:**
```bash
# Set appropriate file permissions
chmod 600 ~/.filemoverexpress/configuration.yaml
chmod 700 ~/.filemoverexpress/
```

### Network Security

**Remote Daemon:**
- Always use TLS for remote daemon connections
- Use strong pre-shared keys (follow NIST guidelines)
- Implement proper firewall rules
- Consider VPN for additional security layers
- Restrict daemon access to trusted networks only

**Firewall Configuration:**
- Allow outbound HTTPS (443) to AWS S3 endpoints
- Allow daemon ports only from trusted sources
- Block unnecessary inbound connections
- Monitor network traffic for anomalies

### S3 Bucket Security

**Bucket Policies:**
- Use least-privilege IAM policies
- Implement bucket policies for additional protection
- Enable S3 Block Public Access settings
- Use S3 Access Points for fine-grained control

**Encryption:**
- Enable S3 default encryption
- Use AWS KMS keys for enhanced key management
- Consider customer-managed KMS keys for cross-account access
- Enable S3 Bucket Key for cost optimization

**Monitoring:**
- Enable AWS CloudTrail for API logging
- Use S3 access logging
- Monitor for unusual access patterns
- Set up alerts for security events

### Application Security

**File System Security:**
- Protect configuration and database files
- Use appropriate file permissions
- Avoid running as privileged user
- Implement path restrictions for remote daemon

**Input Validation:**
- File paths are validated and sanitized
- Configuration parameters are validated
- Network inputs are properly handled
- Error messages don't expose sensitive information

## Security Configuration

### Minimal IAM Policy

For S3 access with customer-managed KMS key:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "S3Access",
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:ListBucket",
                "s3:GetBucketLocation",
                "s3:GetObjectTagging"
            ],
            "Resource": [
                "arn:aws:s3:::your-bucket-name",
                "arn:aws:s3:::your-bucket-name/*"
            ]
        },
        {
            "Sid": "KMSAccess",
            "Effect": "Allow",
            "Action": [
                "kms:Decrypt",
                "kms:GenerateDataKey"
            ],
            "Resource": "arn:aws:kms:region:account:key/key-id"
        }
    ]
}
```

### Secure Remote Daemon Configuration

```yaml
api_server:
  remote:
    enabled: true
    key: "<encrypted-psk>"  # Must be AES-GCM encrypted — use: filemoverexpress crypto encrypt
    address: "0.0.0.0"  # Or specific IP for restricted access
    ports: 50006
  tls:
    enabled: true  # Required for remote daemon
    certificate_file: "/path/to/cert.pem"
    key_file: "/path/to/key.pem"
  blocked_paths:
    - ".aws"
    - ".ssh"
    - "/etc"
    - "/root"
    - "sensitive-directory"
  permissions:
    allow_ui_configuration: false  # Restrict configuration changes
    allow_local_rename_delete: false  # Restrict file operations
    allow_remote_rename_delete: false  # Restrict S3 operations
```

### TLS Certificate Setup

**Generate Self-Signed Certificate (Development Only):**
```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

**Production Certificates:**
- Use certificates from trusted Certificate Authority
- Implement proper certificate validation
- Set up certificate rotation procedures
- Monitor certificate expiration

## Vulnerability Reporting

### Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

**DO NOT** create a public GitHub issue for security vulnerabilities.

**Instead, please:**

1. **Email**: Send details to the project maintainers (check repository for current contact)
2. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Suggested mitigation (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours of report
- **Initial Assessment**: Within 5 business days
- **Regular Updates**: Every 5 business days until resolution
- **Resolution**: Coordinated disclosure after fix is available

### Scope

**In Scope:**
- File Mover Express application code
- Configuration security issues
- Authentication/authorization bypasses
- Data exposure vulnerabilities
- Remote code execution
- Privilege escalation

**Out of Scope:**
- AWS service vulnerabilities (report to AWS)
- Third-party dependencies (report to respective projects)
- Social engineering attacks
- Physical security issues
- Denial of service attacks

## Security Updates

### Staying Informed

- **GitHub Releases**: Monitor for security updates
- **Security Advisories**: Subscribe to repository security advisories
- **Dependencies**: Keep dependencies updated
- **AWS Security Bulletins**: Monitor AWS security announcements

### Update Process

1. **Monitor**: Watch for security updates
2. **Test**: Validate updates in non-production environment
3. **Deploy**: Apply updates promptly
4. **Verify**: Confirm security improvements

## Compliance Considerations

### Data Residency

- File Mover Express transfers data to specified AWS regions
- Ensure compliance with data residency requirements
- Consider AWS regions for regulatory compliance

### Audit Requirements

- Enable AWS CloudTrail for audit logging
- Implement S3 access logging
- Maintain transfer logs as required
- Document security configurations

### Industry Standards

File Mover Express can support compliance with:
- SOC 2 (with proper AWS configuration)
- ISO 27001 (with appropriate controls)
- GDPR (with proper data handling)
- HIPAA (with AWS Business Associate Agreement)

## Security Monitoring

### Recommended Monitoring

**AWS CloudWatch:**
- Monitor S3 API calls
- Track unusual access patterns
- Set up alerts for security events

**Application Logs:**
- Monitor failed authentication attempts
- Track configuration changes
- Alert on error patterns

**Network Monitoring:**
- Monitor network traffic patterns
- Detect unusual data transfer volumes
- Track connection sources

### Incident Response

**Preparation:**
- Document incident response procedures
- Identify key personnel and contacts
- Prepare communication templates

**Detection:**
- Implement monitoring and alerting
- Regular security assessments
- User training on security awareness

**Response:**
- Immediate containment procedures
- Evidence preservation
- Communication protocols
- Recovery procedures

## Additional Resources

### AWS Security Resources

- [AWS Security Best Practices](https://aws.amazon.com/security/security-resources/)
- [S3 Security Best Practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html)
- [IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [AWS Well-Architected Security Pillar](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/welcome.html)

### Security Tools

- **AWS Config**: Monitor configuration compliance
- **AWS Security Hub**: Centralized security findings
- **AWS GuardDuty**: Threat detection service
- **AWS Inspector**: Application security assessment

### Community Security

- Report security issues responsibly
- Participate in security discussions
- Share security best practices
- Contribute to security documentation

## Questions?

For security-related questions:
- Review this security documentation
- Check [AWS security documentation](https://aws.amazon.com/security/)
- Contact project maintainers for specific concerns
- Use GitHub Discussions for general security topics (non-sensitive)

Remember: When in doubt about security, err on the side of caution and seek expert advice.