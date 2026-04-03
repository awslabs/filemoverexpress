import { NgIterable, Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'objectSort',

})
export class ObjectSortPipe implements PipeTransform {
    transform<T extends object, K extends string = string>(items: T[], key: keyof T): NgIterable<T> {
        return items.sort((a: T, b: T) => (a[key] as K).localeCompare(b[key] as K));
    }
}
