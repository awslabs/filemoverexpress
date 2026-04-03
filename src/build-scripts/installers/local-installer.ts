import fs from 'fs/promises';
import {execSync} from 'node:child_process';
import path from 'node:path';
import * as readline from 'readline';
import {electronConfig} from '../config/electron-config';
import {ElectronPackager} from '../packagers/electron-packager';
import {ElectronPackagerConfig} from '../types/config';
import {InstallationReport, ShellType, SystemConfigOptions} from '../types/installer';
import {Architecture, Platform} from '../types/platform';
import {Logger} from '../utils/logger';
import {PathResolver} from '../utils/path-resolver';
import {detectCurrentArchitecture, detectCurrentPlatform} from '../utils/platform-detector';
import {detectCurrentShell} from '../utils/shell-detector';
import {BaseInstaller} from './base-installer';

export class LocalInstaller extends BaseInstaller {
    private _currentPlatform: Platform;
    private _currentArchitecture: Architecture;
    private installationReport: InstallationReport;
    private electronPackager: ElectronPackager;

    private readonly baseName = 'filemoverexpress';

    constructor() {
        super();

        // Detect current platform and architecture
        this._currentPlatform = detectCurrentPlatform();
        this._currentArchitecture = detectCurrentArchitecture();

        // Initialize empty installation report
        this.installationReport = {
            timestamp: new Date(),
            platform: this._currentPlatform,
            architecture: this._currentArchitecture,
            installPath: '',
            filesCopied: [],
            pathModifications: [],
            shortcutsCreated: [],
            shellConfigModifications: [],
        };

        // Create ElectronPackagerConfig for current platform only
        const packagerConfig: ElectronPackagerConfig = {
            platforms: [
                {
                    platform: this._currentPlatform,
                    arch: this._currentArchitecture,
                },
            ],
            options: {
                archs: [this._currentArchitecture],
                platforms: [this._currentPlatform],
                production: true,
                verbose: false,
            },
            outputPath: 'dist',
            electronConfig: {
                appName: electronConfig.appName,
                appBundleId: electronConfig.appBundleId,
                helperBundleId: electronConfig.helperBundleId,
                iconPaths: electronConfig.iconPaths,
                packagerOptions: electronConfig.packagerOptions,
            },
        };

        // Create ElectronPackager instance with config
        this.electronPackager = new ElectronPackager(packagerConfig);
    }

    get currentPlatform(): Platform {
        return this._currentPlatform;
    }

    set currentPlatform(platform: Platform) {
        this._currentPlatform = platform;
    }

    get currentArchitecture(): Architecture {
        return this._currentArchitecture;
    }

    set currentArchitecture(architecture: Architecture) {
        this._currentArchitecture = architecture;
    }

    /**
     * Returns an array of paths that should be cleaned up after installation
     * Includes ElectronPackager cleanup paths and the packaged application directory
     * @returns Array of paths to clean up
     */
    get cleanupPaths(): string[] {
        const paths: string[] = [];

        // Include ElectronPackager cleanup paths
        paths.push(...this.electronPackager.cleanupPaths);

        // Include the packaged application directory (dist/)
        const projectRoot = PathResolver.getProjectRoot();
        const distPath = path.join(projectRoot, 'dist');
        paths.push(distPath);

        return paths;
    }

    /**
     * Main entry point that orchestrates the complete installation process
     * Steps:
     * 1. Platform and architecture already detected in constructor
     * 2. Package application using ElectronPackager
     * 3. Copy files to install location
     * 4. Prompt for system configuration options
     * 5. Update system PATH if requested
     * 6. Create Windows shortcuts if requested
     * 7. Generate and display installation report
     * @throws Error if any critical step fails
     */
    async generate(): Promise<void> {
        try {
            Logger.info('Starting File Mover Express local installation...');
            Logger.debug(`Platform: ${this.currentPlatform}, Architecture: ${this._currentArchitecture}`);

            // Step 1: Platform and architecture already detected in constructor
            // (No action needed - already done in constructor)

            // Step 2: Package application using ElectronPackager
            Logger.debug('Step 1/5: Packaging application...');
            await this.packageApplication();

            // Step 3: Copy files to install location
            Logger.debug('Step 2/5: Copying files to installation location...');
            await this.copyGUIToInstallLocation();
            await this.copyCLIToInstallLocation();

            // Step 4: Prompt for system configuration options
            Logger.debug('Step 3/5: Gathering system configuration preferences...');
            const configOptions = await this.promptForSystemConfiguration();

            // Step 5: Update system PATH if requested
            Logger.debug('Step 4/5: Applying system configuration...');
            await this.updateSystemPath(configOptions);

            // Step 6: Create Windows shortcuts if requested
            if (this.currentPlatform === Platform.Windows) {
                await this.createWindowsShortcuts(configOptions);
            }

            // Step 7: Generate and display installation report
            Logger.debug('Step 5/5: Generating installation report...');
            await this.generateInstallationReport();

            // Log success message with installation location
            Logger.success('='.repeat(80));
            Logger.success('INSTALLATION COMPLETED SUCCESSFULLY');
            Logger.success('='.repeat(80));
            Logger.success(`File Mover Express has been installed to: ${this.installationReport.installPath}`);
            Logger.success('');

            // Provide platform-specific next steps
            if (this.currentPlatform === Platform.Windows) {
                Logger.info('Next steps:');
                Logger.info('  - Restart your terminal or applications for PATH changes to take effect');
                if (configOptions.createStartMenuShortcut) {
                    Logger.info('  - Launch from Start Menu or use the desktop shortcut');
                }
            } else {
                Logger.info('Next steps:');
                Logger.info('  - Restart your terminal or run: source ~/.bashrc (or ~/.zshrc, ~/.config/fish/config.fish)');
                Logger.info(`  - Run "${this.getCLIBinaryDestinationFilename()}" from any terminal location`);
            }

        } catch (error) {
            // Error handling and cleanup
            Logger.error('Installation failed', error instanceof Error ? error : undefined);

            // Log detailed error information
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            Logger.error(`Error details: ${errorMessage}`);
            if (errorStack) {
                Logger.error(`Stack trace: ${errorStack}`);
            }

            // Attempt cleanup of partial installation
            Logger.info('Attempting to clean up partial installation...');
            const installPath = this.installationReport.installPath;

            if (installPath) {
                await fs.rm(installPath, {recursive: true, force: true});
                Logger.info(`Cleaned up partial installation at: ${installPath}`);
            }

            // Re-throw the error to signal failure
            throw new Error(`Installation failed: ${errorMessage}`);
        }
    }


    /**
     * Returns the OS-appropriate installation path for File Mover Express CLI
     * @returns The installation path for the current platform
     * @throws Error if the platform is unsupported
     */
    getCLIInstallPath(): string {
        switch (this.currentPlatform) {
            case Platform.Windows: {
                const localAppData = process.env.LOCALAPPDATA;
                if (!localAppData) {
                    throw new Error('LOCALAPPDATA environment variable is not set');
                }
                return `${localAppData}/Programs/File Mover Express/bin`;
            }
            case Platform.Linux:
                return '/opt/FileMoverExpress/bin';
            case Platform.Darwin: {
                const home = process.env.HOME;
                if (!home) {
                    throw new Error('HOME environment variable is not set');
                }
                return `${home}/Applications/File Mover Express.app/Contents/Resources/bin`;
            }
            default:
                throw new Error(`Unsupported platform: ${this.currentPlatform}`);
        }
    }

    /**
     * Returns the OS-appropriate installation path for File Mover Express GUI
     * @returns The installation path for the current platform
     * @throws Error if the platform is unsupported
     */
    getGUIInstallPath(): string {
        switch (this.currentPlatform) {
            case Platform.Windows: {
                const localAppData = process.env.LOCALAPPDATA;
                if (!localAppData) {
                    throw new Error('LOCALAPPDATA environment variable is not set');
                }
                return `${localAppData}/Programs/File Mover Express`;
            }
            case Platform.Linux:
                return '/opt/FileMoverExpress';
            case Platform.Darwin: {
                const home = process.env.HOME;
                if (!home) {
                    throw new Error('HOME environment variable is not set');
                }
                return `${home}/Applications/File Mover Express.app`;
            }
            default:
                throw new Error(`Unsupported platform: ${this.currentPlatform}`);
        }
    }

    /**
     * Packages the application using ElectronPackager
     * Verifies that packaged files exist in the expected directory structure
     * @throws Error if packaging fails or files don't exist
     */
    private async packageApplication(): Promise<void> {
        Logger.info('Starting application packaging...');

        await this.electronPackager.package();
        // Verify packaged files exist in expected directory structure
        const expectedPath = this.getPackagedAppPath();

        Logger.debug(`Verifying packaged application at: ${expectedPath}`);

        // Check if the expected directory exists
        try {
            await fs.access(expectedPath);
            Logger.success(`Packaged application verified at: ${expectedPath}`);
        } catch (error) {
            throw new Error(
                `Packaged application not found at expected location: ${expectedPath}. ` +
                `Packaging may have failed or the directory structure is incorrect.`,
            );
        }
    }

    /**
     * Returns the path to the packaged application directory
     * Expected structure: dist/<app-name>-<platform>-<arch>/File Mover Express
     */
    getPackagedAppPath(): string {
        const appName = electronConfig.appName;
        let suffix = '';

        // Map Platform enum to electron packager platform names
        let platformName: string;
        switch (this.currentPlatform) {
            case Platform.Darwin:
                platformName = 'darwin';
                suffix = '.app';
                break;
            case Platform.Linux:
                platformName = 'linux';
                break;
            case Platform.Windows:
                platformName = 'win32';
                break;
            default:
                throw new Error(`Unsupported platform: ${this.currentPlatform}`);
        }

        const outputDir = `${appName}-${platformName}-${this._currentArchitecture}`;
        const projectRoot = PathResolver.getProjectRoot();

        return path.join(projectRoot, 'dist', outputDir, appName + suffix);
    }

    private async copyCLIToInstallLocation(): Promise<void> {
        const [cliDestName, cliSourceName] = [this.getCLIBinaryDestinationFilename(), this.getCLIBinarySourceFilename()];
        const sourcePath = path.join(PathResolver.getProjectRoot(), 'dist', cliSourceName);
        const destinationPath = path.join(this.getCLIInstallPath(), cliDestName);

        // Create destination directory
        await fs.mkdir(this.getCLIInstallPath(), {recursive: true});

        // Copy all CLI files
        await fs.copyFile(sourcePath, destinationPath);
    }

    /**
     * Copies the packaged application to the OS-specific installation location
     * Strips the architecture folder from the source path
     * Removes existing installation if present
     * Records all file copy operations in the installation report
     * @throws Error if copy operation fails
     */
    private async copyGUIToInstallLocation(): Promise<void> {
        Logger.debug('Starting file copy to installation location...');
        const destinationPath = this.getGUIInstallPath();

        try {
            // Determine source path from ElectronPackager output
            const sourcePath = this.getPackagedAppPath();
            Logger.debug(`Source path: ${sourcePath}`);

            // Determine destination path
            Logger.debug(`Destination path: ${destinationPath}`);

            // Update installation report with install path
            this.installationReport.installPath = destinationPath;

            // Check if destination exists and remove it if present
            try {
                await fs.access(destinationPath);
                Logger.debug(`Existing installation found at ${destinationPath}, removing...`);
                await fs.rm(destinationPath, {recursive: true, force: true});
                Logger.success('Existing installation removed');
            } catch (error) {
                // Destination doesn't exist, which is fine
                Logger.debug('No existing installation found');
            }

            // Recursively copy all files from source to destination
            await this.copyDirectory(sourcePath, destinationPath);

            Logger.debug(`Successfully copied ${this.installationReport.filesCopied.length} files to ${destinationPath}`);
        } catch (error) {
            Logger.error('File copy operation failed', error instanceof Error ? error : undefined);

            // Attempt cleanup on failure
            try {
                await fs.rm(destinationPath, {recursive: true, force: true});
                Logger.info('Cleaned up partial installation');
            } catch (cleanupError) {
                const cleanupMsg = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
                Logger.warn(`Failed to clean up partial installation: ${cleanupMsg}`);
            }

            throw new Error(
                `Failed to copy files to installation location: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Recursively copies a directory and all its contents
     * Records each file copy operation in the installation report
     * Handles symlinks by recreating them at the destination
     * @param source Source directory path
     * @param destination Destination directory path
     */
    private async copyDirectory(source: string, destination: string): Promise<void> {
        // Create destination directory
        await fs.mkdir(destination, {recursive: true});

        // Read source directory contents
        const entries = await fs.readdir(source, {withFileTypes: true});

        // Copy each entry
        for (const entry of entries) {
            const sourcePath = path.join(source, entry.name);
            const destPath = path.join(destination, entry.name);

            // Check if entry is a symlink using lstat (doesn't follow symlinks)
            const stats = await fs.lstat(sourcePath);

            if (stats.isSymbolicLink()) {
                // Handle symlink by reading the link target and recreating it
                const linkTarget = await fs.readlink(sourcePath);
                await fs.symlink(linkTarget, destPath);

                // Record symlink creation
                this.installationReport.filesCopied.push({
                    source: sourcePath,
                    destination: destPath,
                    size: 0, // Symlinks don't have meaningful size
                });
            } else if (entry.isDirectory()) {
                // Recursively copy subdirectory
                await this.copyDirectory(sourcePath, destPath);
            } else {
                // Copy file
                await fs.copyFile(sourcePath, destPath);

                // Get file size and record the copy operation
                this.installationReport.filesCopied.push({
                    source: sourcePath,
                    destination: destPath,
                    size: stats.size,
                });
            }
        }
    }

    /**
     * Prompts the user for system configuration preferences
     * Asks about PATH update on all platforms
     * On Windows, also asks about Start Menu and Desktop shortcuts
     * @returns SystemConfigOptions object with user choices
     */
    private async promptForSystemConfiguration(): Promise<SystemConfigOptions> {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        // Helper function to ask a yes/no question
        const askQuestion = (question: string): Promise<boolean> => {
            return new Promise((resolve) => {
                rl.question(question, (answer) => {
                    const normalized = answer.trim().toLowerCase();
                    resolve(normalized === 'y' || normalized === 'yes');
                });
            });
        };

        try {
            // Ask about PATH update on all platforms
            const updatePath = await askQuestion('Would you like to add File Mover Express to your system PATH? (y/n) ');

            const options: SystemConfigOptions = {
                updatePath,
            };

            // On Windows, also ask about shortcuts
            if (this.currentPlatform === Platform.Windows) {
                const createStartMenuShortcut = await askQuestion('Would you like to create a Start Menu shortcut? (y/n) ');
                const createDesktopShortcut = await askQuestion('Would you like to create a Desktop shortcut? (y/n) ');

                options.createStartMenuShortcut = createStartMenuShortcut;
                options.createDesktopShortcut = createDesktopShortcut;
            }

            return options;
        } finally {
            rl.close();
        }
    }

    /**
     * Updates shell-specific configuration files to add the install directory to PATH
     * Checks if PATH entry already exists before adding (idempotent)
     * Records modification in installation report
     * @param shell The shell type to update configuration for
     * @throws Error if shell config file cannot be accessed or modified
     */
    private async updateShellConfiguration(shell: ShellType): Promise<void> {
        Logger.info(`Updating shell configuration for ${shell}...`);

        // Determine shell config file path based on shell type
        let configFilePath: string;
        const home = process.env.HOME;

        if (!home) {
            throw new Error('HOME environment variable is not set');
        }

        switch (shell) {
            case ShellType.Bash:
                configFilePath = path.join(home, '.bashrc');
                break;
            case ShellType.Zsh:
                configFilePath = path.join(home, '.zshrc');
                break;
            case ShellType.Fish:
                configFilePath = path.join(home, '.config', 'fish', 'config.fish');
                break;
            default:
                throw new Error(`Unsupported shell type: ${shell}`);
        }

        Logger.info(`Shell config file: ${configFilePath}`);

        try {
            // Get the install path to add to PATH
            const installPath = this.getCLIInstallPath();

            // Create the PATH export line based on shell type
            let pathExportLine: string;
            if (shell === ShellType.Fish) {
                // Fish uses different syntax
                pathExportLine = `set -gx PATH "${installPath}" $PATH`;
            } else {
                // Bash and Zsh use similar syntax
                pathExportLine = `export PATH="${installPath}:$PATH"`;
            }

            // Check if the config file exists
            let fileContent = '';
            try {
                fileContent = await fs.readFile(configFilePath, 'utf-8');
            } catch (error) {
                // File doesn't exist, we'll create it
                Logger.info(`Config file ${configFilePath} does not exist, will create it`);
            }

            // Check if PATH entry already exists (idempotent)
            if (fileContent.includes(installPath)) {
                Logger.info(`PATH entry for ${installPath} already exists in ${configFilePath}, skipping`);
                return;
            }

            // Append PATH export line to config file
            const lineToAdd = `\n# Added by File Mover Express installer\n${pathExportLine}\n`;

            // Ensure parent directory exists (for Fish config)
            const configDir = path.dirname(configFilePath);
            await fs.mkdir(configDir, {recursive: true});

            // Append to file
            await fs.appendFile(configFilePath, lineToAdd, 'utf-8');

            // Record modification in installation report
            this.installationReport.shellConfigModifications.push({
                shell,
                configFile: configFilePath,
                lineAdded: pathExportLine,
            });

            Logger.success(`Successfully updated ${configFilePath}`);
        } catch (error) {
            Logger.error(`Failed to update shell configuration`, error instanceof Error ? error : undefined);
            throw new Error(
                `Failed to update shell configuration file ${configFilePath}: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Updates Windows user PATH environment variable to include the install directory
     * Uses PowerShell to modify the registry (more reliable than setx for long paths)
     * Checks if PATH already contains install directory (idempotent)
     * Records modification in installation report
     * @throws Error if PATH update fails
     */
    private async updateWindowsPath(): Promise<void> {
        Logger.info('Updating Windows user PATH...');

        try {
            // Get the install path to add to PATH
            const installPath = this.getGUIInstallPath();

            // Get current user PATH value from registry using PowerShell
            const getCurrentPathCommand = `powershell -Command "[Environment]::GetEnvironmentVariable('Path', 'User')"`;
            const currentPath = execSync(getCurrentPathCommand, {encoding: 'utf-8'}).trim();

            Logger.info(`Current user PATH: ${currentPath}`);

            // Check if PATH already contains install directory (idempotent)
            const pathEntries = currentPath.split(';').map((entry: string) => entry.trim());
            const normalizedInstallPath = installPath.replace(/\//g, '\\');

            if (pathEntries.some((entry: string) => entry.toLowerCase() === normalizedInstallPath.toLowerCase())) {
                Logger.info(`PATH already contains ${installPath}, skipping update`);
                return;
            }

            // Append install directory to PATH
            const newPath = currentPath ? `${currentPath};${normalizedInstallPath}` : normalizedInstallPath;

            // Update PATH using PowerShell (more reliable than setx for long paths)
            const setPathCommand = `powershell -Command "[Environment]::SetEnvironmentVariable('Path', '${newPath.replace(
                /'/g,
                "''",
            )}', 'User')"`;
            execSync(setPathCommand, {encoding: 'utf-8'});

            // Record modification in installation report
            this.installationReport.pathModifications.push({
                type: 'user',
                previousValue: currentPath,
                newValue: newPath,
            });

            Logger.success('Successfully updated Windows user PATH');
            Logger.info('Note: You may need to restart your terminal or applications for the PATH change to take effect');
        } catch (error) {
            Logger.error('Failed to update Windows PATH', error instanceof Error ? error : undefined);
            throw new Error(
                `Failed to update Windows user PATH: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Updates the system PATH variable based on user preferences and platform
     * On Windows, updates the user PATH environment variable
     * On Linux/macOS, detects the current shell and updates the appropriate shell configuration file
     * @param options System configuration options from user prompts
     * @throws Error if PATH update fails on any platform
     */
    private async updateSystemPath(options: SystemConfigOptions): Promise<void> {
        // Check if user opted in to PATH update
        if (!options.updatePath) {
            Logger.debug('User declined PATH update, skipping...');
            return;
        }

        Logger.debug('Updating system PATH...');

        // Platform-specific PATH update logic
        if (this.currentPlatform === Platform.Windows) {
            // On Windows, call Windows PATH update logic
            await this.updateWindowsPath();
        } else {
            // On Linux/macOS, detect shell and update shell configuration
            const shell = detectCurrentShell();
            Logger.debug(`Detected shell: ${shell}`);
            await this.updateShellConfiguration(shell);
        }

        Logger.success('System PATH updated successfully');
    }

    /**
     * Creates Windows shortcuts based on user preferences
     * Uses PowerShell to create .lnk files for Start Menu and Desktop
     * Logs warnings but does not fail if shortcut creation fails
     * Records each shortcut in installation report
     * @param options System configuration options from user prompts
     */
    async createWindowsShortcuts(options: SystemConfigOptions): Promise<void> {
        // Only create shortcuts on Windows
        if (this.currentPlatform !== Platform.Windows) {
            Logger.info('Shortcut creation is only supported on Windows, skipping...');
            return;
        }

        Logger.debug('Creating Windows shortcuts...');

        const installPath = this.getGUIInstallPath();
        const exePath = path.join(installPath, 'File Mover Express.exe');

        // Create Start Menu shortcut if requested
        if (options.createStartMenuShortcut) {
            try {
                Logger.info('Creating Start Menu shortcut...');

                // Get Start Menu Programs folder path
                const startMenuPath = process.env.APPDATA;
                if (!startMenuPath) {
                    throw new Error('APPDATA environment variable is not set');
                }

                const shortcutPath = path.join(
                    startMenuPath,
                    'Microsoft',
                    'Windows',
                    'Start Menu',
                    'Programs',
                    'File Mover Express.lnk',
                );

                // Create shortcut using PowerShell
                const psCommand = `
					$WshShell = New-Object -ComObject WScript.Shell;
					$Shortcut = $WshShell.CreateShortcut('${shortcutPath.replace(/'/g, "''")}');
					$Shortcut.TargetPath = '${exePath.replace(/'/g, "''")}';
					$Shortcut.WorkingDirectory = '${installPath.replace(/'/g, "''")}';
					$Shortcut.Description = 'File Mover Express Application';
					$Shortcut.Save();
				`.replace(/\n\s+/g, ' ').trim();

                execSync(`powershell -Command "${psCommand}"`, {encoding: 'utf-8'});

                // Record shortcut creation in installation report
                this.installationReport.shortcutsCreated.push({
                    type: 'start-menu',
                    path: shortcutPath,
                    target: exePath,
                });

                Logger.success(`Start Menu shortcut created at: ${shortcutPath}`);
            } catch (error) {
                // Log warning but don't fail installation
                const errorMsg = error instanceof Error ? error.message : String(error);
                Logger.warn(`Failed to create Start Menu shortcut: ${errorMsg}`);
                Logger.info('Installation will continue without Start Menu shortcut');
            }
        }

        // Create Desktop shortcut if requested
        if (options.createDesktopShortcut) {
            try {
                Logger.info('Creating Desktop shortcut...');

                // Get Desktop folder path
                const userProfile = process.env.USERPROFILE;
                if (!userProfile) {
                    throw new Error('USERPROFILE environment variable is not set');
                }

                const shortcutPath = path.join(userProfile, 'Desktop', 'File Mover Express.lnk');

                // Create shortcut using PowerShell
                const psCommand = `
					$WshShell = New-Object -ComObject WScript.Shell;
					$Shortcut = $WshShell.CreateShortcut('${shortcutPath.replace(/'/g, "''")}');
					$Shortcut.TargetPath = '${exePath.replace(/'/g, "''")}';
					$Shortcut.WorkingDirectory = '${installPath.replace(/'/g, "''")}';
					$Shortcut.Description = 'File Mover Express Application';
					$Shortcut.Save();
				`.replace(/\n\s+/g, ' ').trim();

                execSync(`powershell -Command "${psCommand}"`, {encoding: 'utf-8'});

                // Record shortcut creation in installation report
                this.installationReport.shortcutsCreated.push({
                    type: 'desktop',
                    path: shortcutPath,
                    target: exePath,
                });

                Logger.success(`Desktop shortcut created at: ${shortcutPath}`);
            } catch (error) {
                // Log warning but don't fail installation
                const errorMsg = error instanceof Error ? error.message : String(error);
                Logger.warn(`Failed to create Desktop shortcut: ${errorMsg}`);
                Logger.info('Installation will continue without Desktop shortcut');
            }
        }

        // Log summary
        const shortcutsCreated = this.installationReport.shortcutsCreated.length;
        if (shortcutsCreated > 0) {
            Logger.success(`Successfully created ${shortcutsCreated} shortcut(s)`);
        } else {
            Logger.info('No shortcuts were created');
        }
    }

    /**
     * Generates and displays the installation report
     * Formats the report as human-readable text and displays it to the console
     * Saves the report as JSON file to <install-path>/installation-report.json
     * Includes all recorded operations (files, PATH, shortcuts, shell configs)
     * @throws Error if report file cannot be written
     */
    private async generateInstallationReport(): Promise<void> {
        Logger.debug('Generating installation report...');

        // Format report as human-readable text
        const reportLines: string[] = [];
        reportLines.push('='.repeat(80));
        reportLines.push('INSTALLATION REPORT');
        reportLines.push('='.repeat(80));
        reportLines.push('');
        reportLines.push(`Timestamp: ${this.installationReport.timestamp.toISOString()}`);

        // Format platform name with proper capitalization
        const platformName = this.installationReport.platform === Platform.Darwin
            ? 'macOS'
            : this.installationReport.platform.charAt(0).toUpperCase() + this.installationReport.platform.slice(1);
        reportLines.push(`Platform: ${platformName}`);
        reportLines.push(`Architecture: ${this.installationReport.architecture}`);
        reportLines.push(`Installation Path: ${this.installationReport.installPath}`);
        reportLines.push('');

        // Files copied section
        reportLines.push('-'.repeat(80));
        reportLines.push('FILES COPIED');
        reportLines.push('-'.repeat(80));
        if (this.installationReport.filesCopied.length > 0) {
            const totalSize = this.installationReport.filesCopied.reduce((sum, file) => sum + file.size, 0);
            const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
            reportLines.push(`Total files: ${this.installationReport.filesCopied.length}`);
            reportLines.push(`Total size: ${totalSizeMB} MB`);
            reportLines.push('');
            // Show first 10 files as examples
            const filesToShow = this.installationReport.filesCopied.slice(0, 10);
            filesToShow.forEach(file => {
                const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
                reportLines.push(`  ${file.destination} (${sizeMB} MB)`);
            });
            if (this.installationReport.filesCopied.length > 10) {
                reportLines.push(`  ... and ${this.installationReport.filesCopied.length - 10} more files`);
            }
        } else {
            reportLines.push('No files copied');
        }
        reportLines.push('');

        // PATH modifications section
        reportLines.push('-'.repeat(80));
        reportLines.push('PATH MODIFICATIONS');
        reportLines.push('-'.repeat(80));
        if (this.installationReport.pathModifications.length > 0) {
            this.installationReport.pathModifications.forEach(mod => {
                reportLines.push(`Type: ${mod.type}`);
                reportLines.push(`Previous: ${mod.previousValue}`);
                reportLines.push(`New: ${mod.newValue}`);
                reportLines.push('');
            });
        } else {
            reportLines.push('No PATH modifications');
            reportLines.push('');
        }

        // Shell configuration modifications section
        reportLines.push('-'.repeat(80));
        reportLines.push('SHELL CONFIGURATION MODIFICATIONS');
        reportLines.push('-'.repeat(80));
        if (this.installationReport.shellConfigModifications.length > 0) {
            this.installationReport.shellConfigModifications.forEach(mod => {
                reportLines.push(`Shell: ${mod.shell}`);
                reportLines.push(`Config File: ${mod.configFile}`);
                reportLines.push(`Line Added: ${mod.lineAdded}`);
                reportLines.push('');
            });
        } else {
            reportLines.push('No shell configuration modifications');
            reportLines.push('');
        }

        // Shortcuts created section
        reportLines.push('-'.repeat(80));
        reportLines.push('SHORTCUTS CREATED');
        reportLines.push('-'.repeat(80));
        if (this.installationReport.shortcutsCreated.length > 0) {
            this.installationReport.shortcutsCreated.forEach(shortcut => {
                reportLines.push(`Type: ${shortcut.type}`);
                reportLines.push(`Path: ${shortcut.path}`);
                reportLines.push(`Target: ${shortcut.target}`);
                reportLines.push('');
            });
        } else {
            reportLines.push('No shortcuts created');
            reportLines.push('');
        }

        reportLines.push('='.repeat(80));
        reportLines.push('');

        // Display report to console
        const reportText = reportLines.join('\n');
        Logger.debug(reportText);

        // Save report as JSON file
        const reportFilePath = path.join(this.installationReport.installPath, 'installation-report.json');

        // Create a serializable version of the report (convert Date to string)
        const serializableReport = {
            ...this.installationReport,
            timestamp: this.installationReport.timestamp.toISOString(),
        };

        await fs.writeFile(reportFilePath, JSON.stringify(serializableReport, null, 2), 'utf-8');

        Logger.debug(`Installation report saved to: ${reportFilePath}`);
    }

    private getCLIBinaryDestinationFilename(): string {
        if (this.currentPlatform === Platform.Windows) {
            return `${this.baseName}.exe`;
        }

        return this.baseName;
    }

    private getCLIBinarySourceFilename(): string {
        const archSuffix = this._currentArchitecture === Architecture.ARM64 ? '-arm64' : '';

        if (this.currentPlatform === Platform.Windows) {
            return `${this.baseName}${archSuffix}.exe`;
        }

        return `${this.baseName}-${this.currentPlatform}${archSuffix}`;
    }
}
