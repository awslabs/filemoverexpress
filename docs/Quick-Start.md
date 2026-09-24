# Quick Start

Get File Mover Express up and running quickly. This guide is designed for artists and creative professionals who need to transfer files to the cloud with minimal setup complexity.

## What You Need

Before starting, make sure you have:

- [ ] **File Mover Express installer** (download from [GitHub releases](https://github.com/awslabs/filemoverexpress/releases))
- [ ] **Studio connection settings** (provided by your IT team)
- [ ] **AWS credentials** (Access Key and Secret Key from your studio or IT department)

> **Don't have these?** Ask your IT team or studio manager for the "File Mover Express setup package" - they should provide everything you need.

## Step 1: Install File Mover Express

### macOS
1. **Download** the installer from your studio or [GitHub releases](https://github.com/awslabs/filemoverexpress/releases)
2. **Double-click** the installer file
3. **Follow the setup wizard** - click "Continue" and "Install"
4. **Enter your password** when prompted
5. **Click "Close"** when installation completes

### Windows
1. **Download** the installer from your studio or [GitHub releases](https://github.com/awslabs/filemoverexpress/releases)
2. **Double-click** the installer file
3. **Follow the setup wizard** - click "Next" through the prompts
4. **Click "Install"** and wait for completion
5. **Click "Finish"** when done

## Step 2: Launch File Mover Express

### macOS
- **Open Applications folder** and double-click **File Mover Express**
- If you see a security warning, go to **System Preferences > Security & Privacy** and click **"Open Anyway"**

### Windows
- **Click Start menu** and search for **"File Mover Express"**
- **Click the application** to launch it

### Linux
- **Open Terminal** and run: `./fme`

## Step 3: Set Up Your Studio Connection

### If Your Studio Provided a Configuration File
Your IT team may have given you a pre-configured `configuration.yaml` file:

1. **Close File Mover Express** if it's running
2. **Navigate to your configuration folder:**
   - **macOS**: Press `Cmd+Shift+G`, type `~/.filemoverexpress`
   - **Windows**: Navigate to `C:\Users\[username]\.filemoverexpress`
   - **Linux**: Navigate to `~/.filemoverexpress`
3. **Replace the existing `configuration.yaml`** with the file from your studio
4. **Restart File Mover Express**

**✅ Success indicator:** You should see your studio's cloud storage appear in the right panel with a **green checkmark**.

### If You Need to Set Up the Connection Manually

### Create Your Remote Configuration
1. **Click "Create a Remote Configuration"** in the right panel (S3 Bucket browser)
2. **Fill in the required information:**
   - **Remote Configuration name**: `My Studio` (or whatever makes sense)
   - **S3 Bucket**: `your-studio-bucket-name` (provided by IT)
   - **AWS Region**: Select your region from the dropdown (e.g., `us-west-2`)
   - **AWS named profile**: `my-studio` (the profile name you created above)
3. **Click "Add"** to save the configuration

> **Note**: The AWS named profile field is required - you must have set up AWS CLI credentials first.

### Setting Up AWS Credentials (Required)
File Mover Express requires AWS CLI named profiles for security. If your studio gave you AWS credentials, you'll need to set up a named profile first:

1. **Install AWS CLI** if not already installed:
   - **macOS**: `brew install awscli` or download from [AWS CLI page](https://aws.amazon.com/cli/)
   - **Windows**: Download installer from [AWS CLI page](https://aws.amazon.com/cli/)
   - **Linux**: `sudo apt install awscli` or use your package manager

2. **Open Terminal** (macOS/Linux) or **Command Prompt** (Windows)
3. **Create a named profile** with your studio credentials:
   ```bash
   aws configure --profile my-studio
   ```
4. **Enter your credentials when prompted:**
   - AWS Access Key ID: `[paste your access key]`
   - AWS Secret Access Key: `[paste your secret key]`
   - Default region: `us-west-2` (or your studio's region)
   - Default output format: `json`

5. **Test your profile** to make sure it works:
   ```bash
   aws --profile my-studio sts get-caller-identity
   ```

> **Important**: File Mover Express only uses AWS CLI named profiles for security reasons. You cannot enter Access Keys directly in the application.

## Step 4: Test Your Connection

1. **Look at the right panel** (S3 Bucket browser)
2. **Check for a green checkmark** next to your studio connection
3. **Try browsing** - you should see folders or files in your studio's cloud storage

**✅ Success indicator:** You can see your studio's cloud folders and the connection shows "Connected" status.

## Your First File Transfer

Now you're ready to transfer files!

### Upload Files to the Cloud
1. **Left panel**: Navigate to your files (camera cards, project folders, etc.)
2. **Right panel**: Navigate to where you want to store files in the cloud
3. **Drag and drop** files from left to right
4. **Watch the progress** in the "Jobs" tab at the bottom

### Download Files from the Cloud
1. **Right panel**: Navigate to files in the cloud storage
2. **Left panel**: Navigate to where you want to save files locally
3. **Drag and drop** files from right to left
4. **Watch the progress** in the "Jobs" tab at the bottom

## 🎉 You're Done!

**Congratulations!** You can now transfer files between your computer and the cloud. File Mover Express will:

- ✅ **Verify file integrity** with automatic checksums
- ✅ **Resume interrupted transfers** automatically
- ✅ **Show real-time progress** and transfer speeds
- ✅ **Handle large files** efficiently with parallel uploads

## Common Workflows

**Upload workflows:** Drag files from left panel (local) to right panel (cloud) - camera cards, dailies, completed projects for archival.

**Download workflows:** Drag files from right panel (cloud) to left panel (local) - latest edits from team, shared assets like templates and logos.

**Monitor progress:** Use the Jobs tab to track transfers, pause/resume as needed.

## Need Help?
- **Ask your IT team** - they know your studio's specific setup
- **Check the [Troubleshooting Guide](Troubleshooting)** for common issues
- **Generate a support file** from Settings menu to share with IT

### Learn More
- **[Using the GUI](Using-the-GUI)** - Detailed interface guide
- **[Hot Folders](Hot-Folders)** - Automatic upload setup
- **[Best Practices](Best-Practices)** - Tips for optimal performance

---

## Studio IT: Quick Deployment

**For IT administrators setting up multiple users:**

### Pre-Configure Settings
Create a `configuration.yaml` file with your settings:
```yaml
apiServer:
  blockedPaths:
    - .aws
    - .filemoverexpress
    - /dev
    - /etc
  enabled: true  # Required for GUI functionality
  permissions:
    allowLocalRenameDelete: false
    allowRemoteRenameDelete: false
    allowUIConfiguration: false
  remote:
    enabled: false
  tls:
    enabled: false

general:
  maxActiveChecksums: 11
  maxActiveTransfers: 10
  no_sleep: false
  retry_count: 3
  target_bandwidth: 0

hotFolders: []

logging:
  compress: true
  directory: logs
  max_age: 31
  max_size: 50
  severity: info

protocols:
  s3:
    transferProfiles:
      your-config-name:  # CHANGE: Choose a unique profile name
        accelerated: false
        autoTuning: true
        bucket: "your-studio-bucket"  # CHANGE: Your actual S3 bucket name
        checksums:
          algorithm: none  # Default: off (admin can enable if needed)
          enabled: false   # Default: off (admin can enable if needed)
        chunkSize: 25
        enableMetadataFilter: true
        endpoint: ""
        fileOrder: []
        filter: ""
        maxAge: ""
        name: "Your Studio Name"  # CHANGE: Display name for users
        paths:
          local: ""
          remote: ""
        profile: "your-aws-profile"  # CHANGE: AWS CLI profile name
        region: "us-west-2"  # CHANGE: Your AWS region
        storageClass: "standard"  # CHANGE: Choose storage class (standard, glacier, etc.)
        threads: 10

reports:
  directory: reports
```

### Customize the Configuration
Before distributing, update these required fields:

**Required Changes:**
- `your-config-name`: Choose a unique profile identifier (e.g., `studio-main`)
- `your-studio-bucket`: Your actual S3 bucket name
- `Your Studio Name`: Display name users will see (e.g., `Studio Main Storage`)
- `your-aws-profile`: AWS CLI profile name users should create
- `us-west-2`: Your AWS region
- `standard`: Storage class (`standard`, `standard_ia`, `glacier`, etc.)

**Optional Settings (defaults shown):**
- `checksums.enabled: false`: Enable if you need file integrity verification
- `checksums.algorithm: none`: Choose based on your performance needs:
  - `xxh3`: **Fastest** - Recommended for most users
  - `xxhash` or `xxhash64`: **Fast** - Good balance of speed and reliability
  - `md5-hex`: **Slowest** - Legacy option, can significantly impact transfer speeds
- `maxActiveTransfers: 10`: Adjust based on your network capacity
- `maxActiveChecksums: 11`: Adjust based on CPU capacity

### Performance Considerations

**Checksum Algorithm Performance:**
- **xxh3**: Up to 10x faster than MD5, recommended for high-throughput workflows
- **xxhash/xxhash64**: 3-5x faster than MD5, good for most production environments  
- **md5-hex**: Slowest option, can reduce transfer speeds by 50%+ on large files

**When to Enable Checksums:**
- **Critical media**: Enable for irreplaceable content (camera originals, final deliverables)
- **High-volume workflows**: Consider disabling or using xxh3 for speed
- **Compliance requirements**: Some workflows may require specific algorithms

**Performance Impact:**
- **Disabled**: Maximum transfer speed
- **xxh3 enabled**: Minimal speed impact (5-10% slower)
- **md5-hex enabled**: Significant speed impact (30-50% slower on large files)

### Distribute to Users
1. **Customize the configuration** with your studio's settings
2. **Email the config file** with installation instructions
3. **Include AWS credentials** or pre-configured AWS CLI profiles  
4. **Provide this Quick Start guide** as reference
5. **Include instructions** for replacing the configuration file in the user's `.filemoverexpress` folder

### Bulk AWS Setup
Use the [Setup Guide](Setup) to create:
- S3 buckets with proper permissions
- IAM policies for user access
- AWS CLI profiles for easy distribution

This approach gets your entire team up and running in minutes instead of hours.