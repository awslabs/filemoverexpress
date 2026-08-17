import { Injectable, signal } from '@angular/core';

/**
 * Shared UI state for the bottom transfer tray (Jobs / Logs / Bucket Reports).
 *
 * The tray opens COLLAPSED to a slim summary bar (matching the redesign mockup) and can be
 * expanded/collapsed by the user regardless of whether transfers are active. The layout
 * (fme-main) reads this to give the panels the freed vertical space when collapsed, while
 * the tray component (fme-table-group) renders either the slim bar or the full tabbed view.
 */
@Injectable({providedIn: 'root'})
export class TrayStateService {
    /** True when the tray is collapsed to the summary bar. Defaults to collapsed on app open. */
    readonly collapsed = signal(true);

    toggle(): void {
        this.collapsed.update((value) => !value);
    }

    expand(): void {
        this.collapsed.set(false);
    }

    collapse(): void {
        this.collapsed.set(true);
    }
}
