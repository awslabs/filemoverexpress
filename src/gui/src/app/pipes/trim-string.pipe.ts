import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'trimString',

})
export class TrimStringPipe implements PipeTransform {
    transform(value: string): string {
        return value.trim();
    }
}
