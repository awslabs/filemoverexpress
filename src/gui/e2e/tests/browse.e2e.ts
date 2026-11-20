import { expect, test } from '@playwright/test';

import { MainScreen } from '../support/app';
import { environment, LOCAL, SEEDED } from '../support/environment';

test.describe('browsing', () => {
    let app: MainScreen;

    test.beforeEach(async ({ page }) => {
        app = new MainScreen(page);
        await app.open();
    });

    test('connects to the daemon without showing the first-launch dialog', async ({ page }) => {
        await expect(page.getByText('Connected', { exact: true })).toBeVisible();
        await expect(page.getByText('Welcome to File Mover Express')).toHaveCount(0);
    });

    test('lists the bucket of the selected transfer profile', async () => {
        await expect(app.s3.root).toContainText(environment().profile);
        await app.s3.expectEntry(SEEDED.folder);
    });

    test('opens nested S3 folders', async () => {
        await app.s3.enter(SEEDED.folder);
        await app.s3.expectEntry(SEEDED.file);
        await app.s3.expectEntry(SEEDED.nestedFolder);

        await app.s3.enter(SEEDED.nestedFolder);
        for (const name of SEEDED.nestedFiles) {
            await app.s3.expectEntry(name);
        }
        await expect(app.s3.breadcrumb()).toContainText(SEEDED.nestedFolder);
    });

    test('lists a local folder', async () => {
        await app.local.walk(environment().filesDir);
        await app.local.expectEntry(LOCAL.file);
        await app.local.expectEntry(LOCAL.folder);
    });

    test('filters the S3 listing', async () => {
        await app.s3.enter(SEEDED.folder);
        await app.s3.filter('readme');
        await app.s3.expectEntry(SEEDED.file);
        await app.s3.expectNoEntry(SEEDED.nestedFolder);
    });
});
