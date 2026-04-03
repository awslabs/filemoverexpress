export interface File {
    path: string;
    size: bigint;
    lastModified: Date | null;
    storageClass?: string;

    get name(): string;

    get parent(): string;
}
