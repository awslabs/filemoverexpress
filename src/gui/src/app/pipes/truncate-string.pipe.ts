import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'truncateString',

})
export class TruncateStringPipe implements PipeTransform {
    transform(value: string, len = 35): string {
        if (value.length <= len) {
            return value;
        }

        const midStart = Math.floor(len / 2);
        const endStart = (Math.ceil(len / 2) - 1) * -1;

        return `${value.slice(0, midStart)}…${value.slice(endStart)}`;
    }
}
