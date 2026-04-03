import { Pipe, PipeTransform } from '@angular/core';
import { basename } from '@app/utils/utils';

@Pipe({
    name: 'basename',
})
export class BasenamePipe implements PipeTransform {
    transform(value: string): string {
        return basename(value);
    }
}
