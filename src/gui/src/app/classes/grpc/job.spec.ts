import { describe, it, expect } from 'vitest';
import { create } from '@bufbuild/protobuf';
import { JobSchema } from '@gen/es/fme/v1/job_pb';
import { Job } from './job';

describe('Job (grpc)', () => {
    it('maps the ASC MHL verification fields from protobuf', () => {
        const pb = create(JobSchema);
        pb.jobId = 'job-1';
        pb.name = 'My Upload';
        pb.ascMhlVerified = 3;
        pb.ascMhlListed = 4;
        pb.ascMhlAlgorithm = 'xxhash64';

        const job = Job.fromProtobuf(pb);

        expect(job.ascMhlVerified).toBe(3);
        expect(job.ascMhlListed).toBe(4);
        expect(job.ascMhlAlgorithm).toBe('xxhash64');
    });

    it('defaults ASC MHL fields to zero / empty when no manifest shipped', () => {
        const pb = create(JobSchema);
        pb.jobId = 'job-2';

        const job = Job.fromProtobuf(pb);

        expect(job.ascMhlVerified).toBe(0);
        expect(job.ascMhlListed).toBe(0);
        expect(job.ascMhlAlgorithm).toBe('');
    });
});
