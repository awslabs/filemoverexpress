import { ExportJobList } from '@services/export/export.interfaces';
import { TransferDirection } from '@app/interfaces/jobs-table';

// 0 jobs
export const emptyJobsCaseInput: ExportJobList = {};

// 1 upload job, no tasks
export const emptyTasksCaseInput: ExportJobList = {
    'jobID-abc': {
        jobName: 'my-file.txt & others',
        destination: '/Users/me/Desktop/my-folder',
        direction: TransferDirection.Upload,
        transferProfileName: 'my-remote-config',
        bucket: 'my-bucket',
        transfers: [],
    },
};

// 1 download job with tasks
export const oneJobCaseInput: ExportJobList = {
    'jobID-abc': {
        jobName: 'my-file.txt & others',
        destination: '/Users/me/Desktop/my-folder',
        direction: TransferDirection.Download,
        transferProfileName: 'my-remote-config',
        bucket: 'my-bucket',
        transfers: [
            {
                taskId: 'taskID-123',
                destination: '/Users/me/Desktop/my-folder/my-file.txt',
                localFile: {
                    path: '',
                    size: 0,
                    lastModified: new Date('2023-02-14T19:09:06.392Z'),
                },
                s3Object: {
                    key: 'my-prefix/my-file.txt',
                    size: 1234567,
                    lastModified: new Date('2024-02-14T19:09:06.392Z'),
                },
                direction: TransferDirection.Download,
                status: 'COMPLETED',
                statusMessage: '',
                jobId: 'jobID-abc',
                checksum: '',
                priority: 3,
                error: '',
                bytesTransferred: 1234567,
            },
            {
                taskId: 'taskID-1234',
                destination: '/Users/me/Desktop/my-folder/my-movie.mov',
                localFile: {
                    path: '',
                    size: 0,
                    lastModified: new Date('2023-02-14T19:09:06.392Z'),
                },
                s3Object: {
                    key: 'my-prefix/my-movie.mov',
                    size: 2459483033,
                    lastModified: new Date('2024-02-14T19:09:06.392Z'),
                },
                direction: TransferDirection.Download,
                status: 'COMPLETED',
                statusMessage: '',
                jobId: 'jobID-abc',
                checksum: '',
                priority: 2,
                error: '',
                bytesTransferred: 2459483033,
            },
            {
                taskId: 'taskID-12345',
                destination: '/Users/me/Desktop/my-folder/my-photos/my-photo1.png',
                localFile: {
                    path: '',
                    size: 0,
                    lastModified: new Date('2023-02-14T19:09:06.392Z'),
                },
                s3Object: {
                    key: 'my-prefix/my-photos/my-photo1.png',
                    size: 23423452,
                    lastModified: new Date('2024-02-14T19:09:06.392Z'),
                },
                direction: TransferDirection.Download,
                status: 'COMPLETED',
                statusMessage: '',
                jobId: 'jobID-abc',
                checksum: '',
                priority: 1,
                error: '',
                bytesTransferred: 23423452,
            },
            {
                taskId: 'taskID-123456',
                destination: '/Users/me/Desktop/my-folder/my-photos/my-photo2.png',
                localFile: {
                    path: '',
                    size: 0,
                    lastModified: new Date('2023-02-14T19:09:06.392Z'),
                },
                s3Object: {
                    key: 'my-prefix/my-photos/my-photo2.png',
                    size: 33427552,
                    lastModified: new Date('2024-02-14T19:09:06.392Z'),
                },
                direction: TransferDirection.Download,
                status: 'ERROR',
                statusMessage: '',
                jobId: 'jobID-abc',
                checksum: '',
                priority: 4,
                error: 'a download error occurred',
                bytesTransferred: 96547,
            },
        ],
    },
};

// 2 uploads with tasks
export const twoJobsCaseInput: ExportJobList = {
    'jobID-abc': {
        jobName: 'my-model.ma & others',
        destination: '/my-prefix/studioA',
        direction: TransferDirection.Upload,
        transferProfileName: 'my-remote-config',
        bucket: 'my-bucket',
        transfers: [
            {
                taskId: 'task-ID-abc-1',
                destination: '/my-prefix/studioA/my-model.ma',
                localFile: {
                    path: '/Users/me/studioA/movie/my-model.ma',
                    size: 73296453,
                    lastModified: new Date('2008-10-21T20:05:06.452Z'),
                },
                s3Object: {
                    key: '',
                    size: 0,
                    lastModified: new Date('2023-02-14T19:09:06.392Z'),
                },
                direction: TransferDirection.Upload,
                status: 'In PROGRESS',
                statusMessage: '',
                jobId: 'jobID-abc',
                checksum: '1638153c',
                priority: 3,
                error: '',
                bytesTransferred: 1234567,
            }, {
                taskId: 'task-ID-abc-2',
                destination: '/my-prefix/studioA/my-texture.png',
                localFile: {
                    path: '/Users/me/studioA/movie/my-texture.png',
                    size: 3724623,
                    lastModified: new Date('2018-10-21T20:05:06.452Z'),
                },
                s3Object: {
                    key: '',
                    size: 0,
                    lastModified: new Date('2023-02-14T19:09:06.392Z'),
                },
                direction: TransferDirection.Upload,
                status: 'COMPLETED',
                statusMessage: '',
                jobId: 'jobID-abc',
                checksum: '38bd6879',
                priority: 10,
                error: '',
                bytesTransferred: 3724623,
            },
        ],
    },
    'jobID-def': {
        jobName: 'my-script.py',
        destination: '/my-prefix/studioB',
        direction: TransferDirection.Upload,
        transferProfileName: 'my-remote-config2',
        bucket: 'my-bucket2',
        transfers: [
            {
                taskId: 'task-ID-def-1',
                destination: '/my-prefix/studioB/my-script.py',
                localFile: {
                    path: '/Users/me/studioB/my-script.py',
                    size: 87953,
                    lastModified: new Date('2021-05-21T20:05:06.452Z'),
                },
                s3Object: {
                    key: '',
                    size: 0,
                    lastModified: new Date('2023-02-14T19:09:06.392Z'),
                },
                direction: TransferDirection.Upload,
                status: 'COMPLETED',
                statusMessage: '',
                jobId: 'jobID-def',
                checksum: 'f5937fa2',
                priority: 4,
                error: '',
                bytesTransferred: 87953,
            },
        ],
    },
};

// 2 downloads & 3 uploads with tasks with Windows style paths
export const mixedJobsCaseInput: ExportJobList = {
    'jobID-abc': {
        jobName: 'my-model.ma',
        destination: 'C:\\Administrator\\Desktop',
        direction: TransferDirection.Download,
        transferProfileName: 'my-remote-config',
        bucket: 'my-bucket',
        transfers: [
            {
                taskId: 'taskID-abc-1',
                destination: 'C:\\Administrator\\Desktop\\my-movie',
                localFile: {
                    path: '',
                    size: 0,
                    lastModified: new Date('2023-02-14T19:09:06.392Z'),
                },
                s3Object: {
                    key: '',
                    size: 28579285,
                    lastModified: new Date('2023-02-14T19:09:06.392Z'),
                },
                direction: TransferDirection.Download,
                status: 'COMPLETED',
                statusMessage: '',
                jobId: 'jobID-abc',
                checksum: '',
                priority: 6,
                error: '',
                bytesTransferred: 28579285,
            },
        ],
    },
    'jobID-def': {
        jobName: 'my-script.py',
        destination: '/my-prefix/studioB',
        direction: TransferDirection.Upload,
        transferProfileName: 'my-remote-config',
        bucket: 'my-bucket',
        transfers: [
            {
                taskId: 'taskID-def-1',
                destination: '/my-prefix/studioB/my-script.py',
                localFile: {
                    path: 'C:\\Administrator\\Desktop\\studioB\\my-script.py',
                    size: 87953,
                    lastModified: new Date('2021-05-21T20:05:06.452Z'),
                },
                s3Object: {
                    key: '',
                    size: 0,
                    lastModified: new Date('2023-02-14T19:09:06.392Z'),
                },
                direction: TransferDirection.Upload,
                status: 'COMPLETED',
                statusMessage: '',
                jobId: 'jobID-def',
                checksum: 'f5937fa2',
                priority: 4,
                error: '',
                bytesTransferred: 87953,
            },
        ],
    },
    'jobID-ghi': {
        jobName: 'my-model.ma & others',
        destination: '/my-prefix/studioA',
        direction: TransferDirection.Upload,
        transferProfileName: 'my-remote-config',
        bucket: 'my-bucket',
        transfers: [
            {
                taskId: 'taskID-ghi-1',
                destination: '/my-prefix/studioA/my-model.ma',
                localFile: {
                    path: 'C:\\Administrator\\Desktop\\studioA\\movie\\my-model.ma',
                    size: 73296453,
                    lastModified: new Date('2008-10-21T20:05:06.452Z'),
                },
                s3Object: {
                    key: '',
                    size: 0,
                    lastModified: new Date('2023-02-14T19:09:06.392Z'),
                },
                direction: TransferDirection.Upload,
                status: 'In PROGRESS',
                statusMessage: '',
                jobId: 'jobID-ghi',
                checksum: '1638153c',
                priority: 3,
                error: '',
                bytesTransferred: 1234567,
            }, {
                taskId: 'taskID-ghi-2',
                destination: '/my-prefix/studioA/my-texture.png',
                localFile: {
                    path: 'C:\\Administrator\\Desktop\\studioA\\movie\\my-texture.png',
                    size: 3724623,
                    lastModified: new Date('2018-10-21T20:05:06.452Z'),
                },
                s3Object: {
                    key: '',
                    size: 0,
                    lastModified: new Date('2023-02-14T19:09:06.392Z'),
                },
                direction: TransferDirection.Upload,
                status: 'COMPLETED',
                statusMessage: '',
                jobId: 'jobID-ghi',
                checksum: '38bd6879',
                priority: 10,
                error: '',
                bytesTransferred: 3724623,
            },
        ],
    },
    'jobID-jkl': {
        jobName: 'file1 & others',
        destination: 'C:\\Administrator\\Desktop\\my-folder',
        direction: TransferDirection.Download,
        transferProfileName: 'my-remote-config',
        bucket: 'my-bucket',
        transfers: [
            {
                taskId: 'taskID-jkl-1',
                destination: 'C:\\Administrator\\Desktop\\my-folder\\file1',
                localFile: {
                    path: '',
                    size: 0,
                    lastModified: new Date('2023-02-14T19:09:06.392Z'),
                },
                s3Object: {
                    key: 'file1',
                    size: 1234,
                    lastModified: new Date('2023-02-14T19:09:06.392Z'),
                },
                direction: TransferDirection.Download,
                status: 'In PROGRESS',
                statusMessage: '',
                jobId: 'jobID-jkl',
                checksum: 'c47e6463',
                priority: 1,
                error: '',
                bytesTransferred: 0,
            },
            {
                taskId: 'taskID-jkl-2',
                destination: 'C:\\Administrator\\Desktop\\my-folder\\file2',
                localFile: {
                    path: '',
                    size: 0,
                    lastModified: new Date('2023-02-14T19:09:06.392Z'),
                },
                s3Object: {
                    key: 'file2',
                    size: 1234,
                    lastModified: new Date('2023-02-14T19:09:06.392Z'),
                },
                direction: TransferDirection.Download,
                status: 'COMPLETED',
                statusMessage: '',
                jobId: 'jobID-jkl',
                checksum: '',
                priority: 7,
                error: '',
                bytesTransferred: 1234,
            },
            {
                taskId: 'taskID-jkl-3',
                destination: 'C:\\Administrator\\Desktop\\my-folder\\file3',
                localFile: {
                    path: '',
                    size: 0,
                    lastModified: new Date('2023-02-14T19:09:06.392Z'),
                },
                s3Object: {
                    key: 'file3',
                    size: 1234,
                    lastModified: new Date('2023-02-14T19:09:06.392Z'),
                },
                direction: TransferDirection.Download,
                status: 'COMPLETED',
                statusMessage: '',
                jobId: 'jobID-jkl',
                checksum: '',
                priority: 2,
                error: '',
                bytesTransferred: 1234,
            },
            {
                taskId: 'taskID-jkl-4',
                destination: 'C:\\Administrator\\Desktop\\my-folder\\file4',
                localFile: {
                    path: '',
                    size: 0,
                    lastModified: new Date('2023-02-14T19:09:06.392Z'),
                },
                s3Object: {
                    key: 'file4',
                    size: 3724623,
                    lastModified: new Date('2023-02-14T19:09:06.392Z'),
                },
                direction: TransferDirection.Download,
                status: 'COMPLETED',
                statusMessage: '',
                jobId: 'jobID-jkl',
                checksum: '',
                priority: 12,
                error: '',
                bytesTransferred: 3724623,
            },
        ],
    },
    'jobID-mno': {
        jobName: 'animation.ma',
        destination: '/my-prefix',
        direction: TransferDirection.Upload,
        transferProfileName: 'my-remote-config',
        bucket: 'my-bucket',
        transfers: [
            {
                taskId: 'taskID-mno-1',
                destination: '/my-prefix/animation.ma',
                localFile: {
                    path: 'C:\\Administrator\\Desktop\\animation.ma',
                    size: 7329644353,
                    lastModified: new Date('2008-10-21T20:05:06.452Z'),
                },
                s3Object: {
                    key: '',
                    size: 0,
                    lastModified: new Date('2023-02-14T19:09:06.392Z'),
                },
                direction: TransferDirection.Upload,
                status: 'IN PROGRESS',
                statusMessage: '',
                jobId: 'jobID-mno',
                checksum: '66d8634',
                priority: 11,
                error: '',
                bytesTransferred: 5646,
            },
        ],
    },
};

// 1 upload job with some data blank
export const missingDataCaseInput: ExportJobList = {
    '': {
        jobName: 'my-file.txt',
        destination: '/',
        direction: TransferDirection.Upload,
        transferProfileName: 'my-remote-config',
        bucket: '',
        transfers: [
            {
                taskId: '',
                destination: '/my-file.txt',
                localFile: {
                    path: '/tmp/my-file.txt',
                    size: 0,
                    lastModified: new Date('2023-02-14T19:09:06.392Z'),
                },
                s3Object: {
                    key: '',
                    size: 0,
                    lastModified: new Date('2024-02-14T19:09:06.392Z'),
                },
                direction: TransferDirection.Upload,
                status: '',
                statusMessage: '',
                jobId: '',
                checksum: 'cc57e6f2',
                priority: 0,
                error: '',
                bytesTransferred: 0,
            },
        ],
    },
};

// 1 upload with a comma in every text value
export const withCommasDataCaseInput: ExportJobList = {
    'jobID, hasComma': {
        jobName: 'model, textures, and rig.zip',
        destination: 'my, prefix',
        direction: TransferDirection.Upload,
        transferProfileName: 'my, remote-config',
        bucket: 'my, bucket',
        transfers: [
            {
                taskId: 'taskID, hasComma',
                destination: 'my, prefix/animation.ma',
                localFile: {
                    path: 'C:\\Ad, ministrator\\Desk, top\\animation.ma',
                    size: 7329644353,
                    lastModified: new Date('2008-10-21T20:05:06.452Z'),
                },
                s3Object: {
                    key: '',
                    size: 0,
                    lastModified: new Date('2023-02-14T19:09:06.392Z'),
                },
                direction: TransferDirection.Upload,
                status: 'IN, PROGRESS',
                statusMessage: 'no, message',
                jobId: 'jobID, hasComma',
                checksum: '6, 6d8634',
                priority: 11,
                error: 'no, error',
                bytesTransferred: 5646,
            },
        ],
    },
};
