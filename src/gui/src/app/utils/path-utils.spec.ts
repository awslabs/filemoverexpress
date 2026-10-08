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

describe('[utils] splitFavoritePathForDisplay', () => {
    it('splits a deep POSIX path into leaf + middle-truncatable parent', () => {
        expect(utils.splitFavoritePathForDisplay('/Volumes/production/jobs/projecta_2222/01_elements/CameraRAW')).toEqual({
            leaf: 'CameraRAW',
            parentHead: '/Volumes/production/jobs/projecta_2222/',
            parentTail: '01_elements',
        });
    });

    it('splits a shallow POSIX path', () => {
        expect(utils.splitFavoritePathForDisplay('/Users/rsd/Downloads')).toEqual({
            leaf: 'Downloads',
            parentHead: '/Users/',
            parentTail: 'rsd',
        });
    });

    it('keeps the leading separator when the leaf sits directly under root', () => {
        expect(utils.splitFavoritePathForDisplay('/Volumes')).toEqual({
            leaf: 'Volumes',
            parentHead: '/',
            parentTail: '',
        });
    });

    it('splits a Windows display path on backslashes', () => {
        expect(utils.splitFavoritePathForDisplay('D:\\Footage\\projecta\\CameraRAW')).toEqual({
            leaf: 'CameraRAW',
            parentHead: 'D:\\Footage\\',
            parentTail: 'projecta',
        });
    });

    it('treats a bare drive parent as the tail', () => {
        expect(utils.splitFavoritePathForDisplay('C:\\Footage')).toEqual({
            leaf: 'Footage',
            parentHead: '',
            parentTail: 'C:',
        });
    });

    it('ignores a single trailing separator', () => {
        expect(utils.splitFavoritePathForDisplay('/Users/rsd/Downloads/')).toEqual({
            leaf: 'Downloads',
            parentHead: '/Users/',
            parentTail: 'rsd',
        });
    });

    it('returns the whole value as the leaf when there is no parent to show', () => {
        expect(utils.splitFavoritePathForDisplay('/')).toEqual({leaf: '/', parentHead: '', parentTail: ''});
        expect(utils.splitFavoritePathForDisplay('C:\\')).toEqual({leaf: 'C:', parentHead: '', parentTail: ''});
        expect(utils.splitFavoritePathForDisplay('justaname')).toEqual({leaf: 'justaname', parentHead: '', parentTail: ''});
        expect(utils.splitFavoritePathForDisplay('')).toEqual({leaf: '', parentHead: '', parentTail: ''});
    });
});
