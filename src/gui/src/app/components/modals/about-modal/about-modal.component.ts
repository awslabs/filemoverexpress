import { Component, inject } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import {
    MAT_DIALOG_DATA,
    MatDialog,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { WelcomeModalComponent } from '@app/components/modals/welcome-modal/welcome-modal.component';
import { WailsService } from '@services/wails/wails.service';

export interface AboutModalData {
    version: string;
}

@Component({
    selector: 'fme-about-modal',
    templateUrl: './about-modal.component.html',
    styleUrls: ['./about-modal.component.scss'],
    imports: [
        MatDialogTitle,
        MatIconButton,
        MatDialogClose,
        MatIcon,
        MatDialogContent,
    ],
})
export class AboutModalComponent {
    private dialog = inject(MatDialog);
    private wailsService = inject(WailsService);

    readonly githubUrl = 'https://github.com/awslabs/filemoverexpress';
    readonly licenseUrl = 'https://github.com/awslabs/filemoverexpress/blob/main/LICENSE';

    data = inject<AboutModalData>(MAT_DIALOG_DATA);

    /** True when running inside the Wails desktop app (the browser dev server has no runtime). */
    private get isDesktop(): boolean {
        return typeof (window as unknown as { _wails?: unknown })._wails !== 'undefined';
    }

    openLink(url: string): void {
        if (this.isDesktop) {
            this.wailsService.externalLink(url).subscribe();
        } else {
            window.open(url, '_blank', 'noopener');
        }
    }

    showWelcomeTour(): void {
        this.dialog.open(WelcomeModalComponent, {
            width: '700px',
            autoFocus: 'dialog',
        });
    }
}
