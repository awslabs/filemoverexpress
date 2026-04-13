# File Mover Express GUI

[![Angular Version](https://img.shields.io/badge/Angular-21+-red.svg)](https://angular.io/)
[![Node Version](https://img.shields.io/badge/Node-22+-green.svg)](https://nodejs.org/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

The GUI component is a modern Angular application that provides an intuitive graphical interface for File Mover Express. It communicates
with the CLI daemon via gRPC and offers drag-and-drop file management, job monitoring, and configuration management.

## Overview

The GUI provides a user-friendly interface for:

- **File Browser**: Navigate local and S3 file systems with drag-and-drop support
- **Job Management**: Monitor, pause, resume, and cancel transfer jobs
- **Progress Tracking**: Real-time transfer progress with speed and ETA
- **Configuration**: Visual configuration editor for all settings
- **Hot Folders**: Set up and manage automated upload folders
- **Inventory Reports**: Generate and export S3 inventory reports
- **Event Log**: View system events and transfer history

## Architecture

```
src/gui/
├── src/
│   ├── app/                    # Angular application
│   │   ├── components/         # UI components
│   │   ├── services/           # Business logic and API clients
│   │   ├── state/              # NgRx state management
│   │   ├── guards/             # Route guards
│   │   ├── interfaces/         # TypeScript interfaces
│   │   ├── utils/              # Utility functions
│   │   └── modules/            # Feature modules
│   ├── assets/                 # Static assets (images, icons)
│   ├── connect/                # gRPC-web client code
│   ├── styles/                 # Global SCSS styles
│   └── environments/           # Environment configurations
└── angular.json                # Angular CLI configuration
```

## Prerequisites

- **Node.js** 22 or higher
- **npm** or **yarn** package manager
- **Angular CLI** (installed automatically with dependencies)
- **Running CLI Daemon** - The GUI requires the CLI daemon to be running

## Building

### Manual Build

From the `src/gui` directory:

```bash
# Install dependencies
npm install

# Build for production
ng build --configuration production

# Build for development
ng build

# Build with specific configuration
ng build --configuration custom-environment
```

Built files are placed in `dist/` directory.

## Development

### Development Server

```bash
# Or from src/gui directory
npm start
# or
ng serve
```

Navigate to `http://localhost:4200/`. The application will automatically reload when source files change.

### Development with CLI Daemon

Functionality that requires Electron, such as starting the daemon from the GUI, will not be available when using the Angular development
server. The GUI requires the CLI daemon to be running:

```bash
# Terminal 1: Start CLI daemon
cd src/cli
./dist/filemoverexpress daemon

# Terminal 2: Start GUI dev server
cd src/gui
npm start
```

## Testing

### Unit Tests

```bash
npm test
# or
ng test

# Run specific test file
ng test --include='**/app.component.spec.ts'

# Run tests with coverage
ng test --code-coverage

# Run tests in headless mode (CI)
ng test --browsers=ChromeHeadless --watch=false
```

Tests use Karma test runner with Jasmine framework. Configuration is in `karma.conf.js`.

## Linting

```bash
npm run lint
# or
ng lint

# Auto-fix issues
ng lint --fix
```

Linter configuration is in `eslint.config.js`.

## Configuration

### Environment Files

Environment-specific configurations:

- `src/environments/environment.ts` - Development
- `src/environments/environment.prod.ts` - Production

### Build Configurations

Angular build configurations in `angular.json`:

- **development**: Development build with source maps
- **production**: Optimized production build

## Styling

The application uses:

- **Angular Material**: UI component library
- **SCSS**: CSS preprocessor
- **Custom Theme**: Defined in `src/styles/`

Global styles are in `src/styles.scss`.

## gRPC Communication

The GUI communicates with the CLI daemon using Protobuf messages over WebSockets:

- Protocol definitions in `../protobuf/`
- Generated client code in `src/app/gen/`
- Service wrappers in `src/app/services/`

To regenerate gRPC client code:

```bash
# From repository root
npm run proto:generate
```

## Development Workflow

### Adding New Features

1. Create feature branch: `git checkout -b feature/my-feature`
2. Generate component: `ng generate component components/my-component`
3. Implement component logic and template
4. Add tests: `my-component.spec.ts`
5. Update state management if needed
6. Test locally: `npm start`
7. Run tests: `npm test`
8. Run linter: `npm run lint`
9. Commit and push changes

### Component Generation

```bash
# Generate component
ng generate component components/my-component

# Generate service
ng generate service services/my-service

# Generate guard
ng generate guard guards/my-guard
```

## Troubleshooting

## Contributing

Contributions to the GUI component are welcome. Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution guidelines.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](../../LICENSE) file for details.
