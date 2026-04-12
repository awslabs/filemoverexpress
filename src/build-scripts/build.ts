import {Command} from 'commander';
import {CLIBuilder} from './builders/cli-builder';
import {ElectronBuilder} from './builders/electron-builder';
import {GUIBuilder} from './builders/gui-builder';
import {ProtobufBuilder} from './builders/protobuf-builder';
import {cliConfig} from './config/cli-config';
import {electronConfig} from './config/electron-config';
import {guiConfig} from './config/gui-config';
import {ForgeInstaller} from './installers/forge-installer';
import {LocalInstaller} from './installers/local-installer';
import {ElectronPackager} from './packagers/electron-packager';
import {BuildOptions} from './types/build-target';
import {BuildComponent} from './types/cli';
import {ForgeMakerType} from './types/forge';
import {Architecture, Platform} from './types/platform';
import {Logger} from './utils/logger';
import {detectCurrentArchitecture, detectCurrentPlatform} from './utils/platform-detector';

// Create Commander program instance
const program = new Command();

program
    .name('build')
    .description(`Build system for File Mover Express CLI and GUI components

Examples:
  $ ts-node build.ts cli build
  $ ts-node build.ts cli build --archs x64,arm64 --platforms darwin
  $ ts-node build.ts gui package:mac --production`)
    .version('1.0.0');

/**
 * Executes a build for the specified component with the given options
 * @param component The component to build ('cli' or 'gui')
 * @param target The build target
 * @param options The build options
 */
export async function executeBuild(component: BuildComponent, target: string, options: BuildOptions): Promise<void> {
    const archs = options.archs ?? [detectCurrentArchitecture()];
    const platforms = options.platforms ?? [detectCurrentPlatform()];
    Logger.verbose = options.verbose ?? false;

    Logger.info('Build configuration:');
    Logger.info(`  Component: ${component}`);
    Logger.info(`  Target: ${target}`);
    Logger.info(`  Architectures: ${archs.join(', ')}`);
    Logger.info(`  Platforms: ${platforms.join(', ')}`);
    if (options.production) {
        Logger.info('  Production: true');
    }
    if (options.verbose) {
        Logger.info('  Verbose: true');
    }

    // Execute component-specific build
    switch (component) {
        case 'cli':
            const cliBuilder = new CLIBuilder(cliConfig);
            await cliBuilder.build(options);
            Logger.success('CLI build completed successfully');
            Logger.debug(`Build artifacts location: ${cliConfig.outputDir}`);
            break;

        case 'gui':
            const guiBuilder = new GUIBuilder(guiConfig);
            await guiBuilder.build(options);
            Logger.success('GUI build completed successfully');
            Logger.debug(`Build artifacts location: ${guiConfig.outputDir}`);
            break;

        case 'proto':
            const protobufBuilder = new ProtobufBuilder();
            await protobufBuilder.build();
            Logger.success('Protobuf generation completed successfully');
            break;

        case 'electron':
            const electronBuilder = new ElectronBuilder();
            await electronBuilder.build();
            break;

        case 'package':
            const electronPackager = new ElectronPackager({
                electronConfig: {...electronConfig},
                options: {
                    platforms: platforms,
                },
                outputPath: 'dist',
                platforms: platforms.map(
                    (platform) => archs.map((arch) => ({platform, arch})),
                ).flat(),
            });

            await electronPackager.package().catch(
                (reason) => {
                    Logger.error('Failed to package Electron application', reason);
                    process.exit(1);
                },
            );
            break;
        case 'install':
            switch (target) {
                case 'local':
                    const local = new LocalInstaller();
                    await local.generate()
                        .then(() => {
                            Logger.success('Successfully installed application');
                        })
                        .catch((error) => {
                            const message = error instanceof Error ? error.message : String(error);
                            Logger.error(`Failed to install: ${message}`);
                            process.exit(1);
                        });
                    break;
                default:
                    throw new Error(`Invalid installer type: ${target}`);
            }
            break;

        case 'installer': {
            // Resolve target platform: explicit target > --platforms flag > auto-detect
            const platformAliases: Record<string, Platform> = {
                'mac': Platform.Darwin,
                'macos': Platform.Darwin,
                'darwin': Platform.Darwin,
                'win': Platform.Windows,
                'windows': Platform.Windows,
                'win32': Platform.Windows,
                'linux': Platform.Linux,
            };

            let resolvedPlatform: Platform;
            if (target && platformAliases[target]) {
                resolvedPlatform = platformAliases[target];
            } else if (target && target !== '') {
                const validAliases = Object.keys(platformAliases).join(', ');
                throw new Error(
                    `Invalid installer target: '${target}'. ` +
                    `Valid targets are: ${validAliases} (or omit to auto-detect).`,
                );
            } else {
                resolvedPlatform = options.platforms?.[0] ?? detectCurrentPlatform();
            }

            const installer = new ForgeInstaller({
                platform: resolvedPlatform,
                architecture: options.archs?.[0],
                devMode: options.devMode ?? false,
                retainTempFiles: options.retainTempFiles ?? false,
                verbose: options.verbose ?? false,
                makers: options.makers,
            });

            await installer.generate().catch((error) => {
                const message = error instanceof Error ? error.message : String(error);
                Logger.error(`Failed to generate installer: ${message}`);
                process.exit(1);
            });
            break;
        }
    }
}

// CLI command
program
    .command('cli [target]')
    .description('Build the CLI component')
    .option('--archs <archs>', 'Comma-separated architectures (x64, arm64)', parseArchitectures)
    .option('--platforms <platforms>', 'Comma-separated platforms (darwin, linux, windows)', parsePlatforms)
    .option('--production', 'Build in production mode', false)
    .option('--verbose', 'Enable verbose output', false)
    .action(async (target, options) => {
        // Apply defaults for unspecified options
        const defaults = getDefaultBuildOptions();
        const buildOptions: BuildOptions = {
            archs: options.archs || defaults.archs,
            platforms: options.platforms || defaults.platforms,
            production: options.production,
            verbose: options.verbose,
        };
        await executeBuild('cli', target ?? 'build', buildOptions);
    });

// GUI command
program
    .command('gui [target]')
    .description('Build the GUI component')
    .option('--archs <archs>', 'Comma-separated architectures (x64, arm64)', parseArchitectures)
    .option('--platforms <platforms>', 'Comma-separated platforms (darwin, linux, windows)', parsePlatforms)
    .option('--production', 'Build in production mode', false)
    .option('--verbose', 'Enable verbose output', false)
    .action(async (target, options) => {
        // Apply defaults for unspecified options
        const defaults = getDefaultBuildOptions();
        const buildOptions: BuildOptions = {
            archs: options.archs || defaults.archs,
            platforms: options.platforms || defaults.platforms,
            production: options.production,
            verbose: options.verbose,
        };
        await executeBuild('gui', target ?? 'build', buildOptions);
    });

// Protobuf command
program
    .command('proto')
    .description('Generate protobuf clients and service definitions')
    .action(async (target, options) => {
        await executeBuild('proto', target, options);
    });

// Electron command
program
    .command('electron [target]')
    .description('Build the Electron application code')
    .action(async (target) => {
        const defaults = getDefaultBuildOptions();
        const buildOptions: BuildOptions = {...defaults};
        await executeBuild('electron', target ?? 'build', buildOptions);
    });

// Package the Electron application
program
    .command('package [target]')
    .description('Package the Electron application')
    .option('--archs <archs>', 'Comma-separated architectures (x64, arm64)', parseArchitectures)
    .option('--platforms <platforms>', 'Comma-separated platforms (darwin, linux, windows)', parsePlatforms)
    .option('--production', 'Build in production mode', false)
    .option('--verbose', 'Enable verbose output', false)
    .action(async (target, options) => {
        // Apply defaults for unspecified options
        const defaults = getDefaultBuildOptions();
        const buildOptions: BuildOptions = {
            archs: options.archs || defaults.archs,
            platforms: options.platforms || defaults.platforms,
            production: options.production,
            verbose: options.verbose,
        };
        await executeBuild('package', target ?? 'build', buildOptions);
    });

program
    .command('install <target>')
    .description('Install File Mover Express to your local machine')
    .option('--verbose', 'Enable verbose output', false)
    .action(async (options) => {
        const defaults = getDefaultBuildOptions();
        const buildOptions: BuildOptions = {
            archs: options.archs || defaults.archs,
            platforms: options.platforms || defaults.platforms,
            production: true,
            verbose: options.verbose,
        };
        await executeBuild('install', 'local', buildOptions);
    });

// Installer command - generate distributable installers via Electron Forge
program
    .command('installer [platform]')
    .description('Generate a distributable installer via Electron Forge. Defaults to current platform. Optional platform: mac, win, linux.')
    .option('--archs <archs>', 'Target architecture (x64, arm64)', parseArchitectures)
    .option('--platforms <platforms>', 'Target platform (darwin, linux, windows)', parsePlatforms)
    .option('--dev-mode', 'Skip packager if dist files exist', false)
    .option('--retain-temp-files', 'Keep temp directories for debugging', false)
    .option('--verbose', 'Enable verbose output', false)
    .option('--makers <makers>', 'Comma-separated Forge maker types (dmg, pkg, zip, deb, rpm, squirrel, wix)', parseMakers)
    .action(async (platform, options) => {
        const defaults = getDefaultBuildOptions();
        const buildOptions: BuildOptions = {
            archs: options.archs || defaults.archs,
            platforms: options.platforms || defaults.platforms,
            production: true,
            verbose: options.verbose,
            devMode: options.devMode,
            retainTempFiles: options.retainTempFiles,
            makers: options.makers,
        };
        await executeBuild('installer', platform, buildOptions);
    });

/**
 * Gets default build options based on current platform and architecture
 * @returns Partial BuildOptions with detected platform and architecture defaults
 */
export function getDefaultBuildOptions(): Partial<BuildOptions> {
    return {
        platforms: [detectCurrentPlatform()],
        archs: [detectCurrentArchitecture()],
    };
}

export function parseArchitectures(value: string): Architecture[] {
    const archStrings = value.split(',').map(s => s.trim());
    const archs: Architecture[] = [];

    for (const archStr of archStrings) {
        if (archStr === 'x64') {
            archs.push(Architecture.X64);
        } else if (archStr === 'arm64') {
            archs.push(Architecture.ARM64);
        } else {
            throw new Error(`Invalid architecture '${archStr}'. Must be 'x64' or 'arm64'.`);
        }
    }

    return archs;
}

export function parsePlatforms(value: string): Platform[] {
    const platformStrings = value.split(',').map(s => s.trim());
    const platforms: Platform[] = [];

    for (const platformStr of platformStrings) {
        if (platformStr === 'darwin') {
            platforms.push(Platform.Darwin);
        } else if (platformStr === 'linux') {
            platforms.push(Platform.Linux);
        } else if (platformStr === 'windows') {
            platforms.push(Platform.Windows);
        } else {
            throw new Error(`Invalid platform '${platformStr}'. Must be 'darwin', 'linux', or 'windows'.`);
        }
    }

    return platforms;
}

export function parseMakers(value: string): ForgeMakerType[] {
    const validMakers = Object.values(ForgeMakerType) as string[];
    const makerStrings = value.split(',').map(s => s.trim().toLowerCase());
    const makers: ForgeMakerType[] = [];

    for (const makerStr of makerStrings) {
        if (!validMakers.includes(makerStr)) {
            throw new Error(
                `Invalid maker type '${makerStr}'. ` +
                `Valid types are: ${validMakers.join(', ')}`,
            );
        }
        makers.push(makerStr as ForgeMakerType);
    }

    return makers;
}

export async function main(): Promise<void> {
    try {
        await program.parseAsync(process.argv);
    } catch (error) {
        if (error instanceof Error) {
            const errorMessage = error.message;

            const commandMatch = errorMessage.match(/Command: (.+?)(?:\n|$)/);
            const exitCodeMatch = errorMessage.match(/exit code (\d+)/i);
            const stderrMatch = errorMessage.match(/Stderr: (.+?)$/s);

            Logger.error('Build failed');

            if (commandMatch) {
                Logger.error(`Command: ${commandMatch[1]}`);
            }

            if (exitCodeMatch) {
                Logger.error(`Exit code: ${exitCodeMatch[1]}`);
            }

            if (stderrMatch) {
                Logger.error('Error output:');
                console.error(stderrMatch[1]);
            } else if (!commandMatch && !exitCodeMatch) {
                Logger.error(errorMessage);
            }
        } else {
            Logger.error('Build failed with unknown error');
            console.error(error);
        }

        process.exit(1);
    }
}

if (require.main === module) {
    main().catch();
}
