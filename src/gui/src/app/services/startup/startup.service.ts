import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { WelcomeModalComponent } from '@app/components/modals/welcome-modal/welcome-modal.component';
import { WailsService } from '@services/wails/wails.service';

@Injectable({
    providedIn: 'root',
})
export class StartupService {
    private dialog = inject(MatDialog);
    private wails = inject(WailsService);

    constructor() {
        this.checkFirstLaunchComplete();
    }

    /**
     * Checks if this is the first time launching the shell and opens the welcome modal if so.
     */
    checkFirstLaunchComplete(): void {
        try {
            this.wails.firstLaunchComplete()
                .subscribe(
                    {
                        next: (firstLaunchComplete) => {
                            if (!firstLaunchComplete) {
                                this.openWelcomeModal();
                            }
                        },
                    },
                );
        } catch {
            // intentionally blank
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
