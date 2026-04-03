# Security Policy

## Supported Versions

We provide security updates for the following versions of File Mover Express:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability, please report it responsibly by following these steps:

### How to Report

1. **Email the maintainers** with details about the vulnerability
2. **Include the following information**:
   - Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
   - Full paths of source file(s) related to the manifestation of the issue
   - The location of the affected source code (tag/branch/commit or direct URL)
   - Any special configuration required to reproduce the issue
   - Step-by-step instructions to reproduce the issue
   - Proof-of-concept or exploit code (if possible)
   - Impact of the issue, including how an attacker might exploit the issue

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 48 hours
- **Initial Response**: We will provide an initial response within 5 business days indicating the next steps
- **Updates**: We will keep you informed of our progress every 5 business days
- **Resolution**: We will work with you to understand and resolve the issue promptly

### Coordinated Disclosure

We follow a coordinated disclosure process:

1. **Investigation**: We investigate and confirm the vulnerability
2. **Fix Development**: We develop and test a fix
3. **Release**: We release the security update
4. **Public Disclosure**: We publicly disclose the vulnerability after users have had time to update

We ask that you:
- Give us reasonable time to investigate and fix the issue before public disclosure
- Make a good faith effort to avoid privacy violations, destruction of data, and interruption or degradation of our services
- Only interact with accounts you own or with explicit permission of the account holder

## Security Best Practices

For users of File Mover Express, we recommend:

### AWS Security
- Use IAM roles with least-privilege permissions
- Enable S3 bucket encryption
- Use AWS CloudTrail for audit logging
- Regularly rotate access keys

### Application Security
- Keep File Mover Express updated to the latest version
- Use TLS for remote daemon connections
- Protect configuration files with appropriate permissions
- Monitor transfer logs for unusual activity

### Network Security
- Use VPN for remote daemon access when possible
- Implement proper firewall rules
- Monitor network traffic for anomalies

## Security Features

File Mover Express includes several security features:

- **Encryption in Transit**: All data transfers use HTTPS/TLS
- **AWS IAM Integration**: Leverages AWS security model
- **Checksum Verification**: Ensures data integrity
- **Access Controls**: Configurable path restrictions for remote daemon
- **Audit Logging**: Comprehensive logging for security monitoring

## Additional Resources

- [AWS Security Best Practices](https://aws.amazon.com/security/security-resources/)
- [S3 Security Documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security.html)
- [File Mover Express Security Documentation](docs/Security.md)

## Questions?

If you have questions about this security policy or File Mover Express security in general, please create a GitHub Discussion or contact the maintainers.

Thank you for helping keep File Mover Express and our users safe!