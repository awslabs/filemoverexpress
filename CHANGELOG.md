
# File Mover Express Releases

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
