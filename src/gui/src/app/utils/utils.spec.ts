import { describe, it, expect, afterEach } from 'vitest';
import * as utils from './utils';
import { ConnectError } from '@connectrpc/connect';
import { JobStatus, TaskStatus } from '@state/models/job.model';

describe('[utils] formatBytes', () => {
    it('formatBytes should correctly transform', () => {
        const bytes = 19487628395;

        expect(utils.formatBytes(bytes)).toBe('18.15 GiB');
        expect(utils.formatBytes(bytes, 1)).toBe('18.1 GiB');

        expect(utils.formatBytes(bytes, 2, 1000)).toBe('19.49 GB');
        expect(utils.formatBytes(bytes, 1, 1000)).toBe('19.5 GB');

        expect(utils.formatBytes(-1)).toBe('0 Bytes');
        expect(utils.formatBytes(0.5)).toBe('0 Bytes');
    });
});

describe('[utils] dirName', () => {
    it('dirName should correctly trim', () => {
        const tests = {
            '': '',
            '//': '//',
            '/abc/123/': '/abc/123/',
            '/abc/123': '/abc/',
            '/abc': '/',
            'abc/': 'abc/',
            'abc': 'abc',
        };

        for (const [arg, expected] of Object.entries(tests)) {
            expect(utils.dirName(arg)).toBe(expected);
        }
    });
});

describe('[utils] s3BasePath', () => {
    it('s3BasePath should correctly trim', () => {
        const tests = {
            '': '',
            '//': '//',
            '/abc/123/': '/abc/123/',
            '/abc/123': '/abc/',
            '/abc': '/',
            'abc/': 'abc/',
            'abc/dir\\..\\path/file.txt': 'abc/dir\\..\\path/',
            'abc/../def/file.txt': 'abc/../def/',
        };

        for (const [arg, expected] of Object.entries(tests)) {
            expect(utils.dirName(arg)).toBe(expected);
        }
    });
});

describe('[utils] trimPrefixSuffix', () => {
    it('trimPrefixSuffix should correctly trim', () => {
        expect(utils.trimPrefixSuffix('/prefix/path/', '/', '/')).toBe('prefix/path');
        expect(utils.trimPrefixSuffix('/prefix/path/', '', '/')).toBe('/prefix/path');
        expect(utils.trimPrefixSuffix('/to-trim/prefix/path/', '/to-trim/', '')).toBe('prefix/path/');
        expect(utils.trimPrefixSuffix('my-test-string-321', 'by', 'string-321')).toBe('my-test-');
        expect(utils.trimPrefixSuffix('/prefix/path/', 'A', 'B')).toBe('/prefix/path/');
        expect(utils.trimPrefixSuffix('my-string', 'my-stringX', 'Xmy-string')).toBe('my-string');
    });
});

describe('[utils] commonPath', () => {
    it('commonPath should correctly return common path', () => {
        expect(utils.commonPath(['prefix/a', 'prefix/b'])).toBe('prefix/');
        expect(utils.commonPath(['prefix/a/', 'prefix/b/'])).toBe('prefix/');
    });
});

describe('[utils] basename', () => {
    it('basename', () => {
        expect(utils.basename('/path/to/file')).toBe('file');
        expect(utils.basename('/path/to/dir/')).toBe('dir');

        expect(utils.basename('#path#to#file', '#')).toBe('file');
        expect(utils.basename('#path#to#dir#', '#')).toBe('dir');
    });
});

describe('[utils] dirname', () => {
    it('dirname should return as expected', () => {
        expect(utils.dirname('/prefix/file/')).toBe('/prefix/');
        expect(utils.dirname('/path/to/file')).toBe('/path/to/');
        expect(utils.dirname('/path/to/dir/')).toBe('/path/to/');
        expect(utils.dirname('C:\\prefix\\file\\')).toBe('C:\\prefix\\');
        expect(utils.dirname('C:\\path\\to\\file')).toBe('C:\\path\\to\\');
        expect(utils.dirname('C:\\path\\to\\dir\\')).toBe('C:\\path\\to\\');
        expect(utils.dirname('')).toBe('/');
    });
});

describe('[utils] s3BasePath', () => {
    it('s3BasePath should return correct base path', () => {
        expect(utils.s3BasePath('')).toBe('/');
        expect(utils.s3BasePath('prefix/a')).toBe('prefix/');
        expect(utils.s3BasePath('prefix/a/')).toBe('prefix/');
    });
});

describe('[utils] formatDate', () => {
    const d = new Date(Date.parse('2024-03-05 14:56:35'));
    it('formatDate without time', () => {
        expect(utils.formatDate(d)).toBe('20240305');
    });

    it('formatDate with time', () => {
        expect(utils.formatDate(d, true)).toBe('20240305-145635');
    });
});

describe('[utils] getErrorMessage', () => {
    it('should handle string input', () => {
        expect(utils.getErrorMessage('')).toBe('');
        expect(utils.getErrorMessage('some error')).toBe('some error');
    });

    it('should handle ConnectError input', () => {
        const e = new ConnectError('error message');
        expect(utils.getErrorMessage(e)).toBe('error message');
    });

    it('should handle Error input', () => {
        const e = new Error('error message');
        expect(utils.getErrorMessage(e)).toBe('error message');
    });

    it('should return null with invalid input', () => {
        expect(utils.getErrorMessage(1234)).toBeNull();
    });
});

describe('[utils] createJobName', () => {
    it('should generate valid job names', () => {
        expect(utils.createJobName('', 0)).toBe('Transfer job');
        expect(utils.createJobName('first-source', 1)).toBe('first-source');
        expect(utils.createJobName('first-source', 2)).toBe('first-source & others');
        expect(utils.createJobName('first-source', 3)).toBe('first-source & others');
    });
});

describe('[utils] GetJobStatus', () => {
    it('should return correct values', () => {
        expect(utils.stringToJobStatus('CREATED')).toBe(JobStatus.Created);
        expect(utils.stringToJobStatus('DISCOVERING')).toBe(JobStatus.Discovering);
        expect(utils.stringToJobStatus('CHECKSUMMING')).toBe(JobStatus.Checksumming);
        expect(utils.stringToJobStatus('FILTERING')).toBe(JobStatus.Filtering);
        expect(utils.stringToJobStatus('IN_PROGRESS')).toBe(JobStatus.InProgress);
        expect(utils.stringToJobStatus('PAUSED')).toBe(JobStatus.Paused);
        expect(utils.stringToJobStatus('CANCELLED')).toBe(JobStatus.Cancelled);
        expect(utils.stringToJobStatus('COMPLETED')).toBe(JobStatus.Completed);
        expect(utils.stringToJobStatus('ERROR')).toBe(JobStatus.Error);
        expect(utils.stringToJobStatus('UNKNOWN')).toBe(JobStatus.Unknown);
        expect(utils.stringToJobStatus('something invalid')).toBe(JobStatus.Unknown);
    });
});

describe('[utils] GetTaskStatus', () => {
    it('should return correct values', () => {
        expect(utils.stringToTaskStatus('QUEUED')).toBe(TaskStatus.Queued);
        expect(utils.stringToTaskStatus('CHECKSUMMING')).toBe(TaskStatus.Checksumming);
        expect(utils.stringToTaskStatus('IN_PROGRESS')).toBe(TaskStatus.InProgress);
        expect(utils.stringToTaskStatus('PAUSED')).toBe(TaskStatus.Paused);
        expect(utils.stringToTaskStatus('CANCELLED')).toBe(TaskStatus.Cancelled);
        expect(utils.stringToTaskStatus('COMPLETED')).toBe(TaskStatus.Completed);
        expect(utils.stringToTaskStatus('ERROR')).toBe(TaskStatus.Error);
        expect(utils.stringToTaskStatus('UNKNOWN')).toBe(TaskStatus.Unknown);
        expect(utils.stringToTaskStatus('something invalid')).toBe(TaskStatus.Unknown);
    });
});

describe('[utils] pascalCaseToSpace', () => {
    it('should return correct values', () => {
        expect(utils.pascalCaseToSpace('InProgress')).toBe('In Progress');
        expect(utils.pascalCaseToSpace('testCamelCase')).toBe('test Camel Case');
        expect(utils.pascalCaseToSpace('has Spaces already')).toBe('has Spaces already');
        expect(utils.pascalCaseToSpace('')).toBe('');
        expect(utils.pascalCaseToSpace('abc')).toBe('abc');
        expect(utils.pascalCaseToSpace('MixedPascal and Spaces')).toBe('Mixed Pascal and Spaces');
    });
});

describe('[utils] isPackagedApp', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;

    afterEach(() => {
        // Only clean up bridges we added. window.chrome is non-configurable in
        // headless Chrome, so we never mutate it here.
        delete w.webkit;
        delete w.wails;
    });

    it('returns false in a plain browser (no native webview bridge)', () => {
        expect(utils.isPackagedApp()).toBe(false);
    });

    it('returns true under a macOS WKWebView (webkit.messageHandlers.external)', () => {
        w.webkit = { messageHandlers: { external: { postMessage: () => undefined } } };
        expect(utils.isPackagedApp()).toBe(true);
    });

    it('returns true under an Android-style window.wails.invoke bridge', () => {
        w.wails = { invoke: () => undefined };
        expect(utils.isPackagedApp()).toBe(true);
    });

    it('ignores a webkit object without an external message handler', () => {
        w.webkit = { messageHandlers: {} };
        expect(utils.isPackagedApp()).toBe(false);
    });
});
