import { Pipe, PipeTransform } from '@angular/core';
import { calculateTimeToCompletion } from '@app/classes/time-to-completion';
import { Transfer } from '@state/models/transfer.model';

@Pipe({
    name: 'timeToCompletion',

})
export class TimeToCompletionPipe implements PipeTransform {
    transform(value: Transfer): string {
        if (!value.started) {
            return 'N/A';
        }

        if (!value.completed) {
            return calculateTimeToCompletion(value.started, value.totalBytes, value.bytesTransferred);
        }

        return 'Completed';
    }
}
