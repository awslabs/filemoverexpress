# File Mover Express Build Scripts

[![Node Version](https://img.shields.io/badge/Node-22+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

This directory contains TypeScript-based build automation scripts for File Mover Express. These scripts orchestrate the build process for
all components (CLI, GUI, Electron, Windows launcher) and provide a unified build interface through npm scripts.

## Overview

The build scripts provide:

- **Unified Build System**: Single interface for building all components
- **Cross-Platform Support**: Build for macOS, Windows, and Linux
- **Parallel Builds**: Concurrent builds for multiple platforms
- **Version Management**: Automatic version injection from package.json
- **Environment Configuration**: Development and production build modes
- **Clean Operations**: Automated cleanup of build artifacts

## Architecture

```
src/build-scripts/
├── builders/                   # Component-specific builders
│   ├── cli-builder.ts          # CLI build orchestration
│   ├── gui-builder.ts          # GUI build orchestration
│   ├── electron-builder.ts     # Electron packaging
│   └── launcher-builder.ts     # Windows launcher builder
├── cli/                        # CLI build entry points
│   ├── build-cli.ts            # CLI build command
│   ├── build-gui.ts            # GUI build command
│   ├── build-all.ts            # Build all components
│   └── clean.ts                # Clean build artifacts
├── config/                     # Build configuration
│   ├── paths.ts                # Project paths
│   ├── platforms.ts            # Platform definitions
│   └── versions.ts             # Version management
├── shared/                     # Shared utilities
│   ├── command-runner.ts       # Command execution
│   ├── file-utils.ts           # File operations
│   └── logger.ts               # Build logging
├── types/                      # TypeScript type definitions
│   └── build-types.ts          # Build configuration types
├── utils/                      # Utility functions
│   ├── env-utils.ts            # Environment helpers
│   └── validation.ts           # Input validation
└── tsconfig.json               # TypeScript configuration
```

## Prerequisites

- **Node.js** 22 or higher
- **TypeScript** 5.0 or higher (installed via npm)
- **Platform-specific tools**:
    - Go 1.25+ for CLI builds
    - Angular CLI for GUI builds
    - Electron Builder for desktop packaging

## Usage

### Building Components

From the repository root:

```bash
# Build all components
npm run build:all

# Build specific components
npm run build:cli           # CLI for all platforms
npm run build:gui           # GUI production build
npm run build:electron      # Electron desktop app

# Build CLI for specific platforms
npm run --prefix src/cli build:mac      # macOS (x64 + ARM64)
npm run --prefix src/cli build:linux    # Linux (x64 + ARM64)
npm run --prefix src/cli build:win      # Windows (x64)
```

### Cleaning Build Artifacts

```bash
# Clean all build artifacts
npm run clean:all

# Clean specific components
npm run clean:cli
npm run clean:gui
npm run clean:electron
```

## Build Scripts

### CLI Builder

**Location**: `builders/cli-builder.ts`

Handles Go compilation for multiple platforms:

- Detects Go installation
- Manages cross-compilation (GOOS/GOARCH)
- Injects version information
- Strips debug symbols for release builds
- Supports parallel platform builds

**Usage**:

```typescript
import { CLIBuilder } from './builders/cli-builder';

const builder = new CLIBuilder({
  platforms: ['darwin-amd64', 'darwin-arm64', 'linux-amd64'],
  version: '1.0.0',
  mode: 'release'
});

await builder.build();
```

### GUI Builder

**Location**: `builders/gui-builder.ts`

Handles Angular compilation:

- Runs Angular CLI build
- Manages production optimizations
- Handles environment configurations
- Supports AOT compilation
- Tree shaking and minification

**Usage**:

```typescript
import { GUIBuilder } from './builders/gui-builder';

const builder = new GUIBuilder({
  configuration: 'production',
  outputPath: 'dist'
});

await builder.build();
```

### Electron Builder

**Location**: `builders/electron-builder.ts`

Handles Electron packaging:

- Compiles TypeScript
- Packages for target platforms
- Includes application icons
- Configures auto-updates
- Creates installers (DMG, NSIS, AppImage)

**Usage**:

```typescript
import { ElectronBuilder } from './builders/electron-builder';

const builder = new ElectronBuilder({
  platforms: ['mac', 'win', 'linux'],
  version: '1.0.0'
});

await builder.build();
```

### Windows Launcher Builder

**Location**: `builders/launcher-builder.ts`

Handles Windows service launcher:

- Compiles Go for Windows
- Embeds version information
- Configures service metadata

**Usage**:

```typescript
import { LauncherBuilder } from './builders/launcher-builder';

const builder = new LauncherBuilder({
  version: '1.0.0',
  outputPath: 'dist'
});

await builder.build();
```

## Configuration

### Build Modes

**Development Mode**:

```bash
BUILD_MODE=dev npm run build:cli
```

- Includes debug symbols
- Adds "dev" version suffix
- Faster compilation
- Larger binaries

**Release Mode** (default):

```bash
npm run build:cli
```

- Strips debug symbols
- Optimized binaries
- Smaller file sizes
- Production-ready

### Environment Variables

| Variable          | Description              | Default            |
|-------------------|--------------------------|--------------------|
| `VERSION`         | Override version number  | From package.json  |
| `PRODUCT_NAME`    | Override product name    | `filemoverexpress` |
| `BUILD_MODE`      | Build mode (dev/release) | `release`          |
| `SKIP_TESTS`      | Skip test execution      | `false`            |
| `PARALLEL_BUILDS` | Enable parallel builds   | `true`             |

**Examples**:

```bash
# Custom version
VERSION=2.0.0 npm run build:all

# Development build
BUILD_MODE=dev npm run build:cli

# Skip tests during build
SKIP_TESTS=true npm run build:all
```

## Command Runner

**Location**: `shared/command-runner.ts`

Executes shell commands with:

- Real-time output streaming
- Error handling and logging
- Working directory management
- Environment variable injection
- Exit code checking

**Usage**:

```typescript
import { CommandRunner } from './shared/command-runner';

const runner = new CommandRunner();

await runner.exec('go build', {
  cwd: '/path/to/project',
  env: { GOOS: 'darwin', GOARCH: 'amd64' }
});
```

## File Utilities

**Location**: `shared/file-utils.ts`

Provides file operations:

- Directory creation and deletion
- File copying and moving
- Path resolution
- Glob pattern matching
- Safe file operations with error handling

**Usage**:

```typescript
import { FileUtils } from './shared/file-utils';

// Clean directory
await FileUtils.cleanDir('dist');

// Copy files
await FileUtils.copyFiles('src/**/*.ts', 'dist');

// Ensure directory exists
await FileUtils.ensureDir('build/output');
```

## Logger

**Location**: `shared/logger.ts`

Provides structured logging:

- Colored console output
- Log levels (info, warn, error, success)
- Timestamps
- Component prefixes
- Progress indicators

**Usage**:

```typescript
import { Logger } from './shared/logger';

const logger = new Logger('CLI Builder');

logger.info('Starting build...');
logger.success('Build completed!');
logger.error('Build failed:', error);
```

## Development

### Running Build Scripts Directly

```bash
# Compile TypeScript
npm run --prefix src/build-scripts build

# Run specific builder
npx ts-node src/build-scripts/cli/build-cli.ts

# Run with arguments
npx ts-node src/build-scripts/cli/build-cli.ts --platform darwin-amd64
```

### Adding New Builders

1. Create builder class in `builders/`
2. Implement `Builder` interface
3. Add CLI entry point in `cli/`
4. Update npm scripts in root `package.json`
5. Add tests in `__tests__/`

**Example**:

```typescript
// builders/my-builder.ts
export class MyBuilder implements Builder {
  async build(): Promise<void> {
    // Build logic
  }

  async clean(): Promise<void> {
    // Cleanup logic
  }
}

// cli/build-my-component.ts
import { MyBuilder } from '../builders/my-builder';

const builder = new MyBuilder(config);
await builder.build();
```

### Testing

```bash
# Run tests
npm run --prefix src/build-scripts test

# Run with coverage
npm run --prefix src/build-scripts test:coverage

# Run specific test
npm run --prefix src/build-scripts test -- cli-builder.test.ts
```

## Troubleshooting

### Common Issues

**TypeScript Compilation Errors**

```bash
# Clean and rebuild
rm -rf src/build-scripts/dist
npm run --prefix src/build-scripts build
```

**Command Execution Failures**

```bash
# Check command availability
which go
which ng

# Verify working directory
pwd
ls -la
```

**Permission Errors**

```bash
# Make scripts executable
chmod +x src/build-scripts/cli/*.ts

# Check file permissions
ls -la dist/
```

**Build Hangs**

```bash
# Kill stuck processes
pkill -f "go build"
pkill -f "ng build"

# Clean and retry
npm run clean:all
npm run build:all
```

For more troubleshooting information, see the [Troubleshooting Guide](../../docs/Troubleshooting.md).

## Best Practices

### Error Handling

- Always catch and log errors
- Provide meaningful error messages
- Clean up on failure
- Exit with appropriate codes

### Logging

- Log all major operations
- Use appropriate log levels
- Include timestamps
- Provide progress indicators

### Performance

- Use parallel builds when possible
- Cache build artifacts
- Skip unnecessary operations
- Optimize file operations

### Maintainability

- Keep builders focused and modular
- Use TypeScript for type safety
- Document configuration options
- Write tests for critical paths

## Contributing

Contributions to the build scripts are welcome. Please:

1. Follow TypeScript best practices
2. Add tests for new functionality
3. Update documentation
4. Ensure cross-platform compatibility
5. Test on all target platforms

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for general contribution guidelines.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](../../LICENSE) file for details.
