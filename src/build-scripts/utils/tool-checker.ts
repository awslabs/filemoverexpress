import {BuildComponent} from '../types/cli';
import {CommandRunner} from './command-runner';
import {Logger} from './logger';

export interface ToolCheckResult {
    available: boolean;
    version?: string;
}

export class ToolChecker {
    static async checkTool(
        toolName: string,
        versionCommand: string[],
    ): Promise<ToolCheckResult> {
        try {
            const result = await CommandRunner.run(toolName, versionCommand);

            if (result.exitCode === 0) {
                return {
                    available: true,
                    version: result.stdout.trim() || result.stderr.trim(),
                };
            }

            return {available: false};
        } catch (error) {
            return {available: false};
        }
    }

    static async checkGo(): Promise<ToolCheckResult> {
        return this.checkTool('go', ['version']);
    }

    static async checkAngularCLI(): Promise<ToolCheckResult> {
        return this.checkTool('ng', ['version']);
    }

    static async checkRequiredTools(component: BuildComponent): Promise<boolean> {
        const missingTools: Array<{ name: string; suggestion: string }> = [];

        if (component === 'cli') {
            const goCheck = await this.checkGo();
            if (!goCheck.available) {
                missingTools.push({
                    name: 'go',
                    suggestion: 'Install Go from https://golang.org/dl/ or use your package manager (brew install go, apt install golang-go)',
                });
            }
        } else if (component === 'gui') {
            const ngCheck = await this.checkAngularCLI();
            if (!ngCheck.available) {
                missingTools.push({
                    name: 'ng (Angular CLI)',
                    suggestion: 'Install Angular CLI: npm install -g @angular/cli',
                });
            }

            // const electronCheck = await this.checkElectronPackager();
            // if (!electronCheck.available) {
            // 	missingTools.push({
            // 		name: 'electron-packager',
            // 		suggestion: 'Install electron-packager: npm install -g electron-packager',
            // 	});
            // }
        }

        if (missingTools.length > 0) {
            Logger.error('Missing required tools:');
            for (const tool of missingTools) {
                console.error(`  - ${tool.name}`);
                console.error(`    ${tool.suggestion}`);
            }
            return false;
        }

        return true;
    }
}
