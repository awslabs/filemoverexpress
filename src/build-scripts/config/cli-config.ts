import {CLIBuildConfig} from '../types/config';
import {Architecture, Platform} from '../types/platform';

export const cliConfig: CLIBuildConfig = {
    outputDir: 'dist',
    sourceDir: 'src/cli',
    goVersion: '1.25.0',
    buildFlags: ['-trimpath'],
    ldFlags: ['-s', '-w'],
    windowsDaemonLauncherPath: 'src/windows-daemon-launcher',
    platforms: [
        {platform: Platform.Darwin, arch: Architecture.X64},
        {platform: Platform.Darwin, arch: Architecture.ARM64},
        {platform: Platform.Linux, arch: Architecture.X64},
        {platform: Platform.Linux, arch: Architecture.ARM64},
        {platform: Platform.Windows, arch: Architecture.X64},
    ],
};
