import { Pipe, PipeTransform } from '@angular/core';
import { PathType } from '@app/interfaces/paths';

@Pipe({
    name: 'fileBrowserPathType',

})
export class FileBrowserPathTypePipe implements PipeTransform {
    /**
     * Returns the formatted string that represents the
     * @param object Object to get icon for
     * @returns {string} Icon string
     */
    transform(type: PathType): string {
        switch (type) {
            case PathType.FILE:
                return 'file';
            case PathType.FOLDER:
                return 'folder';
            case PathType.S3_OBJECT:
                return 'S3 object';
            case PathType.S3_PREFIX:
                return 'S3 prefix';
            default:
                return '';
        }
    }
}
