import {GUIBuildConfig} from '../types/config';
import {Architecture, Platform} from '../types/platform';

export const guiConfig: GUIBuildConfig = {
    outputDir: 'dist',
    sourceDir: 'src/gui',
    angularConfig: {
        project: 'grpc-client',
        configuration: 'production',
        outputPath: 'dist/gui',
        baseHref: './',
    },
    electronConfig: {
        appName: 'File Mover Express for AWS',
        appBundleId: 'com.github.awslabs.filemoverexpress',
        helperBundleId: 'com.github.awslabs.filemoverexpress.helper',
        iconPaths: {
            [Platform.Darwin]: 'assets/icons/mac/icon.icns',
            [Platform.Linux]: 'assets/icons/png/icon_256x256.png',
            [Platform.Windows]: 'assets/icons/png/icon.ico',
            [Platform.Unknown]: 'assets/icons/png/icon.ico',
        },
        packagerOptions: {
            overwrite: true,
            prune: true,
            asar: false,
        },
    },
    platforms: [
        {platform: Platform.Darwin, arch: Architecture.X64},
        {platform: Platform.Darwin, arch: Architecture.ARM64},
        {platform: Platform.Windows, arch: Architecture.X64},
    ],
};
