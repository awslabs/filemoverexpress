import { Component, computed, input, model, output, ChangeDetectionStrategy } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatDivider } from '@angular/material/list';

const fileSeparator = '/';
const ellipse = '...';
const ellipseUpperBound = 5;

@Component({
    selector: 'fme-breadcrumbs',
    templateUrl: './breadcrumbs.component.html',
    styleUrls: ['./breadcrumbs.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatIcon,
        MatTooltip,
        MatMenu,
        MatMenuItem,
        MatMenuTrigger,
        MatDivider],
})
export class BreadcrumbsComponent {
    public breadcrumbPath = model<string>('/');
    public root = input<string>('root');
    public navigate = output<string>();

    // Computed signals

    /**
     * Get full list of folder paths in an array and clean out empty path elements
     */
    cleanBreadcrumbsPathArray = computed(() => {
        return this.breadcrumbPath().split('/').filter((itm) => itm.trim().length);
    });

    /**
     * Get list of breadcrumb paths that are displayed
     */
    breadcrumbs = computed(() => {
        const paths = this.cleanBreadcrumbsPathArray();
        let result: string[];
        if (paths.length > ellipseUpperBound) {
            result = [ellipse, ...paths.slice(-ellipseUpperBound)];
        } else {
            result = [...paths];
        }
        return result;
    });

    /**
     * Get list of folders hidden under ellipses element, or empty array if display did not need to be shortened
     */
    ellipsesFolders = computed(() => {
        if (!this.hasEllipse()) {
            return [];
        }
        const numFoldersUnderEllipses = this.cleanBreadcrumbsPathArray().length - ellipseUpperBound;
        return this.cleanBreadcrumbsPathArray().slice(0, numFoldersUnderEllipses);
    });

    /**
     * Returns true if number of elements in path exceeds ellipseUpperBound, else false
     */
    hasEllipse = computed(() => {
        const paths = this.breadcrumbs();
        return paths.length > ellipseUpperBound;
    });

    // Click handlers

    /**
     * Click the single breadcrumb will emit the event to navigate the browser to the clicked folder
     * @param folderIdx The idx of the folder in the displayed breadcrumb path.
     */
    clickBreadcrumb(folderIdx: number): void {
        if (folderIdx === -1) {
            this.breadcrumbPath.set('/');
            this.navigate.emit(this.breadcrumbPath());
            return;
        }

        // clicked on ellipse
        if (this.hasEllipse() && folderIdx === 0) {
            // handled by matMenuTriggerFor to show folder dropdown
            return;
        }

        let pathIndex = folderIdx;
        if (this.hasEllipse()) {
            // compute real index
            pathIndex += this.ellipsesFolders().length;
        }
        let clickedFolder: string = this.cleanBreadcrumbsPathArray().slice(0, pathIndex + 1).join(fileSeparator);
        if (clickedFolder[0] != fileSeparator) {
            clickedFolder = fileSeparator + clickedFolder;
        }
        this.navigate.emit(clickedFolder);
    }

    /**
     * Click handler to navigate to a folder in ellipses dropdown
     * @param folderIdx The idx of the folder in the dropdown (hidden ellipses path).
     */
    clickEllipseFolder(folderIdx: number): void {
        let clickedFolder: string = this.cleanBreadcrumbsPathArray().slice(0, folderIdx + 1).join(fileSeparator);
        if (clickedFolder[0] != fileSeparator) {
            clickedFolder = fileSeparator + clickedFolder;
        }
        this.navigate.emit(clickedFolder);
    }
}
