import {rm} from 'node:fs/promises';
import {CommandRunner} from '../utils/command-runner';
import {Logger} from '../utils/logger';
import {PathResolver} from '../utils/path-resolver';

export abstract class BaseBuilder {
    protected abstract cleanupPaths: string[];

    abstract build(...args: any[]): Promise<void>;

    async clean(): Promise<void> {
        await CommandRunner.run('git', ['ls-files', ...this.cleanupPaths], {cwd: PathResolver.getProjectRoot()})
            .then((res) => {
                if (res.exitCode !== 0) {
                    throw new Error(`git ls-files failed: ${res.stderr}`);
                }

                if (res.stdout.trim() !== '') {
                    throw new Error(`One or more files tracked in git, aborting removal: ${res.stderr}`);
                }
            })
            .catch((reason: any) => {
                throw new Error(`Failed to clean ${this.cleanupPaths}: ${reason}`);
            });

        for (const path of this.cleanupPaths) {
            await rm(path, {recursive: true, force: true})
                .then(() => Logger.debug(`Successfully removed ${path}`))
                .catch((err) => {
                    throw new Error(`Failed to remove ${path}: ${err}`);
                });
        }
    }
}
