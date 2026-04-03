import { Pipe, PipeTransform } from '@angular/core';
import { fileBrowserObjectIcon, PREVIOUS_FOLDER_NAME } from '@app/components/layout/file-browser/file-browser.constants';
import { FileBrowserObject, FileBrowserObjectType } from '@app/components/layout/file-browser/file-browser.interfaces';

@Pipe({
    name: 'fileBrowserIcon',

})
export class FileBrowserIconPipe implements PipeTransform {
    /**
     * Gets the icon for the given file browser object based on if it's a file, folder, or navigator to
     * the previous directory
     * @param object Object to get icon for
     * @returns {string} Icon string
     */
    transform(object: FileBrowserObject): string {
        if (object.name === PREVIOUS_FOLDER_NAME && object.type === FileBrowserObjectType.FOLDER) {
            return fileBrowserObjectIcon.PREVIOUS_DIRECTORY;
        }
        switch (object.type) {
            case FileBrowserObjectType.FILE:
                return fileBrowserObjectIcon.FILE;
            case FileBrowserObjectType.FOLDER:
                return fileBrowserObjectIcon.FOLDER;
            case FileBrowserObjectType.UNKNOWN:
            default:
                return fileBrowserObjectIcon.UNKNOWN;
        }
    }
}
