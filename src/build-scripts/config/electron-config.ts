import {ElectronBuildConfig} from '../types/config';
import {Platform} from '../types/platform';

export const electronConfig: ElectronBuildConfig = {
    outputDir: 'dist/electron',
    sourceDir: 'src/electron',
    platforms: [],
    appName: 'File Mover Express',
    appBundleId: 'com.github.awslabs.filemoverexpress',
    helperBundleId: 'com.github.awslabs.filemoverexpress.helper',
    appAuthor: 'Amazon Web Services',
    appDescription: 'High-performance file transfer application for moving media assets between local filesystems and Amazon S3.',
    iconPaths: {
        [Platform.Darwin]: 'assets/icons/mac.icon.icns',
        [Platform.Linux]: 'assets/icons/fme.png',
        [Platform.Windows]: 'assets/icons/windows.ico',
        [Platform.Unknown]: '',
    },
    packagerOptions: {
        overwrite: true,
        prune: true,
        asar: false,
    },
};
