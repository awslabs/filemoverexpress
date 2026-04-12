import fs from 'fs/promises';
import path from 'node:path';
import {CLIBuilder} from '../builders/cli-builder';
import {ElectronBuilder} from '../builders/electron-builder';
import {GUIBuilder} from '../builders/gui-builder';
import {ProtobufBuilder} from '../builders/protobuf-builder';
import {cliConfig} from '../config/cli-config';
import {electronConfig} from '../config/electron-config';
import {guiConfig} from '../config/gui-config';
import {
    ForgeConfig,
    ForgeInstallerOptions,
    ForgeMakeResult,
    ForgeMakerType,
} from '../types/forge';
import {Architecture, Platform} from '../types/platform';
import {CommandRunner} from '../utils/command-runner';
import {Logger} from '../utils/logger';
import {toPosix} from '../utils/normalize-path';
import {PathResolver} from '../utils/path-resolver';
import {detectCurrentArchitecture, detectCurrentPlatform} from '../utils/platform-detector';
import {TempDirManager} from '../utils/temp-dir-manager';
import {ToolChecker} from '../utils/tool-checker';
import {BaseInstaller} from './base-installer';
import {ForgeConfigGenerator} from './forge-config-generator';
import {ForgeMakerResolver} from './forge-maker-resolver';

/**
 * Electron Forge-based installer generator.
 *
 * Extends BaseInstaller directly because Forge
 * manages its own packaging pipeline internally — it does not consume
 * pre-packaged @electron/packager output. Instead, Forge runs its own
 * packager and then invokes the configured makers.
 *
 * The generation pipeline:
 * 1. Validate platform (no cross-compilation)
 * 2. Check required tools (node, npm)
 * 3. Build all packages (proto, CLI, GUI, Electron) — skipped in devMode if artifacts exist
 * 4. Resolve makers for the target platform
 * 5. Generate Forge configuration from existing ElectronBuildConfig
 * 6. Stage Electron source into a temp directory
 * 7. Resolve icon paths to absolute paths within the staging directory
 * 8. Install Forge dependencies in the staging directory
 * 9. Write forge.config.js
 * 10. Invoke Forge make API
 * 11. Copy output artifacts to dist/
 * 12. Clean up temp directories
 */
export class ForgeInstaller extends BaseInstaller {
    private readonly platform: Platform;
    private readonly architecture: Architecture;
    private readonly requestedMakers?: ForgeMakerType[];
    private readonly verbose: boolean;
    private readonly devMode: boolean;
    private readonly retainTempFiles: boolean;
    private readonly tempDirManager: TempDirManager;
    private readonly tempDirs: string[] = [];
    private readonly baseName = 'filemoverexpress';

    constructor(options?: ForgeInstallerOptions) {
        super();

        const hostPlatform = detectCurrentPlatform();
        const hostArchitecture = detectCurrentArchitecture();

        this.platform = options?.platform ?? hostPlatform;
        this.architecture = options?.architecture ?? hostArchitecture;
        this.requestedMakers = options?.makers;
        this.verbose = options?.verbose ?? false;
        this.devMode = options?.devMode ?? false;
        this.retainTempFiles = options?.retainTempFiles ?? false;
        this.tempDirManager = new TempDirManager();

        // Validate cross-platform override
        if (options?.platform !== undefined && this.platform !== hostPlatform) {
            throw new Error(
                `Cross-platform installer generation is not supported. ` +
                `Requested platform "${this.platform}" but host platform is "${hostPlatform}".`,
            );
        }
    }

    get cleanupPaths(): string[] {
        return [...this.tempDirs];
    }

    async generate(): Promise<void> {
        try {
            Logger.info('Starting Forge installer generation...');
            Logger.debug(`Platform: ${this.platform}, Architecture: ${this.architecture}`);

            // Step 1: Validate platform (no cross-compilation)
            this.validatePlatform();

            // Step 2: Check that node and npm are available
            await this.checkRequiredTools();

            // Step 3: Build all packages (proto, CLI, GUI, Electron) unless devMode skips it
            await this.runBuilds();

            // Step 4: Resolve makers for the target platform
            const makers = ForgeMakerResolver.resolveMakers(
                this.platform,
                this.architecture,
                this.requestedMakers,
            );
            Logger.debug(`Resolved ${makers.length} maker(s): ${makers.map(m => m.type).join(', ')}`);

            // Step 5: Generate Forge configuration
            const configGenerator = new ForgeConfigGenerator(
                electronConfig,
                this.platform,
                this.architecture,
            );
            const forgeConfig = configGenerator.generateConfig(
                makers.map(m => m.config),
            );

            // Step 6: Stage Electron source into temp directory
            const tempDir = this.createTrackedTempDir('forge-build-');
            await this.stageElectronSource(tempDir);

            // Step 7: Resolve icon paths to absolute paths within the staging directory.
            this.resolveIconPaths(forgeConfig, tempDir);

            // Step 8: Install Forge dependencies in staging dir
            await this.installForgeDependencies(tempDir, makers);

            // Step 9: Write forge.config.js into staging dir
            await this.writeForgeConfig(tempDir, forgeConfig);

            // Step 10: Invoke Forge make API
            const results = await this.runForgeMake(tempDir);

            // Step 11: Copy output artifacts to dist/
            const outputPaths = await this.copyOutputToDist(results);

            for (const outputPath of outputPaths) {
                Logger.success(`Installer generated at: ${outputPath}`);
            }

            // Step 12: Cleanup
            await this.cleanup();
        } catch (error) {
            await this.cleanup();
            throw error;
        }
    }

    /**
     * Validates that the target platform matches the host platform.
     * Forge does not support cross-platform builds.
     */
    private validatePlatform(): void {
        const hostPlatform = detectCurrentPlatform();
        if (this.platform !== hostPlatform) {
            throw new Error(
                `Cross-platform installer generation is not supported. ` +
                `Target platform "${this.platform}" does not match host platform "${hostPlatform}".`,
            );
        }
    }

    /**
     * Verifies that node and npm are available on PATH.
     */
    private async checkRequiredTools(): Promise<void> {
        const [nodeCheck, npmCheck] = await Promise.all([
            ToolChecker.checkTool('node', ['--version']),
            ToolChecker.checkTool('npm', ['--version']),
        ]);

        if (!nodeCheck.available) {
            throw new Error(
                'Required tool "node" is not available on PATH. ' +
                'Install Node.js from https://nodejs.org/',
            );
        }
        Logger.debug(`Node.js found: ${nodeCheck.version}`);

        if (!npmCheck.available) {
            throw new Error(
                'Required tool "npm" is not available on PATH. ' +
                'Install Node.js from https://nodejs.org/ (npm is included)',
            );
        }
        Logger.debug(`npm found: ${npmCheck.version}`);
    }

    /**
     * Conditionally runs all builds (protobuf, CLI, GUI, Electron) based on devMode.
     *
     * In normal mode: always runs the full build pipeline.
     * In devMode: skips builds if all required artifacts already exist
     * (Electron dist, GUI dist, CLI binary).
     */
    private async runBuilds(): Promise<void> {
        if (this.devMode) {
            const allExist = await this.checkBuildArtifactsExist();
            if (allExist) {
                Logger.info('Dev mode: skipping builds (all artifacts exist)');
                return;
            }
            Logger.info('Dev mode: some artifacts missing, running builds');
        }

        await this.buildAllPackages();
    }

    /**
     * Checks whether all required build artifacts already exist on disk.
     */
    private async checkBuildArtifactsExist(): Promise<boolean> {
        const electronDistDir = path.join(PathResolver.getElectronDir(), 'dist');
        const guiDistDir = path.join(PathResolver.getGUIDir(), 'dist', 'browser');
        const cliBinaryPath = this.getCLIBinarySourcePath();

        const [electronExists, guiExists, cliExists] = await Promise.all([
            this.pathExists(electronDistDir),
            this.pathExists(guiDistDir),
            this.pathExists(cliBinaryPath),
        ]);

        return electronExists && guiExists && cliExists;
    }

    /**
     * Builds all packages: protobuf definitions first, then CLI, GUI, and
     * Electron main process sequentially.
     *
     * Builds run sequentially because the Electron and GUI builds both use
     * esbuild, and running them concurrently in a shared node_modules
     * monorepo causes native binary version conflicts.
     */
    private async buildAllPackages(): Promise<void> {
        Logger.info('Building all packages...');

        const protobufBuilder = new ProtobufBuilder();
        await protobufBuilder.build();

        const buildConfig = {...cliConfig};
        buildConfig.platforms = [{platform: this.platform, arch: this.architecture}];

        const cliBuilder = new CLIBuilder(buildConfig);
        const guiBuilder = new GUIBuilder(guiConfig);
        const electronBuilder = new ElectronBuilder();

        const buildOptions = {
            production: true,
            verbose: this.verbose,
            platforms: [this.platform],
            archs: [this.architecture],
        };

        await electronBuilder.build();
        await cliBuilder.build(buildOptions);
        await guiBuilder.build(buildOptions);

        Logger.info('All packages built successfully');
    }

    /**
     * Stages the Electron source, GUI build output, assets, and CLI binary
     * into a temporary directory that Forge can consume as an app root.
     *
     * Source-to-destination mapping:
     * 1. src/electron/package.json       → {tempDir}/package.json
     * 2. src/electron/dist/*             → {tempDir}/* (flat copy)
     * 3. src/electron/assets/            → {tempDir}/assets/
     * 4. src/gui/dist/browser/           → {tempDir}/app/
     * 5. dist/filemoverexpress-{plat}*   → {tempDir}/binaries/filemoverexpress[.exe]
     * 6. dist/filemoverexpress-launcher* → {tempDir}/binaries/ (Windows only)
     */
    private async stageElectronSource(tempDir: string): Promise<void> {
        Logger.info('Staging Electron source for Forge...');

        const electronDir = PathResolver.getElectronDir();
        const guiDistDir = toPosix(path.join(PathResolver.getGUIDir(), 'dist', 'browser'));

        // Step 1: Copy Electron package.json
        await fs.copyFile(
            path.join(electronDir, 'package.json'),
            path.join(tempDir, 'package.json'),
        );
        Logger.debug('Staged: package.json');

        // Step 2: Copy compiled Electron main process files
        const electronDistDir = path.join(electronDir, 'dist');
        if (!await this.pathExists(electronDistDir)) {
            throw new Error(
                `Electron build output not found at: ${electronDistDir}. ` +
                'Run "npm run build:electron" before generating the installer.',
            );
        }
        await this.copyDirectoryContents(electronDistDir, tempDir);
        Logger.debug('Staged: Electron dist files');

        // Step 3: Copy Electron static assets
        const electronAssetsDir = path.join(electronDir, 'assets');
        if (await this.pathExists(electronAssetsDir)) {
            await fs.cp(electronAssetsDir, path.join(tempDir, 'assets'), {recursive: true});
            Logger.debug('Staged: Electron assets');
        }

        // Step 4: Copy Angular GUI build output
        if (!await this.pathExists(guiDistDir)) {
            throw new Error(
                `GUI build output not found at: ${guiDistDir}. ` +
                'Run "npm run build:gui" before generating the installer.',
            );
        }
        await fs.cp(guiDistDir, path.join(tempDir, 'app'), {recursive: true});
        Logger.debug('Staged: GUI build output');

        // Step 5: Stage CLI binary (and daemon launcher on Windows)
        await this.stageCLIBinary(tempDir);

        // Step 6: Install production npm dependencies
        Logger.info('Installing production dependencies in staging directory...');
        const npmResult = await CommandRunner.run('npm', ['install', '--omit=dev'], {
            cwd: tempDir,
            verbose: this.verbose,
        });
        if (npmResult.exitCode !== 0) {
            throw new Error(
                `npm install failed in staging directory with exit code ${npmResult.exitCode}.\n` +
                `stderr: ${npmResult.stderr}`,
            );
        }
        Logger.debug('Production dependencies installed');
    }

    /**
     * Copies the platform-specific CLI binary to {appDir}/binaries/
     * with a normalized filename (platform/arch suffix stripped).
     * On Windows, also copies the daemon launcher.
     */
    private async stageCLIBinary(appDir: string): Promise<void> {
        const binariesDir = toPosix(path.join(appDir, 'binaries'));
        await fs.mkdir(binariesDir, {recursive: true});

        // Copy CLI binary
        const cliBinarySource = this.getCLIBinarySourcePath();
        const cliBinaryDest = toPosix(path.join(binariesDir, this.getCLIBinaryDestFilename()));

        if (!await this.pathExists(cliBinarySource)) {
            throw new Error(
                `CLI binary not found at: ${cliBinarySource}. ` +
                `Ensure the CLI has been built for ${this.platform}-${this.architecture}.`,
            );
        }

        await fs.copyFile(cliBinarySource, cliBinaryDest);
        await fs.chmod(cliBinaryDest, 0o755);
        Logger.debug(`Staged CLI binary: ${cliBinaryDest}`);

        // On Windows, also copy the daemon launcher
        if (this.platform === Platform.Windows) {
            const launcherSource = this.getDaemonLauncherSourcePath();
            const launcherDest = toPosix(path.join(binariesDir, 'filemoverexpress-launcher.exe'));

            if (!await this.pathExists(launcherSource)) {
                throw new Error(
                    `Daemon launcher not found at: ${launcherSource}. ` +
                    'Ensure the Windows daemon launcher has been built ' +
                    '(built from src/windows-daemon-launcher/).',
                );
            }

            await fs.copyFile(launcherSource, launcherDest);
            await fs.chmod(launcherDest, 0o755);
            Logger.debug(`Staged daemon launcher: ${launcherDest}`);
        }
    }

    /**
     * Installs @electron-forge/core and all required maker npm packages
     * in the staging directory.
     */
    private async installForgeDependencies(
        tempDir: string,
        makers: Array<{npmPackage: string}>,
    ): Promise<void> {
        const packages = [
            '@electron-forge/core',
            ...new Set(makers.map(m => m.npmPackage)),
        ];

        Logger.info(`Installing Forge dependencies: ${packages.join(', ')}`);

        const result = await CommandRunner.run('npm', [
            'install',
            '--save-dev',
            ...packages,
        ], {cwd: tempDir, verbose: this.verbose});

        if (result.exitCode !== 0) {
            throw new Error(
                `Failed to install Forge dependencies (exit code ${result.exitCode}).\n` +
                `stderr: ${result.stderr}`,
            );
        }

        Logger.debug('Forge dependencies installed');
    }

    /**
     * Writes the Forge configuration as forge.config.js in the staging directory.
     * Uses module.exports for CommonJS compatibility with Forge's config loader.
     */
    private async writeForgeConfig(tempDir: string, config: ForgeConfig): Promise<void> {
        const configPath = toPosix(path.join(tempDir, 'forge.config.js'));
        const configContent = `module.exports = ${JSON.stringify(config, null, 4)};\n`;

        await fs.writeFile(configPath, configContent, 'utf-8');
        Logger.debug(`Wrote Forge config to: ${configPath}`);
    }

    /**
     * Resolves relative icon paths in the Forge config to absolute paths
     * within the staging directory.
     *
     * The electronConfig icon paths are relative to src/electron/
     * (e.g. "assets/icons/mac/icon.icns"). Since assets are staged
     * into {stagingDir}/assets/, we resolve them against the staging dir.
     * Without this, Forge resolves them relative to CWD, causing ENOENT errors.
     */
    private resolveIconPaths(config: ForgeConfig, stagingDir: string): void {
        // Resolve packagerConfig.icon
        if (config.packagerConfig.icon) {
            config.packagerConfig.icon = toPosix(
                path.resolve(stagingDir, config.packagerConfig.icon),
            );
        }

        // Resolve icon paths inside maker configs
        for (const maker of config.makers) {
            this.resolveMakerIconPaths(maker.config, stagingDir);
        }
    }

    /**
     * Recursively resolves icon-related paths in a maker config object.
     * Looks for keys named 'icon', 'setupIcon', or nested within 'options'.
     */
    private resolveMakerIconPaths(
        config: Record<string, unknown>,
        stagingDir: string,
    ): void {
        const iconKeys = ['icon', 'setupIcon'];

        for (const key of iconKeys) {
            if (typeof config[key] === 'string' && config[key]) {
                config[key] = toPosix(
                    path.resolve(stagingDir, config[key] as string),
                );
            }
        }

        // Handle nested 'options' object (used by DEB and RPM makers)
        if (config['options'] && typeof config['options'] === 'object') {
            this.resolveMakerIconPaths(
                config['options'] as Record<string, unknown>,
                stagingDir,
            );
        }
    }

    /**
     * Invokes @electron-forge/core api.make() to produce installer artifacts.
     *
     * Passes explicit `arch` and `platform` so Forge builds architecture-specific
     * installers instead of defaulting to universal binaries on macOS.
     */
    private async runForgeMake(dir: string): Promise<ForgeMakeResult[]> {
        Logger.info('Running Forge make...');

        try {
            // Dynamic import since @electron-forge/core is installed in the staging dir
            const forgePath = path.join(dir, 'node_modules', '@electron-forge', 'core');
            const forge = await import(forgePath);
            const api = forge.api ?? forge.default?.api ?? forge;

            const results: ForgeMakeResult[] = await api.make({
                dir,
                skipPackage: false,
                arch: this.architecture,
                platform: this.toElectronPlatform(),
            });

            if (!results || results.length === 0) {
                throw new Error('Forge make returned no results');
            }

            Logger.debug(`Forge make produced ${results.length} result(s)`);
            return results;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(
                `Forge make failed: ${message}. ` +
                'Check verbose output for details.',
            );
        }
    }

    /**
     * Copies generated installer artifacts from Forge output to dist/.
     */
    private async copyOutputToDist(results: ForgeMakeResult[]): Promise<string[]> {
        const projectRoot = PathResolver.getProjectRoot();
        const distDir = toPosix(path.join(projectRoot, 'dist'));
        await fs.mkdir(distDir, {recursive: true});

        const outputPaths: string[] = [];

        for (const result of results) {
            for (const artifact of result.artifacts) {
                const filename = path.basename(artifact);
                const destPath = toPosix(path.join(distDir, filename));

                await fs.copyFile(artifact, destPath);
                outputPaths.push(destPath);
                Logger.debug(`Copied artifact: ${filename}`);
            }
        }

        if (outputPaths.length === 0) {
            throw new Error('No installer artifacts were produced by Forge make.');
        }

        return outputPaths;
    }

    /**
     * Cleans up temp directories, or logs their paths if retainTempFiles is true.
     */
    private async cleanup(): Promise<void> {
        if (this.tempDirs.length === 0) {
            return;
        }

        if (this.retainTempFiles) {
            Logger.info('Retaining temporary directories:');
            for (const dir of this.tempDirs) {
                Logger.info(`  ${dir}`);
            }
            return;
        }

        for (const dir of this.tempDirs) {
            try {
                await fs.rm(dir, {recursive: true, force: true});
                Logger.debug(`Cleaned up temp directory: ${dir}`);
            } catch (error) {
                Logger.warn(
                    `Failed to clean up temp directory ${dir}: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        }
    }

    /**
     * Creates a temp directory and tracks it for cleanup.
     */
    private createTrackedTempDir(prefix: string): string {
        const tempDir = this.tempDirManager.createTempDir({prefix});
        this.tempDirs.push(tempDir);
        return tempDir;
    }

    /**
     * Copies all files from a source directory into a destination directory (flat copy).
     * Does not copy subdirectories — only immediate files.
     */
    private async copyDirectoryContents(sourceDir: string, destDir: string): Promise<void> {
        const entries = await fs.readdir(sourceDir, {withFileTypes: true});
        for (const entry of entries) {
            const srcPath = path.join(sourceDir, entry.name);
            const destPath = path.join(destDir, entry.name);
            if (entry.isFile()) {
                await fs.copyFile(srcPath, destPath);
            } else if (entry.isDirectory()) {
                await fs.cp(srcPath, destPath, {recursive: true});
            }
        }
    }

    private getCLIBinarySourcePath(): string {
        const projectRoot = PathResolver.getProjectRoot();
        return toPosix(path.join(projectRoot, 'dist', this.getCLIBinarySourceFilename()));
    }

    private getCLIBinarySourceFilename(): string {
        const archSuffix = this.architecture === Architecture.ARM64 ? '-arm64' : '';

        if (this.platform === Platform.Windows) {
            return `${this.baseName}${archSuffix}.exe`;
        }

        return `${this.baseName}-${this.platform}${archSuffix}`;
    }

    private getCLIBinaryDestFilename(): string {
        if (this.platform === Platform.Windows) {
            return `${this.baseName}.exe`;
        }
        return this.baseName;
    }

    private getDaemonLauncherSourcePath(): string {
        const projectRoot = PathResolver.getProjectRoot();
        return toPosix(path.join(projectRoot, 'dist', 'filemoverexpress-launcher.exe'));
    }

    /**
     * Converts the Platform enum to the Electron platform string
     * expected by Forge's `api.make()`.
     */
    private toElectronPlatform(): string {
        switch (this.platform) {
            case Platform.Darwin:
                return 'darwin';
            case Platform.Windows:
                return 'win32';
            case Platform.Linux:
                return 'linux';
            default:
                return this.platform;
        }
    }

    private async pathExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}
