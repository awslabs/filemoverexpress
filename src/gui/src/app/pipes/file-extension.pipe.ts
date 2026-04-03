import { Pipe, PipeTransform } from '@angular/core';
import { getFileExtension } from '@app/utils/path-utils';

@Pipe({
    name: 'fileExtension',

})
export class FileExtensionPipe implements PipeTransform {
    transform(path: string): string {
        return getFileExtension(path);
    }
}
