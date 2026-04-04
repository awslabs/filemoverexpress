import spawn from 'cross-spawn';
import {Logger} from './logger';

export interface CommandResult {
    exitCode: number;
    stdout: string;
    stderr: string;
}

export interface RunOptions {
    cwd?: string;
    env?: Record<string, string>;
    verbose?: boolean;
}

export class CommandRunner {
    static async run(
        command: string,
        args: string[],
        options?: RunOptions,
    ): Promise<CommandResult> {
        return new Promise((resolve) => {
            const childProcess = spawn(command, args, {
                cwd: options?.cwd,
                env: {...process.env, ...options?.env},
            });

            let stdout = '';
            let stderr = '';

            childProcess.stdout?.on('data', (data: Buffer) => {
                const output = data.toString();
                stdout += output;
                if (options?.verbose) {
                    process.stdout.write(output);
                }
            });

            childProcess.stderr?.on('data', (data: Buffer) => {
                const output = data.toString();
                stderr += output;
                if (options?.verbose) {
                    process.stderr.write(output);
                }
            });

            childProcess.on('close', (code: number | null) => {
                resolve({
                    exitCode: code ?? 1,
                    stdout,
                    stderr,
                });
            });

            childProcess.on('error', (error: Error) => {
                Logger.error(`Failed to execute command: ${command}`, error);
                resolve({
                    exitCode: 1,
                    stdout,
                    stderr: stderr + error.message,
                });
            });
        });
    }

    static async runWithLiveOutput(
        command: string,
        args: string[],
    ): Promise<number> {
        return new Promise((resolve) => {
            const childProcess = spawn(command, args, {
                stdio: 'inherit',
            });

            childProcess.on('close', (code: number | null) => {
                resolve(code ?? 1);
            });

            childProcess.on('error', (error: Error) => {
                Logger.error(`Failed to execute command: ${command}`, error);
                resolve(1);
            });
        });
    }
}
