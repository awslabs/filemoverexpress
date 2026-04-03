import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { WelcomeModalComponent } from '@app/components/modals/welcome-modal/welcome-modal.component';

@Injectable({
    providedIn: 'root',
})
export class StartupService {
    private dialog = inject(MatDialog);

    constructor() {
        this.checkFirstLaunchComplete();
    }

    /**
     * Checks if this is the first time launching the shell and opens the welcome modal if so.
     */
    checkFirstLaunchComplete(): void {
        if (window.fme) {
            window.fme.firstLaunchComplete().then(
                (firstLaunchComplete) => {
                    if (!firstLaunchComplete) {
                        this.openWelcomeModal();
                    }
                },
            );
        }
    }

    /**
     * Opens modal with welcome text.
     */
    openWelcomeModal(): void {
        this.dialog.open(WelcomeModalComponent, {
            width: '700px',
            autoFocus: 'dialog',
        });
    }
}
