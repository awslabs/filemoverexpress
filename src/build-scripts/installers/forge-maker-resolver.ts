import {electronConfig} from '../config/electron-config';
import {
    ForgeMakerConfig,
    ForgeMakerType,
    MAKER_NPM_PACKAGES,
    MAKER_PLATFORM_COMPAT,
    PLATFORM_DEFAULT_MAKERS,
    ResolvedMaker,
} from '../types/forge';
import {Architecture, Platform} from '../types/platform';

/**
 * Resolves Forge makers for a given platform and validates maker-platform compatibility.
 *
 * Responsible for:
 * - Mapping platforms to their default maker sets
 * - Validating that user-requested makers are compatible with the target platform
 * - Producing fully resolved maker objects with npm package names and configurations
 */
export class ForgeMakerResolver {
    /**
     * Returns the default makers for a platform.
     *
     * @param platform - Target platform
     * @returns Array of resolved makers with default configurations
     * @throws Error if the platform has no default makers (e.g., Platform.Unknown)
     */
    static getDefaultMakers(platform: Platform): ResolvedMaker[] {
        const defaultTypes = PLATFORM_DEFAULT_MAKERS[platform];
        if (!defaultTypes || defaultTypes.length === 0) {
            throw new Error(`No default makers available for platform: ${platform}`);
        }

        return defaultTypes.map(type => ({
            type,
            npmPackage: MAKER_NPM_PACKAGES[type],
            config: ForgeMakerResolver.buildMakerConfig(type, platform, Architecture.X64),
        }));
    }

    /**
     * Resolves user-specified or default maker types into full configurations.
     *
     * When `requestedMakers` is provided, those makers are used instead of platform defaults.
     * All resolved makers are validated for platform compatibility before returning.
     *
     * @param platform - Target platform
     * @param architecture - Target architecture
     * @param requestedMakers - Optional explicit maker types (overrides defaults)
     * @returns Non-empty array of resolved makers
     * @throws Error if any requested maker is incompatible with the platform
     * @throws Error if no makers are available for the platform
     */
    static resolveMakers(
        platform: Platform,
        architecture: Architecture,
        requestedMakers?: ForgeMakerType[],
    ): ResolvedMaker[] {
        const makerTypes = requestedMakers ?? PLATFORM_DEFAULT_MAKERS[platform];

        if (!makerTypes || makerTypes.length === 0) {
            throw new Error(`No makers available for platform: ${platform}`);
        }

        ForgeMakerResolver.validateMakerPlatformCompat(makerTypes, platform);

        return makerTypes.map(type => ({
            type,
            npmPackage: MAKER_NPM_PACKAGES[type],
            config: ForgeMakerResolver.buildMakerConfig(type, platform, architecture),
        }));
    }

    /**
     * Validates that all requested makers are compatible with the target platform.
     *
     * @param makers - Maker types to validate
     * @param platform - Target platform
     * @throws Error listing the incompatible maker and its supported platforms
     */
    static validateMakerPlatformCompat(
        makers: ForgeMakerType[],
        platform: Platform,
    ): void {
        for (const maker of makers) {
            const compatPlatforms = MAKER_PLATFORM_COMPAT[maker];
            if (!compatPlatforms || !compatPlatforms.includes(platform)) {
                const supported = compatPlatforms?.join(', ') ?? 'none';
                throw new Error(
                    `Maker "${maker}" is not compatible with platform "${platform}". ` +
                    `Compatible platforms: ${supported}`,
                );
            }
        }
    }

    /**
     * Builds maker-specific configuration for a given maker type, platform, and architecture.
     *
     * Each maker type produces a ForgeMakerConfig with:
     * - `name`: the npm package name for the maker
     * - `platforms`: Electron platform strings the maker targets
     * - `config`: maker-specific settings (app name, icon paths, bundle IDs, etc.)
     */
    private static buildMakerConfig(
        type: ForgeMakerType,
        platform: Platform,
        architecture: Architecture,
    ): ForgeMakerConfig {
        const npmPackage = MAKER_NPM_PACKAGES[type];
        const platforms = ForgeMakerResolver.toElectronPlatforms(
            MAKER_PLATFORM_COMPAT[type],
        );

        switch (type) {
            case ForgeMakerType.DMG:
                return {
                    name: npmPackage,
                    platforms,
                    config: {
                        name: electronConfig.appName,
                        icon: electronConfig.iconPaths[Platform.Darwin],
                    },
                };

            case ForgeMakerType.PKG:
                return {
                    name: npmPackage,
                    platforms,
                    config: {
                        name: electronConfig.appName,
                        identity: electronConfig.appBundleId,
                    },
                };

            case ForgeMakerType.ZIP:
                return {
                    name: npmPackage,
                    platforms,
                    config: {},
                };

            case ForgeMakerType.DEB:
                return {
                    name: npmPackage,
                    platforms,
                    config: {
                        options: {
                            name: electronConfig.appName.toLowerCase().replace(/\s+/g, '-'),
                            productName: electronConfig.appName,
                            icon: electronConfig.iconPaths[Platform.Linux],
                        },
                    },
                };

            case ForgeMakerType.RPM:
                return {
                    name: npmPackage,
                    platforms,
                    config: {
                        options: {
                            name: electronConfig.appName.toLowerCase().replace(/\s+/g, '-'),
                            productName: electronConfig.appName,
                            icon: electronConfig.iconPaths[Platform.Linux],
                        },
                    },
                };

            case ForgeMakerType.Squirrel:
                return {
                    name: npmPackage,
                    platforms,
                    config: {
                        name: electronConfig.appName.replace(/\s+/g, ''),
                        authors: electronConfig.appAuthor,
                        description: electronConfig.appDescription,
                        setupIcon: electronConfig.iconPaths[Platform.Windows],
                        createDesktopShortcut: true,
                        createStartMenuShortcut: true,
                    },
                };

            case ForgeMakerType.WiX:
                return {
                    name: npmPackage,
                    platforms,
                    config: {
                        name: electronConfig.appName,
                        icon: electronConfig.iconPaths[Platform.Windows],
                        appUserModelId: electronConfig.appBundleId,
                    },
                };

            default: {
                const _exhaustive: never = type;
                throw new Error(`Unknown maker type: ${_exhaustive}`);
            }
        }
    }

    /**
     * Converts Platform enum values to Electron platform strings.
     * Electron uses 'darwin', 'win32', 'linux' internally.
     */
    private static toElectronPlatforms(platforms: Platform[]): string[] {
        return platforms.map(p => {
            switch (p) {
                case Platform.Darwin:
                    return 'darwin';
                case Platform.Windows:
                    return 'win32';
                case Platform.Linux:
                    return 'linux';
                default:
                    return p;
            }
        });
    }
}
