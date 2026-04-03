import {ElectronBuildConfig} from '../types/config';
import {Platform} from '../types/platform';

export const electronConfig: ElectronBuildConfig = {
    outputDir: 'dist/electron',
    sourceDir: 'src/electron',
    platforms: [],
    appName: 'File Mover Express',
    appBundleId: 'com.github.awslabs.filemoverexpress',
    helperBundleId: 'com.github.awslabs.filemoverexpress.helper',
    iconPaths: {
        [Platform.Darwin]: 'assets/icons/mac/icon.icns',
        [Platform.Linux]: 'assets/icons/linux/icon.png',
        [Platform.Windows]: 'assets/icons/win/icon.ico',
        [Platform.Unknown]: 'assets/icons/win/icon.ico',
    },
    packagerOptions: {
        overwrite: true,
        prune: true,
        asar: false,
    },
};
