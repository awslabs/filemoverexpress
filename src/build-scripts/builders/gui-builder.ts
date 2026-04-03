import path from 'node:path';
import {BuildOptions} from '../types/build-target';
import {GUIBuildConfig} from '../types/config';
import {CommandRunner} from '../utils/command-runner';
import {Logger} from '../utils/logger';
import {PathResolver} from '../utils/path-resolver';
import {BaseBuilder} from './base-builder';

export class GUIBuilder extends BaseBuilder {
    constructor(private config: GUIBuildConfig) {
        super();
    }

    get cleanupPaths(): string[] {
        return [path.join(PathResolver.getGUIDir(), this.config.angularConfig.outputPath)];
    }

    async build(options: BuildOptions): Promise<void> {
        const {configuration, baseHref} = this.config.angularConfig;

        Logger.debug(`Building Angular project (${configuration})`);

        const args = [
            'build',
            `--configuration=${configuration}`,
            `--base-href=${baseHref}`,
        ];
        Logger.debug(`Angular build command: ng ${args.join(' ')}`);

        const guiDir = PathResolver.getGUIDir();

        const result = await CommandRunner.run('ng', args, {
            cwd: guiDir,
            verbose: options.verbose ?? false,
        });

        if (result.exitCode !== 0) {
            Logger.error(`Angular build failed with exit code ${result.exitCode}`);
            if (result.stderr) {
                Logger.error(result.stderr);
            }
            throw new Error(`Angular build failed: ${result.stderr || 'Unknown error'}`);
        }

        Logger.success(`Angular build completed successfully`);
    }
}
