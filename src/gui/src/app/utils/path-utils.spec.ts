import { describe, it, expect } from 'vitest';
import * as utils from '@app/utils/path-utils';

describe('[utils] displayPathToGrpcPath', () => {
    it('displayPathToGrpcPath should correctly convert path', () => {
        // windows paths
        expect(utils.displayPathToGrpcPath('', 'windows')).toBe('');
        expect(utils.displayPathToGrpcPath('C:\\', 'windows')).toBe('/c/');
        expect(utils.displayPathToGrpcPath('no-colon', 'windows')).toBe('no-colon');
        expect(utils.displayPathToGrpcPath('C:\\Users\\Administrator', 'windows')).toBe('/c/Users/Administrator');
        expect(utils.displayPathToGrpcPath('C:\\Users\\Administrator\\', 'windows')).toBe('/c/Users/Administrator/');
        // expect nothing to change for non-windows paths
        expect(utils.displayPathToGrpcPath('/my/darwin/path', 'darwin')).toBe('/my/darwin/path');
        expect(utils.displayPathToGrpcPath('my/linux/path/', 'linux')).toBe('my/linux/path/');
        expect(utils.displayPathToGrpcPath('my/s3/path', 's3')).toBe('my/s3/path');
        expect(utils.displayPathToGrpcPath('unknown/OS//path/', 'unknown')).toBe('unknown/OS//path/');
    });
});

describe('[utils] grpcPathToDisplayPath', () => {
    it('grpcPathToDisplayPath should correctly convert path', () => {
        // windows paths
        expect(utils.grpcPathToDisplayPath('', 'windows')).toBe('');
        expect(utils.grpcPathToDisplayPath('/', 'windows')).toBe('');
        expect(utils.grpcPathToDisplayPath('/c', 'windows')).toBe('C:\\');
        expect(utils.grpcPathToDisplayPath('/c/', 'windows')).toBe('C:\\');
        expect(utils.grpcPathToDisplayPath('/c/Users/Administrator', 'windows')).toBe('C:\\Users\\Administrator');
        expect(utils.grpcPathToDisplayPath('/c/Users/Administrator/', 'windows')).toBe('C:\\Users\\Administrator\\');
        // expect nothing to change for non-windows paths
        expect(utils.grpcPathToDisplayPath('/my/darwin/path', 'darwin')).toBe('/my/darwin/path');
        expect(utils.grpcPathToDisplayPath('my/linux/path/', 'linux')).toBe('my/linux/path/');
        expect(utils.grpcPathToDisplayPath('my/s3/path', 's3')).toBe('my/s3/path');
        expect(utils.grpcPathToDisplayPath('unknown/OS//path/', 'unknown')).toBe('unknown/OS//path/');
    });
});
