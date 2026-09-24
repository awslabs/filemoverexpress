# File Mover Express for AWS

File Mover Express for AWS is a solution designed to accelerate media asset transfer workflows into and out of Amazon Simple Storage Service (Amazon S3). Digital imaging technicians (DIT) and content creators can use File Mover Express without needing AWS expertise. With File Mover Express you can transfer on-set camera data or final production archive data directly into Amazon S3 buckets.

## Quick Links

- [Getting Started](Getting-Started)
- [Installation](Installation)
- [Headless Linux Installation](Headless-Linux-Installation)
- [Configuration](Configuration)
- [Using the GUI](Using-the-GUI)
- [Using the CLI](Using-the-CLI)
- [OIDC / SSO Authentication](OIDC-Authentication)
- [MCP Server (AI Assistant Integration)](MCP-Server)
- [Best Practices](Best-Practices)
- [Troubleshooting](Troubleshooting)
- [Contributing](Contributing)
- [Security](Security)

## What Is File Mover Express?

File Mover Express can move large media files while preserving hierarchy structure and provides a native graphical user interface (GUI) for digital creatives.

With File Mover Express, you can transfer digital media between Amazon S3 and local storage over public and private network connections. You can move files from on-premises to AWS, and move them to different AWS Regions. File Mover Express works for any file system to Amazon S3. This means that you can also use File Mover Express on an Amazon Elastic Compute Cloud (Amazon EC2) instance to move data from Amazon Elastic Block Store (Amazon EBS) to Amazon S3.

Studios can use File Mover Express for camera to cloud, work in-progress synchronization, final media delivery, and archival workflows. All file transfers are encrypted at rest and in-transit based on how you define your Amazon S3 encryption policies.

## Key Features

- **Upload and Download files to/from Amazon S3** – End users can select files and folders to upload and download to/from their local file systems to/from Amazon S3
- **Drag and Drop Graphical User Interface (GUI)** - The GUI allows you to drag and drop files while uploading to and downloading from Amazon S3
- **Command Line Interface (CLI)** - The File Mover Express CLI gives you more control over configuration parameters, adjustments, flags, and scripting transfers into your workflows
- **High speed File Transfers** - File Mover Express offers parallelization and autotuning for maximum performance
- **Jobs Control Table** - Monitor your active transfer jobs and control them through the Jobs table with Cancel/Pause/Resume controls
- **Checksum Verification** - Verifies the integrity of files transferred to Amazon S3
- **Bucket Reports** - Export reports of files and folders in S3 buckets without needing to log into the AWS S3 console
- **Upload Hot Folder** – Designate folders on local storage for File Mover Express to monitor and automatically upload new content to Amazon S3
- **Remote daemon** – Use a remote daemon to start transfers from a different machine for better performance or multi-user scenarios
- **OIDC / SSO Authentication** – Sign in with your organization's identity provider (Okta, Microsoft Entra ID, Auth0, Ping, and others) to obtain temporary AWS credentials instead of managing long-lived access keys. See [OIDC / SSO Authentication](OIDC-Authentication)
- **Multiple AWS Regions** – Works with Amazon S3 in any available region
- **Bandwidth Throttling** - Set target average speeds to limit transfer speeds
- **MCP Server for AI Assistants** - Control transfers through natural language with any MCP-compatible AI assistant (Claude Desktop, Kiro, Cursor, etc.)

## Related Services

- **[Amazon Simple Storage Service (Amazon S3)](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html)** - File Mover Express uses Amazon S3 as its cloud storage with support for custom bucket policies and encryption
- **AWS Identity and Access Management (IAM)** - File Mover Express uses [AWS IAM](https://aws.amazon.com/iam/) to authorize access to S3 buckets

## Accessing File Mover Express

The File Mover Express source code can be accessed from the [GitHub repository](https://github.com/awslabs/filemoverexpress).

You can interact with File Mover Express using either:
- **Command Line Interface (CLI)** - Provides more control over configuration parameters and scripting capabilities
- **Graphical User Interface (GUI)** - Displays transfer job statuses, logs, and reports with drag-and-drop functionality

## Pricing

File Mover Express is provided at no additional cost. Amazon S3 standard rates for data transfers and storage apply. For pricing information, see the [Amazon S3 pricing page](https://aws.amazon.com/s3/pricing/).

## Support

File Mover Express is released as an open-source project. Support is provided on a **best-effort basis** through:

- **GitHub Issues**: Report bugs, request features, or ask questions at the [GitHub repository](https://github.com/awslabs/filemoverexpress)
- **AWS Support Center**: Access the [AWS Support Center](https://console.aws.amazon.com/support/) for general AWS resources