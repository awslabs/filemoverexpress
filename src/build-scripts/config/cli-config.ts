import * as fs from 'fs';
import * as path from 'path';
import {CLIBuildConfig} from '../types/config';
import {Architecture, Platform} from '../types/platform';

const version = process.env.VERSION
    || JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'package.json'), 'utf-8')).version;

export const cliConfig: CLIBuildConfig = {
    outputDir: 'dist',
    sourceDir: 'src/cli',
    goVersion: '1.24.0',
    buildFlags: ['-trimpath'],
    ldFlags: ['-s', '-w', `-X main.Version=${version}`],
    windowsDaemonLauncherPath: 'src/windows-daemon-launcher',
    platforms: [
        {platform: Platform.Darwin, arch: Architecture.X64},
        {platform: Platform.Darwin, arch: Architecture.ARM64},
        {platform: Platform.Linux, arch: Architecture.X64},
        {platform: Platform.Linux, arch: Architecture.ARM64},
        {platform: Platform.Windows, arch: Architecture.X64},
    ],
};
