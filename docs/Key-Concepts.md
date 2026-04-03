# Key Concepts and Terminology

Understanding these key concepts will help you effectively use File Mover Express.

## Core Concepts

**File Mover Express** – A file transfer tool for accelerating media asset transfer workflows into and out of Amazon Simple Storage Service (Amazon S3).

**File Mover Express GUI** – The graphical user interface that allows you to transfer files to and from Amazon S3 and view data about your transfers.

**Session** – A period of time in which you can upload or download files from Amazon S3. Your session status is indicated by the check mark icon next to the remote configuration for your S3 Bucket. You must have an active session to transfer files.

**Remote Configuration** – Different configurations available to transfer files to different buckets or directories. Use remote configurations to differentiate between destinations and teams for the same, or different, productions.

## Job Management

**Job queue** – When you start a transfer, File Mover Express displays a list of transfer jobs corresponding to the individual files or folders selected for transfer.

**Filter** – Filter by transfer status to adjust which files are displayed in the upload and download queues.

**Active** – Reports the current amount of data uploaded and downloaded across all jobs in your session.

**Avg. Speed** – Reports the average speed of all file uploads and downloads in your session.

**Session Total** – Reports the total amount of all planned data uploaded and downloaded for all jobs in your session.

**Size** – Reports the total size of the job.

**ETA** – Records the estimated completion time of a job.

**Start time** – Reports when a job was started.

**Progress** – Reports the status of a given job.

## File Integrity

**[Checksum](Checksums)** – Validates that the file is still unmodified at a future date and ensures file integrity during transfer.

## AWS Services

**Amazon Simple Storage Service** – [Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html) is an object storage service that offers scalability, data availability, security, and performance. File Mover Express uploads files to Amazon S3 using Amazon S3 APIs and provides better performance than the AWS CLI with built-in checksumming.

**AWS Identity and Access Management** – [AWS IAM](https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html) is a web service that helps you securely control access to AWS resources. File Mover Express relies on IAM to limit who has access to your Amazon S3 bucket.

**AWS managed policies** – Standalone policies created and administered by AWS with their own Amazon Resource Name (ARN). These are used for granting permissions to common job functions and are maintained by AWS when new services are introduced.

## Geographic Distribution

**AWS Regions** – File Mover Express is available in all global Regions. Users close to the Region where your S3 bucket is located will experience faster upload and download speeds. For more information, see [Amazon S3 endpoints and quotas](https://docs.aws.amazon.com/general/latest/gr/s3.html).

**Availability Zone (AZ)** – Multiple, isolated locations within each AWS Region. An AZ is represented by an AWS Region code followed by a letter identifier (e.g., `us-east-1a`).

## Next Steps

- Learn about [Setting Up File Mover Express](Setup)
- Understand [Configuration Options](Configuration)
- Explore [Best Practices](Best-Practices)