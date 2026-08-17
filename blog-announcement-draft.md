# Introducing File Mover Express: open source high-performance file transfer to Amazon S3 for media workflows

*Draft — for review*

Media production teams routinely move terabytes of assets between on-premises storage and the cloud. Whether it is a digital imaging technician (DIT) offloading camera cards on set, a post-production facility feeding an archive, a content creator pushing dailies for review, or the production operations and pipeline engineers who keep all of that running, these workflows share a common set of challenges: transfers are large, deadlines are tight, and the person who starts a transfer is often not the person, or the machine, that finishes it. Traditional transfer clients tie the transfer to a desktop session, so a closed laptop lid or an expired session can mean hours of lost progress. Commercial alternatives solve some of these problems, but often at the cost of per-seat licensing, proprietary protocols, or routing your content through third-party infrastructure.

Today, we are announcing **File Mover Express (FME)**, an open source, high-performance file transfer application that accelerates media asset workflows between local systems and [Amazon Simple Storage Service (Amazon S3)](https://aws.amazon.com/s3/). File Mover Express is available now on [GitHub](https://github.com/awslabs/filemoverexpress) under the Apache 2.0 license, with installers for macOS, Windows, and Linux.

In this post, we introduce File Mover Express, explain the value it delivers for media workflows, and show you how to get started with your first transfer.

## Solution overview

At the core of File Mover Express is a daemon-based transfer engine that decouples transfers from your desktop session. The daemon can run on any machine, whether that is your workstation, a server in the data center, or an [Amazon Elastic Compute Cloud (Amazon EC2)](https://aws.amazon.com/ec2/) instance, while you control it from a drag-and-drop GUI or a scriptable command line interface (CLI) over an encrypted, password-protected connection. You can start a transfer from your laptop on set, disconnect, and check on its progress from the facility later. The daemon continues the work.

Transfers go directly to Amazon S3 using native S3 APIs, with no intermediary servers, no relay infrastructure, and no third-party services in the data path. Large files are automatically split into chunks and uploaded in parallel using multipart upload, with auto-tuned parallelism, configurable retries, and the ability to pause and resume active transfers. Transfers work in both directions: the same engine that uploads camera originals can pull footage back down from Amazon S3 for conform, review, or restore. File Mover Express runs on macOS, Windows, and Linux, including headless Linux servers, and works with any AWS Region where Amazon S3 is available.

## Why File Mover Express

### Your time back: transfers that finish without you

The most expensive part of a slow transfer is rarely the bandwidth. It is the person waiting on it. Because File Mover Express auto-tunes its parallelism to saturate the available connection, and because the daemon keeps running after you disconnect, transfers finish on the network's schedule instead of yours. Pause and resume means an interrupted 4 TB upload picks up where it left off rather than starting over, and configurable retries mean transient network failures are absorbed silently instead of paging someone at 2 AM.

Hot folders extend this further: point File Mover Express at a folder and it automatically uploads anything new that appears. A DIT can offload camera cards into a watch folder and walk away. Footage flows to Amazon S3 with no manual step, turning camera-to-cloud from a job someone does into something that simply happens.

Saturating the connection does not have to mean monopolizing it. Bandwidth throttling lets you cap how much of the network File Mover Express uses, so a large overnight archive push can share a facility connection with video calls and remote editing sessions instead of competing with them.

### Lower cost and no lock-in: direct to S3, open source, standard formats

File Mover Express transfers data directly between your systems and your S3 buckets. There are no per-seat licenses, no subscription fees, and no third-party relay servers adding cost or latency. You pay only for the AWS resources you already use. Because content lands in Amazon S3 as standard objects, it is immediately available to the rest of your pipeline: AWS media services for processing, or any tool that speaks the S3 API. You can also upload directly to any [Amazon S3 storage class](https://aws.amazon.com/s3/storage-classes/), so archive footage can go straight to Amazon S3 Glacier storage classes and start earning archive economics from the first byte, with no lifecycle transition step. For archivists and media asset managers, built-in S3 inventory generation produces detailed reports of bucket contents, so you always know what is in the archive. Your assets are never held in a proprietary format or a vendor's cloud.

The application itself is Apache 2.0 licensed and developed in the open. You can audit the code that handles your content, build it yourself, extend it to fit your pipeline, and contribute improvements back. For studio IT and security teams evaluating tools against content-security requirements, an open codebase and a data path with no third-party services in it make the review straightforward: there is no black box between your storage and your bucket. That is a level of transparency and control that closed transfer tools cannot offer.

### Trust in every frame: verification built for media

Media workflows depend on a verifiable chain of custody, because an unverified transfer is a liability, not a backup. File Mover Express includes optional checksumming with XXH3 (the fastest option), plus XXHash, XXHash64, and MD5 for workflows that require them. It also reads Media Hash List (MHL) files, the industry-standard manifest format for camera originals, so integrity can be confirmed continuously from card to bucket. When the footage lands in Amazon S3, you can prove it is bit-for-bit what came off the camera.

### Security aligned with how you already run AWS

All transfers use HTTPS, and access to your S3 buckets is governed by [AWS Identity and Access Management (IAM)](https://aws.amazon.com/iam/) with a documented minimum-permission policy. That means the same credentials, policies, and audit story you use for the rest of your AWS environment, with no separate account system to manage. File Mover Express also works with S3 server-side encryption, including SSE-S3 and SSE-KMS with customer-managed keys, so content is protected at rest under your key policy.

Remote daemon connections require TLS, which cannot be disabled, and are protected by a pre-shared key that is never stored in plain text. macOS builds are signed and notarized with Amazon's Apple Developer ID, and Windows installers are Authenticode-signed, so your team installs verified software without Gatekeeper workarounds.

### One engine, three ways to drive it

File Mover Express meets each member of the team where they work. Artists and DITs get a drag-and-drop GUI. Pipeline developers and operations engineers get a full CLI for scripting, automation, and headless server deployments, so File Mover Express can slot into existing media asset management and orchestration workflows rather than replacing them. And because File Mover Express ships with a built-in [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server, anyone with an MCP-compatible AI assistant such as Claude Desktop, Kiro, or Cursor can manage transfers conversationally:

- "Upload everything in `/Volumes/Media/DailyRushes` to my production profile."
- "List my active transfers and pause the one going to the archive bucket."
- "Browse my S3 bucket and download the footage from last Tuesday."

All three interfaces connect to the same daemon, so there is no duplicate transfer logic to maintain. After a short one-time setup, transfer profiles, checksums, hot folders, and tuning settings work identically whether the request comes from a mouse, a script, or a sentence. The daemon even watches its configuration file and applies changes automatically, with no restart required. For teams adopting AI assistants in their pipelines, this makes file movement AI-native infrastructure out of the box rather than another integration project.

*(Screenshot/GIF placeholder: MCP conversation in Claude Desktop starting an upload)*

## Getting started

To start transferring files with File Mover Express, complete the following steps:

1. **Install File Mover Express** – Download a pre-built installer from the [Releases page](https://github.com/awslabs/filemoverexpress/releases) and run it.
2. **Set up AWS** – Create an S3 bucket, apply the [minimum IAM policy](https://github.com/awslabs/filemoverexpress/blob/main/docs/Security.md), and configure your credentials with `aws configure`.
3. **Configure a destination** – Launch File Mover Express and add a Remote Configuration pointing to your S3 bucket.
4. **Start transferring** – Drag files into the GUI, script transfers with the CLI, or ask your AI assistant.

*(Screenshot placeholder: drag-and-drop GUI with an active transfer)*

For a complete walkthrough of your first transfer, see the [Getting Started guide](https://github.com/awslabs/filemoverexpress/blob/main/docs/Getting-Started.md). Dedicated guides are available for the [GUI](https://github.com/awslabs/filemoverexpress/blob/main/docs/Using-the-GUI.md), the [CLI](https://github.com/awslabs/filemoverexpress/blob/main/docs/Using-the-CLI.md), and the [MCP server](https://github.com/awslabs/filemoverexpress/blob/main/docs/MCP-Server.md).

## Conclusion

In this post, we introduced File Mover Express, an open source, high-performance file transfer application for media workflows built on Amazon S3. By decoupling transfers from the desktop session, automating ingest with hot folders, verifying integrity with MHL-aware checksumming, and offering GUI, CLI, and AI assistant interfaces over a single engine, File Mover Express helps media teams move large assets to the cloud faster, more reliably, and at lower cost, without giving up control of their content or their tooling.

File Mover Express is developed in the open under the Apache 2.0 license, and contributions are welcome. See the [contributing guidelines](https://github.com/awslabs/filemoverexpress/blob/main/CONTRIBUTING.md) and [Development guide](https://github.com/awslabs/filemoverexpress/blob/main/docs/Development.md) to get involved.

To get started, download File Mover Express from the [Releases page](https://github.com/awslabs/filemoverexpress/releases) today.

---

*About the authors — placeholder for author bios and headshots.*
