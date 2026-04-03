import { Pipe, PipeTransform } from '@angular/core';

const ellipses = '...';

@Pipe({
    name: 'textEllipses',

})
export class TextEllipsesPipe implements PipeTransform {
    /**
     * Processes a string to shorten it with ellipses if its length exceeds stringLengthLimit
     * @param value Text string to process
     * @param stringLengthLimit Maximum length of the string, not including the ellipses
     * @returns {string} Text string shortened with ellipses or original text string
     */
    transform(value: string, stringLengthLimit?: number): string {
        if (!stringLengthLimit) {
            stringLengthLimit = 30;
        }
        if (value.length > stringLengthLimit) {
            return value.slice(0, stringLengthLimit) + ellipses;
        }
        return value;
    }
}
