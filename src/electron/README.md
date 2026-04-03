# File Mover Express Electron Wrapper

[![Electron Version](https://img.shields.io/badge/Electron-29.0+-blue.svg)](https://www.electronjs.org/)
[![Node Version](https://img.shields.io/badge/Node-22+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

The Electron wrapper packages the File Mover Express GUI as a native desktop application for macOS, Windows, and Linux. It provides the
bridge between the web-based Angular GUI and native operating system features.

## Overview

The Electron wrapper provides:

- **Native Desktop Application**: Standalone executable for each platform
- **Window Management**: Native window controls and menu bar
- **System Integration**: File system access and native dialogs
- **Auto-Updates**: Built-in update mechanism (when configured)
- **Process Management**: Manages CLI daemon lifecycle
- **IPC Bridge**: Communication between renderer and main process

## Architecture

```
src/electron/
├── src/
│   ├── electron-main.ts        # Main process entry point
│   ├── preload.ts              # Preload script for renderer
│   ├── exporter.ts             # Export utilities
│   └── constants.ts            # Application constants
├── assets/
│   └── icons/                  # Application icons
│       ├── mac/                # macOS icon files
│       ├── win/                # Windows icon files
│       └── png/                # PNG icons for Linux
├── package.json                # Electron dependencies
└── tsconfig.json               # TypeScript configuration
```

## Prerequisites

- **Node.js** 22 or higher
- **npm** or **yarn** package manager
- **Built GUI Application** - The Angular GUI must be built first

## Building

### Quick Build

From the repository root:

```bash
# Build GUI first
npm run build:gui

# Build Electron app for current platform
npm run --prefix src/electron build

# Build for all platforms
npm run --prefix src/electron build:all

# Build for specific platforms
npm run --prefix src/electron build:mac
npm run --prefix src/electron build:win
npm run --prefix src/electron build:linux
```

### Manual Build

From the `src/electron` directory:

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Package for current platform
npm run package

# Package for specific platform
npm run package:mac
npm run package:win
npm run package:linux
```

Built applications are placed in the `dist/` directory.

## Development

### Development Mode

```bash
# Start in development mode (requires built GUI)
npm run --prefix src/electron dev

# Or from src/electron directory
npm run dev
```

This will:

1. Compile TypeScript files
2. Launch Electron with the GUI
3. Enable hot reload for main process changes

### Development with Live Reload

For full development experience with GUI hot reload:

```bash
# Terminal 1: Start CLI daemon
cd src/cli
./dist/filemoverexpress daemon

# Terminal 2: Start GUI dev server
cd src/gui
npm start

# Terminal 3: Start Electron in dev mode
cd src/electron
npm run dev
```

## Main Process

The main process (`electron-main.ts`) handles:

- **Window Creation**: Creates and manages application windows
- **Menu Bar**: Native application menu
- **IPC Handlers**: Communication with renderer process
- **Daemon Management**: Starts and stops CLI daemon
- **File System Access**: Native file dialogs and operations
- **Application Lifecycle**: Startup, shutdown, and updates

### Key Features

```typescript
// Window creation
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
}

// IPC handlers
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return result.filePaths[0];
});
```

## Preload Script

The preload script (`preload.ts`) provides a secure bridge between the renderer and main process:

```typescript
// Expose safe APIs to renderer
contextBridge.exposeInMainWorld('electron', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  // ... other safe APIs
});
```

## Application Icons

Platform-specific icons are located in `assets/icons/`:

- **macOS**: `.icns` file in `mac/`
- **Windows**: `.ico` file in `win/`
- **Linux**: PNG files in `png/` (various sizes)

To update icons:

1. Replace icon files in appropriate directories
2. Rebuild the application
3. Icons are automatically included in the package

## Packaging

### Configuration

Electron packaging is configured in `package.json`:

```json
{
  "build": {
    "appId": "com.aws.filemoverexpress",
    "productName": "File Mover Express",
    "directories": {
      "output": "dist"
    },
    "mac": {
      "target": ["dmg", "zip"],
      "icon": "assets/icons/mac/icon.icns"
    },
    "win": {
      "target": ["nsis", "portable"],
      "icon": "assets/icons/win/icon.ico"
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "icon": "assets/icons/png/"
    }
  }
}
```

### Build Outputs

Packaged applications:

- **macOS**: `.dmg` installer and `.zip` archive
- **Windows**: `.exe` installer (NSIS) and portable `.exe`
- **Linux**: `.AppImage` and `.deb` package

## Security

The Electron wrapper follows security best practices:

- **Context Isolation**: Enabled to prevent prototype pollution
- **Node Integration**: Disabled in renderer process
- **Preload Script**: Whitelist of safe APIs exposed to renderer
- **Content Security Policy**: Restricts resource loading
- **Secure IPC**: Validated communication between processes

### Security Checklist

- ✅ Context isolation enabled
- ✅ Node integration disabled
- ✅ Preload script with limited API surface
- ✅ IPC handlers validate input
- ✅ External URLs opened in default browser
- ✅ File system access through dialogs only

## Auto-Updates

Auto-update functionality can be configured using `electron-updater`:

```typescript
import { autoUpdater } from 'electron-updater';

// Check for updates on startup
autoUpdater.checkForUpdatesAndNotify();

// Handle update events
autoUpdater.on('update-available', () => {
  // Notify user
});

autoUpdater.on('update-downloaded', () => {
  // Prompt user to restart
});
```

Configuration in `package.json`:

```json
{
  "publish": {
    "provider": "github",
    "owner": "awslabs",
    "repo": "filemoverexpress"
  }
}
```

## Troubleshooting

### Common Issues

**Build Failures**

```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

**Application Won't Start**

```bash
# Check if GUI is built
ls ../gui/dist/

# Rebuild GUI if needed
cd ../gui
npm run build
```

**Icon Not Showing**

```bash
# Verify icon files exist
ls assets/icons/mac/
ls assets/icons/win/
ls assets/icons/png/

# Rebuild with clean cache
rm -rf dist
npm run build
```

**IPC Communication Errors**

```bash
# Ensure preload script is compiled
npm run build

# Check console for errors
# Open DevTools: View > Toggle Developer Tools
```

For more troubleshooting information, see the [Troubleshooting Guide](../../docs/Troubleshooting.md).

## Development Tips

### Debugging

Enable DevTools in development:

```typescript
// In electron-main.ts
if (process.env.NODE_ENV === 'development') {
  mainWindow.webContents.openDevTools();
}
```

### Logging

Use console logging in main process:

```typescript
console.log('Main process log');
```

Logs appear in terminal where Electron was launched.

### Hot Reload

For main process hot reload, use `electron-reload`:

```typescript
if (process.env.NODE_ENV === 'development') {
  require('electron-reload')(__dirname);
}
```

## Platform-Specific Notes

### macOS

- Code signing required for distribution
- Notarization required for macOS 10.15+
- DMG installer provides drag-to-Applications experience

### Windows

- NSIS installer supports silent installation
- Portable version requires no installation
- Code signing recommended for SmartScreen

### Linux

- AppImage is self-contained and portable
- .deb package for Debian/Ubuntu systems
- Desktop entry file included for menu integration

## Contributing

Contributions to the Electron wrapper are welcome. Please:

1. Follow Electron security best practices
2. Test on all target platforms
3. Ensure IPC handlers validate input
4. Update documentation for API changes
5. Test packaging for each platform

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for general contribution guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.
