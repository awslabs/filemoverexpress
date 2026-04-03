import {CommandRunner} from '../utils/command-runner';
import {Logger} from '../utils/logger';
import {PathResolver} from '../utils/path-resolver';
import {BaseBuilder} from './base-builder';

export class ProtobufBuilder extends BaseBuilder {
    protected cleanupPaths: string[] = [
        'src/cli/types/pbtypes/pbtypesconnect',
        'src/cli/types/pbtypes/*.pb.go',
        'src/gui/src/connect/gen',
    ];

    async build(..._args: any[]): Promise<void> {
        Logger.info('Generating protobuf clients and interfaces...');
        await this.runBuf();
        Logger.success('Protobuf clients and interfaces generated successfully');
    }

    async runBuf(): Promise<void> {
        const buildArgs: string[] = ['buf', 'generate'];

        const result = await CommandRunner.run('npx', buildArgs, {
            cwd: PathResolver.getProtobufDir(),
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
