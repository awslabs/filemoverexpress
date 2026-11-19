import { describe, it, expect } from 'vitest';
import { create } from '@bufbuild/protobuf';
import { TaskSchema, TaskLocalFileSchema, TaskS3ObjectSchema } from '@gen/es/fme/v1/job_pb';
import { Task } from './task';

function makeProtoTask() {
    const pb = create(TaskSchema);
    pb.taskId = 't1';
    pb.taskDirection = 'upload';
    pb.localFile = create(TaskLocalFileSchema);
    pb.localFile.path = '/local/clip.mov';
    pb.s3Object = create(TaskS3ObjectSchema);
    pb.s3Object.key = 'clip.mov';
    return pb;
}

describe('Task (grpc)', () => {
    it('maps the ASC MHL per-file status from protobuf', () => {
        const pb = makeProtoTask();
        pb.ascMhlStatus = 'mismatch';

        const task = Task.fromProtobuf(pb);

        expect(task.ascMhlStatus).toBe('mismatch');
    });

    it('carries the ASC MHL status onto the flattened task used by the report', () => {
        const pb = makeProtoTask();
        pb.ascMhlStatus = 'verified';
        const task = Task.fromProtobuf(pb);

        const flat = Task.toFlattenedTask(task, 'my-bucket');

        expect(flat.ascMhlStatus).toBe('verified');
    });

    it('defaults the ASC MHL status to empty when the file was not in a manifest', () => {
        const task = Task.fromProtobuf(makeProtoTask());
        expect(task.ascMhlStatus).toBe('');
    });
});
