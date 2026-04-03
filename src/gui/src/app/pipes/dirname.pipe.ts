import { Pipe, PipeTransform } from '@angular/core';
import { dirname } from '@app/utils/utils';

@Pipe({
    name: 'dirname',
})
export class DirnamePipe implements PipeTransform {
    transform(value: string): string {
        return dirname(value);
    }

}
