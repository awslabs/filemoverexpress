import {OfficialArch, OfficialPlatform, Options, packager} from '@electron/packager';
import fs from 'fs/promises';
import path from 'path';
import {CLIBuilder} from '../builders/cli-builder';
import {ElectronBuilder} from '../builders/electron-builder';
import {GUIBuilder} from '../builders/gui-builder';
import {ProtobufBuilder} from '../builders/protobuf-builder';
import {cliConfig} from '../config/cli-config';
import {guiConfig} from '../config/gui-config';
import {ElectronPackagerConfig} from '../types/config';
import {Platform, PlatformConfig} from '../types/platform';
import {CommandRunner} from '../utils/command-runner';
import {Logger} from '../utils/logger';
import {PathResolver} from '../utils/path-resolver';
import {TempDirManager} from '../utils/temp-dir-manager';
import {BasePackager} from './base-packager';

export class ElectronPackager extends BasePackager {
    private readonly cliBuilder: CLIBuilder;
    private readonly guiBuilder: GUIBuilder;
    private readonly protobufBuilder: ProtobufBuilder;
    private readonly electronBuilder: ElectronBuilder;

    constructor(private config: ElectronPackagerConfig) {
        super();

        const buildConfig = {...cliConfig};
        buildConfig.platforms = this.config.platforms;
        this.cliBuilder = new CLIBuilder(buildConfig);
        this.guiBuilder = new GUIBuilder(guiConfig);
        this.protobufBuilder = new ProtobufBuilder();
        this.electronBuilder = new ElectronBuilder();
    }

    get cleanupPaths(): string[] {
        return [];
    }

    async package(): Promise<void> {
        await this.buildPackages();

        for (const platform of this.config.platforms) {
            await this.packageForPlatform(platform);
            await this.verifyPackagedApp(platform);
        }
    }

    async packageForPlatform(platform: PlatformConfig): Promise<void> {
        Logger.debug(`Packaging Electron app for ${platform.platform}-${platform.arch}`);

        const tempDirManager = new TempDirManager();
        const outputPath = path.join(PathResolver.getProjectRoot(), this.config.outputPath);

        const stagingDir = tempDirManager.createTempDir({prefix: 'electron-build-'});

        try {
            Logger.debug(`Using staging directory: ${stagingDir}`);

            // Stage all files
            await this.stageFiles(stagingDir, platform);

            const iconPath = this.config.electronConfig.iconPaths[platform.platform];

            const packagerOptions: Options = {
                dir: stagingDir,
                name: this.config.electronConfig.appName,
                platform: this.mapPlatform(platform.platform),
                arch: platform.arch as OfficialArch,
                out: outputPath,
                appBundleId: this.config.electronConfig.appBundleId,
                helperBundleId: this.config.electronConfig.helperBundleId,
                overwrite: this.config.electronConfig.packagerOptions.overwrite,
                prune: this.config.electronConfig.packagerOptions.prune,
                asar: this.config.electronConfig.packagerOptions.asar,
            };

            if (iconPath) {
                packagerOptions.icon = path.join(stagingDir, iconPath);
            }

            Logger.debug(`Packaging with options: ${JSON.stringify(packagerOptions, null, 2)}`);

            try {
                const appPaths = await packager(packagerOptions);
                Logger.success(
                    `Successfully packaged Electron app for ${platform.platform}-${platform.arch} at: ${appPaths[0]}`,
                );
            } catch (error) {
                throw new Error(
                    `Electron packaging failed for ${platform.platform}-${platform.arch}: ${error instanceof Error ? error.message : String(
                        error)}`,
                );
            }
        } finally {
            // Clean up staging directory
            await fs.rm(stagingDir, {recursive: true, force: true});
        }
    }

    private async buildPackages(): Promise<void> {
        await this.protobufBuilder.build().catch(
            (reason) => {
                Logger.error('Failed to generate Protobuf definitions', reason);
                process.exit(1);
            },
        );

        Promise.all([
            await this.electronBuilder.build(),
            await this.cliBuilder.build(this.config.options),
            await this.guiBuilder.build(this.config.options),
        ]).catch(
            (reason) => {
                Logger.error('Failed to building one or more packages', reason);
                process.exit(1);
            },
        );
    }

    private async verifyPackagedApp(platform: PlatformConfig): Promise<void> {
        const outputPath = path.join(PathResolver.getProjectRoot(), this.config.outputPath);

        const expectedAppName = this.getExpectedAppName(platform);
        const expectedPath = path.join(outputPath, expectedAppName);

        try {
            await fs.access(expectedPath);
            Logger.info(`Verified packaged application exists at: ${expectedPath}`);
        } catch (error) {
            throw new Error(
                `Packaged application not found at expected location: ${expectedPath}`,
            );
        }
    }

    private mapPlatform(platform: Platform): OfficialPlatform {
        switch (platform) {
            case Platform.Darwin:
                return 'darwin';
            case Platform.Linux:
                return 'linux';
            case Platform.Windows:
                return 'win32';
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }
    }

    private getExpectedAppName(platform: PlatformConfig): string {
        const appName = this.config.electronConfig.appName;
        const electronPlatform = this.mapPlatform(platform.platform);

        return `${appName}-${electronPlatform}-${platform.arch}`;
    }

    private async stageFiles(stagingDir: string, platform: PlatformConfig): Promise<void> {
        Logger.debug(`Staging files for ${platform.platform}-${platform.arch} to: ${stagingDir}`);

        const electronDir = PathResolver.getElectronDir();
        const guiDistDir = path.join(PathResolver.getGUIDir(), 'dist', 'browser');

        // Define source and destination paths
        const electronPackageJson = path.join(electronDir, 'package.json');
        const electronDistDir = path.join(electronDir, 'dist');
        const electronAssetsDir = path.join(electronDir, 'assets');

        // Copy electron package.json
        try {
            await fs.access(electronPackageJson);
            await fs.copyFile(electronPackageJson, path.join(stagingDir, 'package.json'));
            Logger.debug('Copied electron package.json');
        } catch (error) {
            throw new Error(
                `Electron package.json not found at ${electronPackageJson}. ` +
                `Please ensure the electron package is properly configured.`,
            );
        }

        // Copy electron dist files
        try {
            await fs.access(electronDistDir);
            const distFiles = await fs.readdir(electronDistDir);
            for (const file of distFiles) {
                const srcPath = path.join(electronDistDir, file);
                const destPath = path.join(stagingDir, file);
                const stat = await fs.stat(srcPath);
                if (stat.isDirectory()) {
                    await fs.cp(srcPath, destPath, {recursive: true});
                } else {
                    await fs.copyFile(srcPath, destPath);
                }
            }
            Logger.debug('Copied electron dist files');
        } catch (error) {
            throw new Error(
                `Electron dist files not found at ${electronDistDir}. ` +
                `Please build the electron package first using 'npm run build:electron'.`,
            );
        }

        // Copy electron assets
        try {
            await fs.access(electronAssetsDir);
            await fs.cp(electronAssetsDir, path.join(stagingDir, 'assets'), {recursive: true});
            Logger.debug('Copied electron assets');
        } catch (error) {
            throw new Error(
                `Electron assets not found at ${electronAssetsDir}. ` +
                `Please ensure the electron assets directory exists.`,
            );
        }

        // Copy GUI build output to app subdirectory
        try {
            await fs.access(guiDistDir);
            await fs.cp(guiDistDir, path.join(stagingDir, 'app'), {recursive: true});
            Logger.debug('Copied GUI build output to app directory');
        } catch (error) {
            throw new Error(
                `GUI build output not found at ${guiDistDir}. ` +
                `Please build the GUI first using 'npm run build:gui'.`,
            );
        }

        // Run npm install in staging directory to install dependencies
        try {
            await CommandRunner.run('npm', ['install'], {cwd: stagingDir});
            Logger.debug('Installed npm packages');
        } catch (error) {
            throw new Error('Failed to install npm packages');
        }

        Logger.debug('Staging complete');
    }
}
