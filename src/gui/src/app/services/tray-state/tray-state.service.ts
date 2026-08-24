import { Injectable, inject, signal } from '@angular/core';
import { PreferencesService } from '@services/preferences/preferences.service';

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
    private prefs = inject(PreferencesService);

    /** True when the tray is collapsed to the summary bar. Defaults to collapsed on app open. */
    readonly collapsed = signal(true);

    /**
     * Expanded tray height in px (drag-resizable via the handle on the tray's top edge).
     * Seeded from the persisted preference and clamped so the panels above stay usable.
     */
    readonly expandedHeight = signal<number>(this.prefs.trayHeight);

    /** Floor so the tabs + a few rows stay visible. */
    private static readonly MIN_HEIGHT = 160;

    /** Clamp and apply a new tray height (leaves room for the panels above). */
    setExpandedHeight(px: number): void {
        const max = Math.max(TrayStateService.MIN_HEIGHT, window.innerHeight - 280);
        this.expandedHeight.set(Math.max(TrayStateService.MIN_HEIGHT, Math.min(px, max)));
    }

    /** Persist the current height (call once at the end of a drag). */
    commitExpandedHeight(): void {
        this.prefs.trayHeight = this.expandedHeight();
    }

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
