import {ElectronBuildConfig} from '../types/config';
import {ForgeConfig, ForgeMakerConfig, ForgePackagerConfig} from '../types/forge';
import {Architecture, Platform} from '../types/platform';

/**
 * Translates the project's existing ElectronBuildConfig and platform settings
 * into an Electron Forge configuration object.
 *
 * Responsible for:
 * - Mapping electronConfig fields (appName, appBundleId, helperBundleId, iconPaths,
 *   packagerOptions) to Forge's packagerConfig schema
 * - Selecting the correct icon path based on the target platform
 * - Assembling the complete ForgeConfig with packagerConfig and makers array
 *
 * This class performs no file I/O — it produces a serializable config object
 * that the caller writes to disk.
 */
export class ForgeConfigGenerator {
    constructor(
        private readonly electronConfig: ElectronBuildConfig,
        private readonly platform: Platform,
        private readonly architecture: Architecture,
    ) {}

    /**
     * Assembles the complete Forge configuration object.
     *
     * @param makers - Array of maker configurations to include
     * @returns Complete ForgeConfig ready for serialization
     */
    generateConfig(makers: ForgeMakerConfig[]): ForgeConfig {
        return {
            packagerConfig: this.buildPackagerConfig(),
            makers: [...makers],
        };
    }

    /**
     * Builds the packagerConfig section by mapping ElectronBuildConfig fields
     * to Forge's packagerConfig schema.
     *
     * Field mapping:
     * - name ← electronConfig.appName
     * - executableName ← electronConfig.appName with spaces removed
     * - appBundleId ← electronConfig.appBundleId
     * - helperBundleId ← electronConfig.helperBundleId
     * - icon ← electronConfig.iconPaths[platform]
     * - asar ← electronConfig.packagerOptions.asar
     * - overwrite ← electronConfig.packagerOptions.overwrite
     * - prune ← electronConfig.packagerOptions.prune
     */
    buildPackagerConfig(): ForgePackagerConfig {
        return {
            name: this.electronConfig.appName,
            executableName: this.electronConfig.appName.replace(/\s+/g, ''),
            appBundleId: this.electronConfig.appBundleId,
            helperBundleId: this.electronConfig.helperBundleId,
            icon: this.electronConfig.iconPaths[this.platform],
            asar: this.electronConfig.packagerOptions.asar,
            overwrite: this.electronConfig.packagerOptions.overwrite,
            prune: this.electronConfig.packagerOptions.prune,
        };
    }
}
