import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'barmode',
})
export class BarmodePipe implements PipeTransform {
    transform(value: string, determinate: string[] = [
        'Queued',
        'Completed',
        'Skipped',
    ]): string {
        return determinate.includes(value) ? 'determinate' : 'buffer';
    }
}
