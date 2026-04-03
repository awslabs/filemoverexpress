export abstract class BaseInstaller {
    abstract get cleanupPaths(): string[];

    abstract generate(): Promise<void>;
}
