export abstract class BasePackager {
    /**
     * A list of paths that should be cleaned up before packaging
     */
    abstract get cleanupPaths(): string[];

    /**
     * Package the application
     */
    abstract package(): Promise<void>;
}
