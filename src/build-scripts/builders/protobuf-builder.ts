import * as path from 'path';
import * as readline from 'readline';
import {CommandRunner} from '../utils/command-runner';
import {Logger} from '../utils/logger';
import {PathResolver} from '../utils/path-resolver';
import {BaseBuilder} from './base-builder';

// Go protobuf plugins required by buf.gen.yaml
const GO_PROTO_PLUGINS = [
    {
        name: 'protoc-gen-go',
        pkg: 'google.golang.org/protobuf/cmd/protoc-gen-go@latest',
    },
    {
        name: 'protoc-gen-connect-go',
        pkg: 'connectrpc.com/connect/cmd/protoc-gen-connect-go@latest',
    },
];

export class ProtobufBuilder extends BaseBuilder {
    protected cleanupPaths: string[] = [
        'src/cli/types/pbtypes/pbtypesconnect',
        'src/cli/types/pbtypes/*.pb.go',
        'src/gui/src/connect/gen',
    ];

    async build(..._args: any[]): Promise<void> {
        Logger.info('Generating protobuf clients and interfaces...');
        const goBinPath = await this.getGoBinPath();
        await this.installGoPlugins(goBinPath);
        await this.runBuf(goBinPath);
        Logger.success('Protobuf clients and interfaces generated successfully');
    }

    /**
     * Resolves the Go bin directory (GOPATH/bin) by asking `go env GOPATH`.
     * This is where `go install` places binaries.
     */
    async getGoBinPath(): Promise<string> {
        const result = await CommandRunner.run('go', ['env', 'GOPATH'], {});
        if (result.exitCode !== 0 || !result.stdout.trim()) {
            throw new Error(
                'Could not determine GOPATH. Ensure Go >= 1.25 is installed and \'go\' is on your PATH.',
            );
        }
        return path.join(result.stdout.trim(), 'bin');
    }

    /**
     * Prompts the user via stdin and returns true if they confirm.
     */
    async promptUser(question: string): Promise<boolean> {
        const rl = readline.createInterface({input: process.stdin, output: process.stdout});
        return new Promise((resolve) => {
            rl.question(question, (answer) => {
                rl.close();
                resolve(answer.trim().toLowerCase() === 'y');
            });
        });
    }

    /**
     * Checks for required Go protobuf plugins and prompts the user before
     * installing any that are missing.
     */
    async installGoPlugins(goBinPath: string): Promise<void> {
        const missing: typeof GO_PROTO_PLUGINS = [];

        for (const plugin of GO_PROTO_PLUGINS) {
            const pluginBin = path.join(goBinPath, plugin.name);
            const check = await CommandRunner.run(pluginBin, ['--version'], {});
            if (check.exitCode === 0) {
                Logger.debug(`${plugin.name} already installed, skipping`);
            } else {
                missing.push(plugin);
            }
        }

        if (missing.length === 0) {
            return;
        }

        Logger.warn('The following Go protobuf plugins are required but not installed:');
        for (const plugin of missing) {
            Logger.warn(`  - ${plugin.name} (${plugin.pkg})`);
        }

        const confirmed = await this.promptUser(
            '\nWould you like for these to be installed? [y/N] ',
        );

        if (!confirmed) {
            throw new Error(
                'Protobuf generation requires the missing plugins listed above.\n' +
                'Install them manually and re-run:\n' +
                missing.map(p => `  go install ${p.pkg}`).join('\n'),
            );
        }

        for (const plugin of missing) {
            Logger.info(`Installing ${plugin.name}...`);
            const result = await CommandRunner.run('go', ['install', plugin.pkg], {
                verbose: true,
            });

            if (result.exitCode !== 0) {
                throw new Error(
                    `Failed to install ${plugin.name}\nCommand: go install ${plugin.pkg}\nStderr: ${result.stderr}`,
                );
            }

            Logger.success(`Installed ${plugin.name}`);
        }
    }

    /**
     * Runs `buf generate` with GOPATH/bin prepended to PATH so the
     * freshly installed plugins are discoverable.
     */
    async runBuf(goBinPath: string): Promise<void> {
        const buildArgs: string[] = ['buf', 'generate'];

        // Prepend GOPATH/bin so buf can find protoc-gen-go and protoc-gen-connect-go
        const pathSep = process.platform === 'win32' ? ';' : ':';
        const augmentedPath = `${goBinPath}${pathSep}${process.env.PATH ?? ''}`;

        const result = await CommandRunner.run('npx', buildArgs, {
            cwd: PathResolver.getProtobufDir(),
            env: {PATH: augmentedPath},
            verbose: true,
        });

        if (result.exitCode !== 0) {
            Logger.error('Protobuf generation failed');
            throw new Error(
                `Protobuf generation failed with exit code ${result.exitCode}\nCommand: npx ${buildArgs.join(' ')}\nStderr: ${result.stderr}`,
            );
        }
    }
}
