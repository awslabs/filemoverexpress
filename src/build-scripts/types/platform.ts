export enum Platform {
    Darwin = 'darwin',
    Linux = 'linux',
    Windows = 'windows',
    Unknown = 'unknown'
}

export enum Architecture {
    X64 = 'x64',
    ARM64 = 'arm64'
}

export interface PlatformConfig {
    platform: Platform;
    arch: Architecture;
}
