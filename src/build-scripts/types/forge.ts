import {Architecture, Platform} from './platform';

/**
 * Supported Electron Forge maker types for generating platform-specific installers.
 */
export enum ForgeMakerType {
    DMG = 'dmg',
    PKG = 'pkg',
    ZIP = 'zip',
    DEB = 'deb',
    RPM = 'rpm',
    Squirrel = 'squirrel',
    WiX = 'wix',
}

/**
 * Default makers for each platform. Used when no explicit makers are requested.
 */
export const PLATFORM_DEFAULT_MAKERS: Record<Platform, ForgeMakerType[]> = {
    [Platform.Darwin]: [ForgeMakerType.DMG, ForgeMakerType.ZIP],
    [Platform.Windows]: [ForgeMakerType.Squirrel, ForgeMakerType.ZIP],
    [Platform.Linux]: [ForgeMakerType.ZIP],
    [Platform.Unknown]: [],
};

/**
 * Platform compatibility matrix for each maker type.
 * A maker can only be used on the platforms listed in its entry.
 */
export const MAKER_PLATFORM_COMPAT: Record<ForgeMakerType, Platform[]> = {
    [ForgeMakerType.DMG]: [Platform.Darwin],
    [ForgeMakerType.PKG]: [Platform.Darwin],
    [ForgeMakerType.ZIP]: [Platform.Darwin, Platform.Windows, Platform.Linux],
    [ForgeMakerType.DEB]: [Platform.Linux],
    [ForgeMakerType.RPM]: [Platform.Linux],
    [ForgeMakerType.Squirrel]: [Platform.Windows],
    [ForgeMakerType.WiX]: [Platform.Windows],
};

/**
 * Maps each maker type to its corresponding @electron-forge/maker-* npm package.
 */
export const MAKER_NPM_PACKAGES: Record<ForgeMakerType, string> = {
    [ForgeMakerType.DMG]: '@electron-forge/maker-dmg',
    [ForgeMakerType.PKG]: '@electron-forge/maker-pkg',
    [ForgeMakerType.ZIP]: '@electron-forge/maker-zip',
    [ForgeMakerType.DEB]: '@electron-forge/maker-deb',
    [ForgeMakerType.RPM]: '@electron-forge/maker-rpm',
    [ForgeMakerType.Squirrel]: '@electron-forge/maker-squirrel',
    [ForgeMakerType.WiX]: '@electron-forge/maker-wix',
};

/**
 * Options for the Forge-based installer generator.
 */
export interface ForgeInstallerOptions {
    /** Target platform. Defaults to host platform. */
    platform?: Platform;
    /** Target architecture. Defaults to host architecture. */
    architecture?: Architecture;
    /** Specific makers to use. Defaults to platform defaults. */
    makers?: ForgeMakerType[];
    /** Enable verbose logging. */
    verbose?: boolean;
    /** Skip rebuild if dist files exist. */
    devMode?: boolean;
    /** Keep temp directories for debugging. */
    retainTempFiles?: boolean;
}

/**
 * Electron Forge packager configuration, mapped from the project's ElectronBuildConfig.
 */
export interface ForgePackagerConfig {
    name: string;
    executableName: string;
    appBundleId: string;
    helperBundleId: string;
    icon: string;
    asar: boolean;
    overwrite: boolean;
    prune: boolean;
}

/**
 * Configuration for a single Forge maker.
 */
export interface ForgeMakerConfig {
    name: string;
    platforms: string[];
    config: Record<string, unknown>;
}

/**
 * Complete Forge configuration object consumed by @electron-forge/core.
 */
export interface ForgeConfig {
    packagerConfig: ForgePackagerConfig;
    makers: ForgeMakerConfig[];
}

/**
 * A fully resolved maker with its type, npm package, and configuration.
 */
export interface ResolvedMaker {
    type: ForgeMakerType;
    npmPackage: string;
    config: ForgeMakerConfig;
}

/**
 * Result from a single Forge make invocation.
 */
export interface ForgeMakeResult {
    /** Absolute paths to the generated installer artifacts. */
    artifacts: string[];
    /** The platform the artifacts were built for. */
    platform: string;
    /** The architecture the artifacts were built for. */
    arch: string;
    /** The Forge package config used during make. */
    packageJSON: Record<string, unknown>;
}
