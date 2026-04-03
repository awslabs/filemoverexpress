import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'listSort',

})
export class ListSortPipe implements PipeTransform {
    transform<T>(value: T[]): T[] {
        return value.sort();
    }
}

