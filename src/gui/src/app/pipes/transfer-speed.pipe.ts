import { Pipe, PipeTransform } from '@angular/core';
import { Transfer } from '@state/models/transfer.model';

@Pipe({
    name: 'transferSpeed',

})
export class TransferSpeedPipe implements PipeTransform {
    transform(value: Transfer): number {
        if (!value.started) {
            return 0;
        }

        if (value.completed) {
            const seconds = (value.completed.getTime() - value.started.getTime()) / 1000;
            if (seconds === 0) {
                return 0;
            }
            return value.totalBytes / seconds;
        } else {
            const seconds = (Date.now() - value.started.getTime()) / 1000;
            if (seconds === 0) {
                return 0;
            }
            return value.bytesTransferred / seconds;
        }
    }
}
