import * as fs from 'fs';
import * as path from 'path';
import {BuildOptions} from '../types/build-target';
import {CLIBuildConfig} from '../types/config';
import {Architecture, Platform, PlatformConfig} from '../types/platform';
import {CommandRunner} from '../utils/command-runner';
import {Logger} from '../utils/logger';
import {PathResolver} from '../utils/path-resolver';
import {toPosix} from '../utils/normalize-path';
import {BaseBuilder} from './base-builder';

export class CLIBuilder extends BaseBuilder {
    private verbose: boolean = false;
    private buildVersion?: string;

    constructor(private config: CLIBuildConfig) {
        super();
    }

    get cleanupPaths(): string[] {
        return [toPosix(path.join(PathResolver.getCLIDir(), this.config.outputDir))];
    }

    async build(options: BuildOptions): Promise<void> {
        this.verbose = options.verbose ?? false;
        this.buildVersion = options.buildVersion;
        const platformsToBuild = this.determinePlatformsToBuild(options);

        if (platformsToBuild.length === 0) {
            Logger.warn('No platforms to build');
            return;
        }

        Logger.debug(`Building CLI for ${platformsToBuild.length} platform(s)...`);

        for (const platform of platformsToBuild) {
            await this.buildForPlatform(platform);

            if (platform.platform === Platform.Windows) {
                await this.buildWindowsDaemonLauncher();
            }
        }

        Logger.success('All CLI builds completed successfully');
    }

    private determinePlatformsToBuild(options: BuildOptions): PlatformConfig[] {
        let platforms = this.config.platforms;

        if (options.platforms && options.platforms.length > 0) {
            platforms = platforms.filter(p =>
                options.platforms!.includes(p.platform),
            );
        }

        if (options.archs && options.archs.length > 0) {
            platforms = platforms.filter(p =>
                options.archs!.includes(p.arch),
            );
        }

        return platforms;
    }

    async buildForPlatform(platform: PlatformConfig): Promise<void> {
        const outputFileName = this.getOutputFileName(platform);
        const outputPath = toPosix(path.join(
            PathResolver.getProjectRoot(),
            this.config.outputDir,
            outputFileName,
        ));

        const env: Record<string, string> = {
            GOOS: platform.platform,
            GOARCH: this.mapArchitecture(platform.arch),
            CGO_ENABLED: '0',
        };

        const buildArgs: string[] = ['build'];

        if (this.config.buildFlags.length > 0) {
            buildArgs.push(...this.config.buildFlags);
        }

        if (this.config.ldFlags.length > 0) {
            const ldFlags = [...this.config.ldFlags];

            if (this.buildVersion) {
                const versionFlag = `-X "main.Version=v${this.buildVersion}"`;
                ldFlags.push(versionFlag);
                Logger.debug(`Injecting version ldflag: ${versionFlag}`);
            }

            buildArgs.push('-ldflags', ldFlags.join(' '));
        }

        buildArgs.push('-o', outputPath);
        buildArgs.push('main.go');

        Logger.debug(`Building CLI for ${platform.platform}/${platform.arch}${(this.verbose && ` (cmd: go ${buildArgs.join(' ')})`)}...`);

        const result = await CommandRunner.run('go', buildArgs, {
            cwd: PathResolver.getCLIDir(),
            env,
            verbose: this.verbose,
        });

        if (result.exitCode !== 0) {
            Logger.error(
                `Build failed for ${platform.platform}/${platform.arch}`,
            );
            throw new Error(
                `Go build failed with exit code ${result.exitCode}\nCommand: go ${buildArgs.join(' ')}\nStderr: ${result.stderr}`,
            );
        }

        if (!fs.existsSync(outputPath)) {
            throw new Error(
                `Build artifact not found at expected path: ${outputPath}`,
            );
        }

        Logger.success(
            `Successfully built CLI for ${platform.platform}/${platform.arch} at ${outputPath}`,
        );
    }

    async buildWindowsDaemonLauncher(): Promise<void> {
        if (!this.config.windowsDaemonLauncherPath) {
            Logger.warn('Windows daemon launcher path not configured, skipping');
            return;
        }

        const launcherDir = toPosix(path.join(
            PathResolver.getProjectRoot(),
            this.config.windowsDaemonLauncherPath,
        ));

        if (!fs.existsSync(launcherDir)) {
            Logger.warn(
                `Windows daemon launcher directory not found at ${launcherDir}, skipping`,
            );
            return;
        }

        const outputFileName = 'filemoverexpress-launcher.exe';
        const outputPath = toPosix(path.join(
            PathResolver.getProjectRoot(),
            this.config.outputDir,
            outputFileName,
        ));

        const env: Record<string, string> = {
            GOOS: Platform.Windows,
            GOARCH: 'amd64',
            CGO_ENABLED: '0',
        };

        const buildArgs: string[] = ['build', '-o', outputPath];

        if (this.config.buildFlags.length > 0) {
            buildArgs.push(...this.config.buildFlags);
        }

        if (this.config.ldFlags.length > 0) {
            buildArgs.push('-ldflags', this.config.ldFlags.join(' '));
        }

        Logger.debug('Building Windows daemon launcher...');
        const result = await CommandRunner.run('go', buildArgs, {
            cwd: launcherDir,
            env,
            verbose: this.verbose,
        });

        if (result.exitCode !== 0) {
            Logger.error('Windows daemon launcher build failed');
            throw new Error(
                `Go build failed with exit code ${result.exitCode}\nCommand: go ${buildArgs.join(' ')}\nStderr: ${result.stderr}`,
            );
        }

        if (!fs.existsSync(outputPath)) {
            throw new Error(
                `Build artifact not found at expected path: ${outputPath}`,
            );
        }

        Logger.success(
            `Successfully built Windows daemon launcher at ${outputPath}`,
        );
    }

    private getOutputFileName(platform: PlatformConfig): string {
        const baseName = 'filemoverexpress';
        const archSuffix = platform.arch === Architecture.ARM64 ? '-arm64' : '';

        if (platform.platform === Platform.Windows) {
            return `${baseName}${archSuffix}.exe`;
        }

        return `${baseName}-${platform.platform}${archSuffix}`;
    }

    private mapArchitecture(arch: Architecture): string {
        switch (arch) {
            case Architecture.X64:
                return 'amd64';
            case Architecture.ARM64:
                return 'arm64';
            default:
                throw new Error(`Unsupported architecture: ${arch}`);
        }
    }
}
