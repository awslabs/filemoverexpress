import {afterEach, describe, expect, it} from 'vitest';
import {cleanupMocks, createMockChildProcess, createMockFS, generateBuildOptions, generatePlatformConfig} from './test-utils';
import {Architecture, Platform} from './types/platform';

describe('test-utils', () => {
    afterEach(() => {
        cleanupMocks();
    });

    describe('createMockChildProcess', () => {
        it('should create a mock process with stdout', () => {
            const mockProcess = createMockChildProcess({
                exitCode: 0,
                stdout: 'test output',
            });

            expect(mockProcess.stdout.on).toBeDefined();
            expect(mockProcess.stderr.on).toBeDefined();
            expect(mockProcess.on).toBeDefined();
        });

        it('should emit stdout data when configured', () => {
            const mockProcess = createMockChildProcess({
                exitCode: 0,
                stdout: 'test output',
            });

            let capturedData: Buffer | undefined;
            mockProcess.stdout.on('data', (data: Buffer) => {
                capturedData = data;
            });

            expect(capturedData).toBeDefined();
            expect(capturedData?.toString()).toBe('test output');
        });

        it('should emit stderr data when configured', () => {
            const mockProcess = createMockChildProcess({
                exitCode: 1,
                stderr: 'error output',
            });

            let capturedData: Buffer | undefined;
            mockProcess.stderr.on('data', (data: Buffer) => {
                capturedData = data;
            });

            expect(capturedData).toBeDefined();
            expect(capturedData?.toString()).toBe('error output');
        });

        it('should emit close event with exit code', () => {
            const mockProcess = createMockChildProcess({
                exitCode: 42,
            });

            let capturedCode: number | undefined;
            mockProcess.on('close', (code: number | null) => {
                capturedCode = code ?? -999;
            });

            expect(capturedCode).toBe(42);
        });
    });

    describe('createMockFS', () => {
        it('should create mocks for all fs operations', () => {
            const mockFS = createMockFS();

            expect(mockFS.readFile).toBeDefined();
            expect(mockFS.writeFile).toBeDefined();
            expect(mockFS.mkdir).toBeDefined();
            expect(mockFS.rm).toBeDefined();
            expect(mockFS.access).toBeDefined();
            expect(mockFS.stat).toBeDefined();
            expect(mockFS.readdir).toBeDefined();
            expect(mockFS.copyFile).toBeDefined();
            expect(mockFS.symlink).toBeDefined();
            expect(mockFS.readlink).toBeDefined();
            expect(mockFS.lstat).toBeDefined();
            expect(mockFS.chmod).toBeDefined();
            expect(mockFS.chown).toBeDefined();
            expect(mockFS.unlink).toBeDefined();
            expect(mockFS.rmdir).toBeDefined();
            expect(mockFS.rename).toBeDefined();
        });
    });

    describe('generatePlatformConfig', () => {
        it('should generate valid platform configurations', () => {
            const config = generatePlatformConfig();

            expect(Object.values(Platform)).toContain(config.platform);
            expect(Object.values(Architecture)).toContain(config.arch);
        });

        it('should generate different configurations on multiple calls', () => {
            const configs = Array.from({length: 20}, () => generatePlatformConfig());
            const uniqueConfigs = new Set(configs.map(c => `${c.platform}-${c.arch}`));

            // With 20 calls, we should get at least 2 different configurations
            expect(uniqueConfigs.size).toBeGreaterThan(1);
        });
    });

    describe('generateBuildOptions', () => {
        it('should generate valid build options', () => {
            const options = generateBuildOptions();

            expect(options.platforms).toBeDefined();
            expect(options.archs).toBeDefined();
            expect(typeof options.production).toBe('boolean');
            expect(typeof options.verbose).toBe('boolean');

            // Verify platforms are valid
            options.platforms?.forEach(platform => {
                expect(Object.values(Platform)).toContain(platform);
            });

            // Verify architectures are valid
            options.archs?.forEach(arch => {
                expect(Object.values(Architecture)).toContain(arch);
            });
        });

        it('should generate options with 1-3 platforms', () => {
            const options = generateBuildOptions();

            expect(options.platforms).toBeDefined();
            expect(options.platforms!.length).toBeGreaterThanOrEqual(1);
            expect(options.platforms!.length).toBeLessThanOrEqual(3);
        });

        it('should generate options with 1-2 architectures', () => {
            const options = generateBuildOptions();

            expect(options.archs).toBeDefined();
            expect(options.archs!.length).toBeGreaterThanOrEqual(1);
            expect(options.archs!.length).toBeLessThanOrEqual(2);
        });
    });
});
