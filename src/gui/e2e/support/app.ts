import { expect, Locator, Page } from '@playwright/test';

/**
 * Page helpers for the main screen. The GUI has no test ids, so these use roles, accessible names
 * and visible text, which is also what a user relies on.
 */
export class MainScreen {
    readonly local: Pane;
    readonly s3: Pane;

    constructor(readonly page: Page) {
        this.local = new Pane(page.locator('fme-daemon-browser'));
        this.s3 = new Pane(page.locator('fme-bucket-browser'));
    }

    async open(): Promise<void> {
        await this.page.goto('/');
        await expect(this.page.getByText('Connected', { exact: true })).toBeVisible();
    }

    /** Opens the jobs drawer at the bottom of the window. */
    async openJobs(): Promise<Locator> {
        const jobs = this.page.getByRole('table').filter({ has: this.page.getByRole('columnheader', { name: 'Progress' }) });
        const toggle = this.page.getByRole('button', { name: /Expand transfers/ });
        // The drawer animates, and a click during a re-render can be lost, so retry until it is open.
        await expect(async () => {
            if (!(await jobs.isVisible())) {
                await toggle.click();
            }
            await expect(jobs).toBeVisible({ timeout: 2_000 });
        }).toPass({ timeout: 15_000 });
        return jobs;
    }

    /** Waits until the jobs drawer shows the job as Completed. */
    async expectJobCompleted(name: string): Promise<void> {
        const jobs = await this.openJobs();
        const row = jobs.getByRole('row', { name: new RegExp(escape(name)) });
        await expect(row).toContainText('Completed', { timeout: 30_000 });
        await expect(row).toContainText('100%');
    }

    /** Drags a row of one pane onto the other pane, which starts a transfer. */
    async drag(from: Pane, name: string, to: Pane): Promise<void> {
        const source = await from.row(name).boundingBox();
        // Drop in the middle of the whole pane: the table itself can be only a few rows high.
        const target = await to.root.boundingBox();
        if (!source || !target) {
            throw new Error(`cannot drag ${name}: element not on screen`);
        }
        // The panes use pointer-driven drag and drop, so move in steps and pause before dropping.
        const { mouse } = this.page;
        await mouse.move(source.x + 60, source.y + source.height / 2);
        await mouse.down();
        await mouse.move(source.x + 120, source.y + 10, { steps: 5 });
        await mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 25 });
        await this.page.waitForTimeout(300);
        await mouse.up();
    }

    /** The confirmation dialog shown before a transfer starts. */
    transferDialog(title: 'Upload Files' | 'Download Files'): Locator {
        return this.page.locator('mat-dialog-container').filter({ hasText: title });
    }
}

/**
 * One of the two file browser panes. Panes are found by their component element, the one place
 * where the suite depends on markup: the headings and toolbars of both panes look alike.
 */
export class Pane {
    constructor(readonly root: Locator) {}

    table(): Locator {
        return this.root.getByRole('table');
    }

    row(name: string): Locator {
        return this.table().getByRole('row', { name: new RegExp(`(^|\\s)${escape(name)}(\\s|$)`) });
    }

    async expectEntry(name: string): Promise<void> {
        await expect(this.row(name)).toBeVisible();
    }

    async expectNoEntry(name: string): Promise<void> {
        await expect(this.row(name)).toHaveCount(0);
    }

    /** Opens a folder by double-clicking it. */
    async enter(name: string): Promise<void> {
        await this.row(name).dblclick();
        await expect(this.breadcrumb()).toContainText(name);
    }

    /** Follows a path of folder names from the current folder. */
    async walk(path: string): Promise<void> {
        for (const part of path.split('/').filter(Boolean)) {
            await this.enter(part);
        }
    }

    async refresh(): Promise<void> {
        await this.root.getByRole('button').filter({ hasText: 'refresh' }).click();
    }

    async filter(text: string): Promise<void> {
        await this.root.getByRole('textbox', { name: 'Filter' }).fill(text);
    }

    /** The path line above the heading ("File System > tmp > ..."). */
    breadcrumb(): Locator {
        return this.root.locator('.breadcrumbs');
    }
}

function escape(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
