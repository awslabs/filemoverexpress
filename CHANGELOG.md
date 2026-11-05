
# File Mover Express Releases

## 1.1.3

Adds transfer notifications to your chat tools and turns adaptive concurrency on by default.

### Added

* **Transfer notifications**: File Mover Express can post to Slack, Microsoft Teams, Discord, Google Chat, or any custom JSON webhook when a job finishes or fails. The message includes the job name, destination, file count, total size, and transfer speed. A global "notify on every transfer" option also covers hot-folder and CLI-driven jobs. Webhook URLs are stored encrypted and never written to the configuration file. See the [Notifications guide](docs/Notifications.md).

### Changed

* **Adaptive concurrency is now on by default** (opt-out). The daemon derives parallel connections and per-file threads from each job's file sizes and the host's network capacity, so strong throughput is the out-of-the-box behavior. Set `general.adaptiveConcurrency: false` to manage concurrency yourself.

## 1.1.2

Adds a new way to authenticate transfer profiles, smarter and more reliable high-speed transfers, and a refreshed toolchain.

### Added

* **Access-key authentication for transfer profiles**: authenticate a transfer profile with an AWS access key (with optional session token) as an alternative to a named profile or OIDC. Stored credentials are encrypted at rest, and on Linux the encryption key is sealed to the machine's TPM. Access-key auth is restricted to local daemons.
* **Adaptive concurrency (opt-in)**: automatically tunes parallel connections for the shape of a transfer. (Became the default in 1.1.3.)
* **Window state persistence**: window size, position, and maximized state are restored across restarts.

### Changed

* **ENOBUFS-aware retry backoff**: very high connection-count transfers now recover cleanly when the OS temporarily runs out of network buffers, instead of failing files.
* Upgraded to Wails 3.1.0 (first stable Wails 3) and the Go 1.27.3 toolchain.

## 1.1.1

Usability fixes and the public documentation site.

### Added

* Published documentation site generated from the `docs/` guides, with a download-forward landing page.

### Fixed

* The GUI executable is no longer missing from the Windows installer.
* The selected transfer profile now persists across restarts.
* Favorite paths display on two lines so the leaf folder is never clipped.

## 1.1.0

Adds single sign-on authentication and a refreshed GUI, along with a batch of usability fixes to file management, job handling, and the transfer tray.

### Added

* **OIDC / SSO Authentication**: A Remote Configuration can now authenticate with your organization's identity provider (Okta, Microsoft Entra ID, Auth0, Ping, Dex, and other OIDC providers) to obtain temporary AWS credentials, instead of a long-lived access key or a local AWS named profile. Includes an in-app sign-in flow, optional persisted sessions, and an async validator for the OIDC Issuer URL. See the [OIDC / SSO Authentication guide](docs/OIDC-Authentication.md).
* **Multi-select delete**: Selecting multiple files or objects and deleting now removes the entire selection. The confirmation dialog lists every item and reports the folder/file counts. Available on both the Local and S3 Bucket browsers.
* **Drag files from Finder / File Explorer into S3**: Drag items straight from the OS file manager onto the S3 panel to upload. Dropping onto a folder uploads into that folder; the S3 panel highlights as a drop zone during the drag (macOS).
* **Enter-to-submit in dialogs**: Pressing Enter/Return in any modal activates its primary action when the form is valid (Escape still cancels).
* **Resizable transfer tray**: Drag the top edge of the Jobs / Logs / Bucket Reports tray to resize it; the height persists across restarts.
* **Jobs tray overflow menu**: Tray-wide actions (Clear All Completed Jobs) now live in a **⋯** menu on the Jobs toolbar and via right-click on empty space, rather than being buried in a single job's menu.

### Changed

* **Redesigned GUI**: Refreshed Settings (left-nav layout), Remote Configuration form (Connection / Authentication / Performance tabs), and Job Details (side-nav, collapsible Advanced section, job-scoped Logs view).
* **S3 connection indicator** now reflects whether the selected Remote Configuration can actually reach S3 (Connecting / Connected / Disconnected) rather than only the daemon connection, and re-validates when a configuration is saved.
* **Info help panels** now open as a compact popover anchored to the clicked link, instead of a full-width bottom sheet.
* **Jobs table**: job names fit the column width, columns are sortable, and job direction renders as a Material icon.

### Fixed

* Job Details modal now scrolls to reach the Logs section when Advanced details are expanded.
* "Skipped" jobs display a Skipped status (not a green "Complete") and no longer show a nonsensical duration.
* Resubmitting a cancelled job now works instead of erroring.
* **Copy S3 URI** now copies to the clipboard reliably in the desktop app.
* Exporting a report for a job with no transfers (e.g. a skipped job) now shows a clear "no transfers to export" message instead of failing silently or surfacing a raw `missing trailer` error.
* Rename no longer silently acts on only one item when several are selected — it is hidden for multi-selections.

## 1.0.0

Initial release of File Mover Express.

File Mover Express is a high-performance file transfer application that enables efficient file transfers between local systems and Amazon S3 with enhanced features and improved user experience.

### Key Features

* **High-Performance Transfers**: Optimized file uploads and downloads to/from Amazon S3
* **Multiple Checksum Algorithms**: Support for MD5, XXHash, XXH3 checksumming
* **Job Management**: Pause, resume, and cancel transfer operations
* **Hot Folder Monitoring**: Automated uploads from monitored directories
* **S3 Inventory Generation**: Create detailed reports of S3 bucket contents
* **Cross-Platform Support**: Available for macOS, Windows, and Linux
* **Dual Interface**: Command-line daemon and Angular-based GUI application
* **Remote Daemon Support**: Connect GUI clients to remote daemon instances

### Components

* **CLI Daemon**: Go-based command-line service handling file transfers and S3 operations
* **GUI Application**: Angular-based desktop application wrapped in Electron
* **gRPC Communication**: High-performance communication between GUI and daemon
