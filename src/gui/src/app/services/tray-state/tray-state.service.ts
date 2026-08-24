import { Injectable, signal } from '@angular/core';

/** Tab order of the expanded tray, matching the template's <mat-tab> order. */
export enum TrayTab {
    Jobs = 0,
    Logs = 1,
    Reports = 2
}

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

    /**
     * Which tab the expanded tray shows. Two-way bound to the mat-tab-group's selectedIndex so
     * user tab clicks and programmatic navigation (e.g. showReports()) stay in sync.
     */
    readonly activeTab = signal<TrayTab>(TrayTab.Jobs);

    toggle(): void {
        this.collapsed.update((value) => !value);
    }

    expand(): void {
        this.collapsed.set(false);
    }

    collapse(): void {
        this.collapsed.set(true);
    }

    setActiveTab(tab: TrayTab): void {
        this.activeTab.set(tab);
    }

    /** Open the tray on the Bucket Reports tab (e.g. right after a report is generated). */
    showReports(): void {
        this.activeTab.set(TrayTab.Reports);
        this.collapsed.set(false);
    }
}
