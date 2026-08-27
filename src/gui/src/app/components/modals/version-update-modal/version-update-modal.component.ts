import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { ButtonComponent } from '@primitives/buttons/button/button.component';
import { VersionService } from '@services/version/version.service';
import { docsLinks } from '@app/constants/external-links';
import { WailsService } from '@services/wails/wails.service';

@Component({
    selector: 'fme-version-update-modal',
    templateUrl: './version-update-modal.component.html',
    styleUrls: ['./version-update-modal.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        MatDialogTitle,
        MatDialogContent,
        MatDialogActions,
        ButtonComponent,
    ],
})
export class VersionUpdateModalComponent {
    private updatesService = inject(VersionService);
    private dialogRef = inject<MatDialogRef<VersionUpdateModalComponent>>(MatDialogRef);
    private wails = inject(WailsService);

    nextVersion: string;
    ignoredUpdates: string[];
    releaseNotes: string[];

    constructor() {
        const updates = this.updatesService.getAllUpdates();
        this.nextVersion = updates.nextVersion;
        this.ignoredUpdates = updates.updatesIgnored;
        this.releaseNotes = updates.releaseNotes;
    }

    update() {
        return () => {
            try {
                this.wails.externalLink(docsLinks.GITHUB_REPO).subscribe();
            } catch {
                window.open(docsLinks.GITHUB_REPO, '_blank');
            }
            this.dialogRef.close();
        };
    }

    skip() {
        return () => {
            this.updatesService.skip();
            this.dialogRef.close();
        };
    }

    ignore() {
        return () => {
            this.updatesService.ignoreUpdate = this.nextVersion;
            this.dialogRef.close();
        };
    }

    version(): string {
        return this.nextVersion;
    }
}
