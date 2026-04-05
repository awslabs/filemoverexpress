import * as fs from 'fs';
import * as path from 'path';
import {toPosix} from './normalize-path';

/**
 * Normalizes a file path to always use forward slashes (POSIX-style).
 * This ensures consistent path separators across Windows, macOS, and Linux.
 */
export {toPosix};

export class PathResolver {
    private static projectRoot: string | null = null;

    /**
     * Normalizes a file path to always use forward slashes (POSIX-style).
     * This ensures consistent path separators across Windows, macOS, and Linux.
     */
    static toPosix(filePath: string): string {
        return toPosix(filePath);
    }

    static getProjectRoot(): string {
        if (this.projectRoot) {
            return this.projectRoot;
        }

        let currentDir = path.resolve(__dirname);

        while (currentDir !== path.parse(currentDir).root) {
            const packageJsonPath = path.join(currentDir, 'package.json');
            const srcPath = path.join(currentDir, 'src');
            const buildScriptsPath = path.join(currentDir, 'src', 'build-scripts');

            if (fs.existsSync(packageJsonPath) && fs.existsSync(srcPath) && fs.existsSync(buildScriptsPath)) {
                this.projectRoot = this.toPosix(currentDir);
                return this.projectRoot;
            }

            currentDir = path.dirname(currentDir);
        }

        throw new Error('Could not find project root directory');
    }

    static getCLIDir(): string {
        return this.toPosix(path.join(this.getProjectRoot(), 'src', 'cli'));
    }

    static getGUIDir(): string {
        return this.toPosix(path.join(this.getProjectRoot(), 'src', 'gui'));
    }

    static getElectronDir(): string {
        return this.toPosix(path.join(this.getProjectRoot(), 'src', 'electron'));
    }

    static getBuildScriptsDir(): string {
        return this.toPosix(path.join(this.getProjectRoot(), 'src', 'build-scripts'));
    }

    static getProtobufDir(): string {
        return this.toPosix(path.join(this.getProjectRoot(), 'src', 'protobuf'));
    }

    static resolve(...segments: string[]): string {
        return this.toPosix(path.resolve(...segments));
    }
}
