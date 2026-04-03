# Configuration

File Mover Express can be configured using either the graphical user interface (GUI) or by editing the configuration file directly. This guide covers both methods.

## GUI Configuration

If you use an operating system with a desktop, you can configure File Mover Express through the GUI.

### Adding a Remote Configuration

Before you can transfer files with File Mover Express, you must add a remote configuration.

#### To add a remote configuration using the GUI

1. When you first open the application and do not have a remote configuration set up yet, select **Create a Remote Configuration** on the S3 Bucket file browser window.

2. Enter the following information in the "Add Remote Configuration" section and choose **Add**:

   **Basic Settings:**
   - **Remote Configuration name**: A name for your Remote Configuration. This can be anything, but cannot be changed later.
   - **S3 Bucket**: The name of the S3 bucket that you want to upload to and download from.
   - **AWS Region**: The AWS Region that your S3 bucket is located in.
   - **AWS named profile**: An AWS named profile to use for S3 access. If you choose to use an AWS Access Key or Secret Key instead, you can leave this field blank.

3. Configure the following **Advanced** settings:

   **Storage and Transfer Settings:**
   - **Storage Class**: The storage class to upload to. For more information, see [S3 Storage Classes](https://aws.amazon.com/s3/storage-classes/)
   - **Checksum Algorithm**: Determines which checksum algorithm is used for file integrity verification
   - **Local directory** (optional): The default directory to start browsing on your machine
   - **S3 bucket prefix** (optional): The default S3 directory to start browsing in

   **Filtering Options:**
   - **Filter**: Filter files based on format using valid regular expressions. Example: `^.*\.(mov)$` only uploads files ending in .mov
   - **Max Age**: Defines maximum time period for files. Acceptable units are m, h, d, and w (minutes, hours, days, weeks). Example: "2d" will process files from the last 2 days
   - **File order list** (optional): Type a file extension and press Enter to define transfer priority. Extensions not listed are transferred last.

   **Network and Performance:**
   - **S3 Access Point/VPC Endpoint**: The address of your endpoint (e.g., `vpce-1a2b3c4d-5e6f.s3.us-east-1.vpce.amazonaws.com`)
   - **Transfer autotuning**: Enabled by default, dynamically sets number of threads and chunk size. We recommend keeping it enabled.
     - **Number of threads**: Number of individual threads used to transfer each file
     - **Chunk size**: Size of the chunk (in megabytes) delivered by each thread
   - **Use S3 Transfer Acceleration**: When enabled, transfers will use S3 Transfer Acceleration
   - **Enable metadata filter**: When enabled, automatically filters system metadata files (files starting with `._`, `thumbs.db`, `.DS_Store`)

4. Choose **Save**.

## CLI Configuration

If you aren't using an OS with a desktop, you can configure File Mover Express using the command line interface.

### Editing the Configuration File

#### To edit the configuration file

1. **Open the configuration file** with any text editor:
   - **Windows**: Navigate to `User/<your username>/.filemoverexpress/filemoverexpress.yaml`
   - **macOS**: Press `Cmd+Shift+G`, enter `~/.filemoverexpress`, open `configuration.yaml`
   - **Linux**: Open `~/.filemoverexpress/configuration.yaml`

2. **Define global settings** in the configuration file:
   ```yaml
   max_active_checksums: 8  # Number of checksums processed simultaneously
   max_active_transfers: 10  # Number of files processed simultaneously
   ```

3. **Define at least one remote configuration**:
   ```yaml
   protocols:
     s3:
       transfer_profiles:
         - name: "my-configuration"
           bucket: "my-s3-bucket"
           region: "us-west-2"
           profile: "my-aws-profile"
           storage_class: "standard"
           auto_tuning: true
           checksum_algorithm: "md5-hex"
   ```

### Configuration Parameters

#### Required Parameters

- **name**: Name for your remote configuration
- **bucket**: S3 bucket name for uploads and downloads
- **region**: AWS Region where your bucket is located
- **profile**: AWS named profile for S3 access

#### Optional Parameters

**Storage Settings:**
- **storage_class**: Storage class for uploads (default: `standard`)
  - Accepted values: `reduced_redundancy`, `standard_ia`, `onezone_ia`, `intelligent_tiering`, `glacier`, `deep_archive`, `glacier_ir`

**Performance Settings:**
- **auto_tuning**: Automatically tune chunk size and threads (default: `true`)
- **chunk_size**: Chunk size in MB (not required if auto_tuning is true)
- **threads**: Number of threads per file (not required if auto_tuning is true)

**File Processing:**
- **checksum_algorithm**: Algorithm for file integrity (default: `md5-hex`)
  - Options: `md5-hex`, `xxhash`, `xxhash64`, `xxh3`
- **max_age**: Only transfer files within time window (e.g., `2d`, `3500`)
- **file_order**: Comma-separated file extensions for transfer priority (e.g., `".mov,.txt"`)
- **filter**: Regular expression for file filtering (e.g., `"^.*\.(mov)$"`)
- **enable_metadata_filter**: Filter system metadata files (default: `false`)

**Network Settings:**
- **accelerated**: Use S3 Transfer Acceleration (default: `false`)

**Path Settings:**
- **paths**:
  - **local**: Default local path for transfers
  - **remote**: Default S3 path for transfers

### Hot Folder Configuration

Configure hot folders to automatically upload files when they're added to monitored directories:

```yaml
hot_folders:
  - enabled: true
    local_source_folder: /Users/user/myhotfolder
    name: my_hot_folder
    remote_configurations:
      - remote_configuration_name: example_configuration
        s3_destination_folder: my/s3/prefix
```

### API Server Configuration

Configure the API server for GUI connectivity:

```yaml
api_server:
  enabled: true  # Required for GUI functionality
  remote:
    enabled: false  # Set to true for remote daemon
    key: "your-secure-key"
    ports: 50006
    address: "0.0.0.0"
  tls:
    enabled: false  # Set to true for remote daemon
    certificate_file: "/path/to/cert.pem"
    key_file: "/path/to/key.pem"
```

## Validating Configuration

After configuring File Mover Express, validate your setup:

```bash
filemoverexpress validate-credentials [remote-configuration-name]
```

This command:
- Checks your AWS credentials
- Verifies File Mover Express can connect to Amazon S3
- Lists objects in the specified bucket

## Configuration File Location

The configuration file is located at:
- **Windows**: `C:\Users\username\.filemoverexpress\configuration.yaml`
- **macOS/Linux**: `~/.filemoverexpress/configuration.yaml`

You can override the default location using the `filemoverexpress_CONFIG_DIR` environment variable.

## Next Steps

After configuration:
- [Getting Started](Getting-Started) - Learn basic usage
- [Using the GUI](Using-the-GUI) - Explore the graphical interface
- [Using the CLI](Using-the-CLI) - Learn command-line operations