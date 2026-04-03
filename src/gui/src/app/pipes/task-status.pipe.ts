import { Pipe, PipeTransform } from '@angular/core';
import { TaskStatus } from '@state/models/job.model';

@Pipe({
    name: 'taskStatus',

})
export class TaskStatusPipe implements PipeTransform {
    transform(status: TaskStatus): string {
        switch (status) {
            case TaskStatus.Queued:
                return 'Queued';
            case TaskStatus.Checksumming:
                return 'Checksumming';
            case TaskStatus.InProgress:
                return 'In Progress';
            case TaskStatus.Paused:
                return 'Paused';
            case TaskStatus.Skipped:
                return 'Skipped';
            case TaskStatus.Completed:
                return 'Completed';
            case TaskStatus.Error:
                return 'Error';
            case TaskStatus.Cancelled:
                return 'Cancelled';
            default:
                return 'Unknown';
        }
    }
}
