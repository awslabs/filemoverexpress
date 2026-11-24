import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { MainScreen } from '../support/app';
import { environment, LOCAL, SEEDED } from '../support/environment';

// The tests share one daemon and one bucket, and each leaves its result behind, so run in order.
test.describe.configure({ mode: 'serial' });

test.describe('transfers', () => {
    let app: MainScreen;

    test.beforeEach(async ({ page }) => {
        app = new MainScreen(page);
        await app.open();
        await app.local.walk(environment().filesDir);
    });

    test('uploads a file by dragging it onto the bucket', async () => {
        await app.drag(app.local, LOCAL.file, app.s3);

        const dialog = app.transferDialog('Upload Files');
        await expect(dialog).toContainText('Uploading 1 file');
        await expect(dialog).toContainText(LOCAL.file);
        await dialog.getByRole('button', { name: 'Upload', exact: true }).click();

        await app.expectJobCompleted(LOCAL.file);
        await app.s3.refresh();
        await app.s3.expectEntry(LOCAL.file);
        await expect(app.s3.row(LOCAL.file)).toContainText('38 Bytes');
    });

    test('uploads a folder with its contents', async () => {
        await app.drag(app.local, LOCAL.folder, app.s3);
        await app.transferDialog('Upload Files').getByRole('button', { name: 'Upload', exact: true }).click();

        await app.expectJobCompleted(LOCAL.folder);
        await app.s3.refresh();
        await app.s3.enter(LOCAL.folder);
        await app.s3.expectEntry('inside.txt');
    });

    test('downloads an object by dragging it onto the local folder', async () => {
        await app.s3.enter(SEEDED.folder);
        await app.drag(app.s3, SEEDED.file, app.local);

        const dialog = app.transferDialog('Download Files');
        await expect(dialog).toContainText(SEEDED.file);
        await dialog.getByRole('button', { name: 'Download', exact: true }).click();

        await app.expectJobCompleted(SEEDED.file);
        await app.local.refresh();
        // The GUI sends the S3 folder it is showing, so the key is taken relative to it: seed/readme.txt
        // lands as readme.txt, not seed/readme.txt (unlike a plain DownloadPrefixes call).
        await app.local.expectEntry(SEEDED.file);
        const onDisk = readFileSync(join(environment().filesDir, SEEDED.file), 'utf8');
        expect(onDisk).toBe('hello from the emulator\n');
    });
});
