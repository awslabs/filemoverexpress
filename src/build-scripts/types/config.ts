import {BuildOptions} from './build-target';
import {Platform, PlatformConfig} from './platform';

export interface BuildConfig {
    outputDir: string;
    sourceDir: string;
    platforms: PlatformConfig[];
}

export interface CLIBuildConfig extends BuildConfig {
    goVersion: string;
    buildFlags: string[];
    ldFlags: string[];
    windowsDaemonLauncherPath?: string;
    verbose?: boolean;
}

export interface ElectronBuildConfig extends BuildConfig {
    appName: string;
    appBundleId: string;
    helperBundleId: string;
    appAuthor: string;
    appDescription: string;
    iconPaths: Record<Platform, string>;
    packagerOptions: ElectronPackagerOptions;
}

export interface AngularConfig {
    project: string;
    configuration: 'production' | 'development';
    outputPath: string;
    baseHref: string;
}

export interface ElectronPackagerOptions {
    overwrite: boolean;
    prune: boolean;
    asar: boolean;
}

export interface ElectronConfig {
    appName: string;
    appBundleId: string;
    helperBundleId: string;
    iconPaths: Record<Platform, string>;
    packagerOptions: ElectronPackagerOptions;
}

export interface GUIBuildConfig extends BuildConfig {
    angularConfig: AngularConfig;
    electronConfig: ElectronConfig;
}

export interface PackagerConfig {
    outputPath: string;
}

export interface ElectronPackagerConfig extends PackagerConfig {
    readonly platforms: PlatformConfig[];
    readonly options: BuildOptions;
    readonly electronConfig: ElectronConfig;
}
