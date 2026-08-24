# Using the GUI

The File Mover Express graphical user interface provides an intuitive drag-and-drop experience for transferring files between your local system and Amazon S3.

## Interface Overview

The GUI consists of three main areas:

1. **Local File Browser (Left)** - Browse your local file system
2. **S3 Bucket File Browser (Right)** - Browse your S3 buckets  
3. **Bottom Panel** - Monitor jobs, view logs, and generate reports

## File Browsers

### Local File Browser (Left Side)

**File System Dropdown Options:**
- **Local file systems**: Your computer's drives and mounted storage
- **Favorite paths**: Bookmarked frequently-used directories
- **Remote daemons**: Connect to File Mover Express running on other machines

**Navigation:**
- Click folders to browse into them
- Use breadcrumb navigation to go back to parent directories
- Right-click for context menu options (favorites, hot folder configuration)

### S3 Bucket File Browser (Right Side)

**Remote Configuration Dropdown:**
- Select from configured S3 destinations
- Each configuration represents a specific bucket and settings
- The **Connected** indicator reflects whether the selected Remote Configuration can actually reach S3. If you edit a configuration so it can no longer list the bucket (wrong bucket, region, or credentials), the indicator turns to **Disconnected** and the panel shows the listing error. While a listing is in progress it shows **Connecting…**

**Authentication:**
- A Remote Configuration authenticates with either an AWS named profile / access keys or your organization's single sign-on. To use SSO, set the **Authentication method** to **OIDC / SSO** on the configuration's Authentication tab. See [OIDC / SSO Authentication](OIDC-Authentication) for setup.

**Navigation:**
- Browse S3 objects and prefixes like folders
- Navigate using breadcrumbs or double-clicking
- View object metadata and properties

## Uploading Files

File Mover Express uploads to all S3 storage classes. We recommend disabling sleep mode on your computer to prevent transfer interruptions.

### To start uploads using the GUI

1. **Open File Mover Express**

2. **Select source files**:
   - In the Local file browser, navigate to your files
   - Select files/folders (they will appear highlighted)
   - Use Ctrl+click (Cmd+click on Mac) for multiple selections

3. **Choose destination**:
   - In the S3 Bucket file browser, select your Remote Configuration
   - Navigate to the desired S3 location

4. **Start transfer**:
   - Drag selected files from Local browser to S3 browser
   - Drop into specific S3 folder or bucket root
   - Transfer begins automatically

5. **Monitor progress**:
   - View real-time progress in the Jobs tab
   - See transfer speed, ETA, and completion status

**Uploading from Finder / File Explorer:** You can also drag files and folders straight from your operating system's file manager onto the S3 Bucket browser. While a drag is over the window, the S3 panel highlights as a drop zone. Drop onto a specific folder to upload into it, or onto empty space to upload to the folder you're currently viewing. (The drop-zone highlight is shown on macOS.)

## Downloading Files

File Mover Express cannot download directly from Deep Archive or Glacier storage classes, as these require restoration first. For more information, see [Restoring archived objects](https://docs.aws.amazon.com/AmazonS3/latest/userguide/restoring-objects.html).

### To start downloads using the GUI

1. **Open File Mover Express**

2. **Select source files**:
   - In the S3 Bucket file browser, select your Remote Configuration
   - Navigate to and select files/folders to download

3. **Choose destination**:
   - In the Local file browser, navigate to your destination
   - Select target directory or drive

4. **Start transfer**:
   - Drag selected files from S3 browser to Local browser
   - Drop into specific local folder
   - Transfer begins automatically

5. **Monitor progress**:
   - View real-time progress in the Jobs tab

## Deleting Files and Objects

You can delete items from either browser by right-clicking a selection and choosing **Delete**.

- **Multi-select delete**: Select several files/folders (Ctrl/Cmd-click or Shift-click), then right-click one of them and choose **Delete**. The confirmation dialog lists every selected item in a scrollable list and reports how many folders and files will be removed, so you can confirm the full set before deleting.
- **Confirmation guard**: Deletions are permanent. You must type `permanently delete` to enable the **Delete** button (pressing **Enter** then confirms). For S3, all versions of the object and any delete markers are removed.
- **Rename** applies to a single item. When more than one item is selected, **Rename** is hidden from the context menu.

## Hot Folders

Hot Folders automatically monitor local directories and upload new or modified files to S3.

### Configuring Hot Folders

#### Method 1: Settings Menu
1. Select the dropdown menu (≡) and choose **Settings**
2. In the **Hot Folders** section, choose **Add Hot Folder**

#### Method 2: Context Menu
1. Right-click on a Local folder
2. Choose **Configure Hot Folder**

#### Configuration Options
- **Name**: Unique identifier for this hot folder
- **Remote Configuration Name**: Target S3 configuration
- **Local Source Folder**: Full path to monitor (e.g., `/media/drive`)
- **S3 Destination Folder**: Target S3 prefix (leave blank for bucket root)

**Multiple Destinations**: Click the (+) icon to upload to multiple S3 buckets from the same local folder.

### Hot Folder Behavior
- Recursively monitors all subdirectories
- Automatically uploads new or modified files
- Uses polling to detect file changes, so it works on network file systems (NFS, SMB)
- Detection may be slightly delayed on slow network mounts

## Jobs Tab

The Jobs tab provides comprehensive transfer management:

### Job Information Display
- **Progress**: Real-time percentage and progress bar
- **Remote Configuration**: Destination bucket/configuration
- **Size**: Total job size
- **ETA**: Estimated completion time
- **Start Time**: When the job began
- **Status**: Current state with transfer speed (if active)

### Job Controls (Action Button)
Click the Action arrow button for each job to access:

- **Pause**: Temporarily stop the transfer
  - Note: Actively transferring files will need to restart
- **Resume**: Continue a paused transfer
- **Cancel**: Stop and remove the job
- **Rename**: Give the job a descriptive name
- **Generate Report**: Create detailed transfer report
- **Job Details**: View status of individual files/folders

### Job Queue Management
- Jobs display in order of creation
- Earlier jobs appear at the top
- Filter by status to show specific job types
- **Overflow menu (⋯)**: Tray-wide actions live in the **⋯** button on the Jobs toolbar (you can also right-click empty space in the jobs list). Use it to **Clear All Completed Jobs** and **Refresh**. Per-job actions (Details, Rename, Pause/Cancel, Resubmit, Generate Report) remain on each job's action menu.
- **Resubmit** is available for completed, failed, and cancelled jobs.

### Job Details

Double-click a job (or choose **Job Details**) to open a detailed view with per-file progress and a job-scoped **Logs** view.

- **Copy S3 URI**: For uploads, copies the object's `s3://bucket/key` URI to the clipboard.
- **Skipped jobs**: A job that transferred nothing (for example, files already present in S3 or excluded by a filter) is shown as **Skipped**.

## Logs Tab

The Logs tab shows detailed application activity:

- **Transfer Information**: Detailed file transfer progress and results
- **Application Events**: GUI interactions and system messages
- **Error Messages**: Troubleshooting information for failed operations
- **Performance Data**: Transfer speeds and timing information

Use logs for:
- Troubleshooting transfer issues
- Monitoring application behavior
- Generating support information

## Bucket Reports Tab

Generate and view detailed S3 bucket inventories:

### Creating Bucket Reports
1. In the S3 Bucket file browser, select **Bucket Report**
2. Choose your preferred:
   - **Remote Configuration**: Which S3 bucket to report on
   - **Output Format**: `.xlsx`, `.json`, or `.csv`
3. Select **Generate Report**

### Viewing Reports
- **Progress Tracking**: Monitor report generation progress
- **Report Access**: View completed reports directly in the tab
- **Export Options**: Download reports in various formats

### Use Cases
- Inventory bucket contents without AWS Console access
- Generate delivery confirmations
- Audit file transfers and storage usage
- Create project documentation

## Settings and Configuration

Access settings through the dropdown menu (≡):

### General Settings
- **Disable Sleep (macOS only)**: Prevent system sleep during transfers
- **API Server Configuration**: GUI connectivity settings

### Remote Configurations
- **Add/Edit/Delete**: Manage S3 connection configurations
- **Test Connections**: Validate credentials and bucket access
- **Advanced Options**: Storage classes, checksums, filtering

### Hot Folders
- **Manage Hot Folders**: Add, edit, or remove monitored directories
- **Multiple Configurations**: Set up complex monitoring scenarios

## Favorites and Bookmarks

### Adding Favorites
1. Navigate to frequently-used directories
2. Right-click and select **Add to Favorites**
3. Access via File System dropdown

### Managing Favorites
- **Rename**: Give favorites descriptive names
- **Remove**: Delete unused bookmarks
- **Organize**: Group related favorites

## Remote Daemon Connection

Connect to File Mover Express running on other machines:

### Adding Remote Daemon
1. In Local file browser, select **File System** dropdown
2. Choose **Add Remote Daemon**
3. Configure:
   - **Name**: Descriptive identifier
   - **Host**: IP address or hostname
   - **Port**: Connection port (default: 50006)

### Using Remote Daemon
- Appears in File System dropdown once configured
- Browse remote file systems as if local
- Transfer files using remote machine's resources
- Add favorites on remote systems

## Keyboard Shortcuts and Tips

### Navigation
- **Double-click**: Enter folders
- **Breadcrumbs**: Click to navigate up directory tree
- **Ctrl+Click** (Cmd+Click on Mac): Multi-select files
- **Enter / Return**: In any dialog, submits the primary action (Save, Delete, etc.) when the form is valid — the same as clicking the primary button. **Escape** cancels.
- **Resizable bottom panel**: Drag the top edge of the Jobs / Logs / Bucket Reports tray upward to enlarge it (useful for reading long logs). The height is remembered across restarts.

### Transfer Tips
- **Drag and Drop**: Primary transfer method
- **Visual Feedback**: Highlighted drop zones during drag operations
- **Batch Operations**: Select multiple files for efficient transfers

### Performance Monitoring
- **Real-time Updates**: Jobs tab shows live progress
- **Speed Indicators**: Monitor network utilization
- **Queue Management**: Prioritize important transfers

## Troubleshooting GUI Issues

### Connection Problems
1. Check that daemon is running: `filemoverexpress daemon`
2. Verify `apiServer.enabled` is `true` in configuration
3. Restart File Mover Express if connection fails

### Performance Issues
1. Monitor Jobs tab for bottlenecks
2. Check Logs tab for error messages
3. Adjust transfer settings in configuration

### Interface Problems
1. Restart the GUI application
2. Check for conflicting applications on API port
3. Generate support file for detailed diagnostics

## Next Steps

- **[Using the CLI](Using-the-CLI)** - Learn command-line operations
- **[Hot Folders](Hot-Folders)** - Detailed hot folder configuration
- **[Remote Daemon](Remote-Daemon)** - Set up multi-user environments
- **[Performance Optimization](Performance-Optimization)** - Tune for your workload