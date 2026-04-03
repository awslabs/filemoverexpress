# Installation

This guide covers how to build and install File Mover Express on different platforms.

## Prerequisites

Before installing File Mover Express, ensure you have completed the [Setup](Setup) requirements and have the following software installed:

### Required Software

- **Go** ≥ 1.25
- **Node.js** ≥ 22 and **npm**
- **Angular CLI** (`npm install -g @angular/cli`)
- **Git**
- **Make** (optional, recommended for Linux/macOS)

### Hardware Requirements

We recommend that your local computer meets the following requirements:

- **8 logical CPU cores**
- **8 GB RAM**

Your transfer speeds depend on your hardware, network configuration, and bandwidth. File Mover Express can transfer files as fast as your network and hardware permits.

## Installation by Platform

### Windows

1. **Install Dependencies**
   - Install Go, Node.js, and [Git for Windows](https://git-scm.com/download/win)

2. **Clone the Repository**
   ```bash
   git clone https://github.com/awslabs/filemoverexpress.git
   cd filemoverexpress
   ```

3. **Build the Frontend**
   ```bash
   cd gui
   make package-win
   ```

4. **Build the Go Backend and Bundle the UI**
   ```bash
   cd ..
   make build-windows
   ```

5. **Run the Application**
   ```bash
   .\fme.exe
   ```

The executable `fme.exe` will be created in the project root.

### macOS

1. **Install Homebrew** (if not already available)

2. **Install Dependencies**
   ```bash
   brew install go node git
   ```

3. **Clone and Build**
   ```bash
   git clone https://github.com/awslabs/filemoverexpress.git
   cd filemoverexpress
   cd ui && npm install && ng build --configuration production && cd ..
   go build -o fme ./cmd/fme
   ```

4. **Run the Application**
   ```bash
   ./fme
   ```

### Linux (Ubuntu/Debian)

1. **Install Dependencies**
   ```bash
   sudo apt update
   sudo apt install -y golang-go nodejs npm git make
   ```

2. **Clone and Build**
   ```bash
   git clone https://github.com/awslabs/filemoverexpress.git
   cd filemoverexpress
   cd ui && npm install && ng build --configuration production && cd ..
   go build -o fme ./cmd/fme
   ```

3. **Run the Application**
   ```bash
   ./fme
   ```

## Post-Installation

After successful installation:

1. **Verify Installation**: Run the executable to ensure it starts without errors
2. **Configure File Mover Express**: Follow the [Configuration](Configuration) guide to set up your remote configurations
3. **Test Connection**: Verify your AWS credentials and S3 bucket access

## Troubleshooting Installation

### Common Issues

**Build Failures**
- Ensure all prerequisites are installed and up to date
- Check that Go and Node.js versions meet the minimum requirements
- Verify network connectivity for downloading dependencies

**Permission Issues**
- On Linux/macOS, ensure you have write permissions in the installation directory
- On Windows, avoid running as administrator unless necessary

**Missing Dependencies**
- Run `npm install` in the `ui` directory if frontend build fails
- Ensure Angular CLI is installed globally: `npm install -g @angular/cli`

### Getting Help

If you encounter issues during installation:

1. Check the [Troubleshooting](Troubleshooting) guide
2. Review error messages carefully and ensure all prerequisites are met
3. Open an issue on the [GitHub repository](https://github.com/awslabs/filemoverexpress) with:
   - Your operating system and version
   - Go and Node.js versions
   - Complete error messages
   - Steps you've already tried

## Next Steps

After installation, proceed to:
- [Configuration](Configuration) - Set up your remote configurations
- [Getting Started](Getting-Started) - Learn basic usage
- [Using the GUI](Using-the-GUI) - Explore the graphical interface