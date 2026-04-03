import path from 'node:path';
import {CommandRunner} from '../utils/command-runner';
import {Logger} from '../utils/logger';
import {PathResolver} from '../utils/path-resolver';
import {BaseBuilder} from './base-builder';

export class ElectronBuilder extends BaseBuilder {
    get cleanupPaths() {
        return [path.join(PathResolver.getElectronDir(), 'dist')];
    }

    async build(): Promise<void> {
        try {
            await this.clean();
            await CommandRunner.run('npm', ['run', 'build'], {cwd: PathResolver.getElectronDir()})
                .then(() => {
                    Logger.success(`Electron application code built at ${this.cleanupPaths.join(', ')}`);
                })
                .catch((error) => {
                    Logger.error(`Failed to compile Electron application code:`, error);
                });
        } catch (error) {
            throw new Error(`Failed building Electron: ${error}`);
        }
    }
}
