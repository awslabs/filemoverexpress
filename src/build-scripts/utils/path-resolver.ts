import * as fs from 'fs';
import * as path from 'path';

export class PathResolver {
    private static projectRoot: string | null = null;

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
                this.projectRoot = currentDir;
                return currentDir;
            }

            currentDir = path.dirname(currentDir);
        }

        throw new Error('Could not find project root directory');
    }

    static getCLIDir(): string {
        return path.join(this.getProjectRoot(), 'src', 'cli');
    }

    static getGUIDir(): string {
        return path.join(this.getProjectRoot(), 'src', 'gui');
    }

    static getElectronDir(): string {
        return path.join(this.getProjectRoot(), 'src', 'electron');
    }

    static getBuildScriptsDir(): string {
        return path.join(this.getProjectRoot(), 'src', 'build-scripts');
    }

    static getProtobufDir(): string {
        return path.join(this.getProjectRoot(), 'src', 'protobuf');
    }

    static resolve(...segments: string[]): string {
        return path.resolve(...segments);
    }
}
