import { describe, it, expect } from 'vitest';
import { TaskStatus } from '@state/models/job.model';
import { TaskStatusPipe } from './task-status.pipe';

describe('TaskStatusPipe', () => {
    it('create an instance', () => {
        const pipe = new TaskStatusPipe();
        expect(pipe).toBeTruthy();
        expect(pipe.transform(TaskStatus.Queued)).toEqual('Queued');
        expect(pipe.transform(TaskStatus.Checksumming)).toEqual('Checksumming');
        expect(pipe.transform(TaskStatus.InProgress)).toEqual('In Progress');
        expect(pipe.transform(TaskStatus.Paused)).toEqual('Paused');
        expect(pipe.transform(TaskStatus.Skipped)).toEqual('Skipped');
        expect(pipe.transform(TaskStatus.Completed)).toEqual('Completed');
        expect(pipe.transform(TaskStatus.Error)).toEqual('Error');
        expect(pipe.transform(TaskStatus.Cancelled)).toEqual('Cancelled');
        expect(pipe.transform(TaskStatus.Unknown)).toEqual('Unknown');
    });
});
