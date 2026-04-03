import { Pipe, PipeTransform } from '@angular/core';
import { formatBytes } from '@app/utils/utils';

@Pipe({
    name: 'formatBytes',

})
export class FormatBytesPipe implements PipeTransform {
    transform(value: number | bigint, decimals?: number, suffix?: string, fallback: string | null = null): string {
        if (!value) {
            return fallback !== null ? fallback : 'Unknown';
        }

        if (typeof value === 'bigint') {
            value = Number(value);
        }
        if (!decimals) {
            decimals = 0;
        }
        const formatted = formatBytes(value as number, decimals, 1000);
        return suffix ? formatted + suffix : formatted;
    }
}
