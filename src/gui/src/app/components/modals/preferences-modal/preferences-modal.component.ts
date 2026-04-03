import { Component, inject } from '@angular/core';
import { MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormField, MatOption, MatSelect, MatSelectChange } from '@angular/material/select';
import { ButtonComponent } from '@primitives/buttons/button/button.component';
import { defaultOptions as defaultPreferences } from '@services/preferences/preferences.constants';
import { PreferenceTransferExport } from '@services/preferences/preferences.interfaces';
import { PreferencesService } from '@services/preferences/preferences.service';
import { DaemonCloseOptions, NotificationDelay, NotificationPositions } from './preferences-modal.constants';

@Component({
    selector: 'fme-preferences',
    templateUrl: './preferences-modal.component.html',
    styleUrls: ['./preferences-modal.component.scss'],
    imports: [
        MatDialogTitle,
        MatDialogContent,
        MatFormField,
        MatSelect,
        MatOption,
        MatDialogActions,
        ButtonComponent,
    ],
})
export class PreferencesModalComponent {
    private prefService = inject(PreferencesService);
    dialogRef = inject<MatDialogRef<PreferencesModalComponent>>(MatDialogRef);

    selectedNotificationPosition = '';
    notificationDelay: number;
    selectedDaemonClose: string;
    notificationPositions = NotificationPositions;
    autoHideOptions = NotificationDelay;
    daemonCloseOptions = DaemonCloseOptions;
    transferExport: PreferenceTransferExport = defaultPreferences.transferExport;
    transferPageSize: number = defaultPreferences.transferPageSize;

    constructor() {
        const preferences = this.prefService.getAllPreferences();
        let currentPos = preferences.notificationPosition;
        if (!currentPos) {
            currentPos = defaultPreferences.notificationPosition;
        }
        for (const pos of NotificationPositions) {
            if (pos.position.vertical === currentPos?.vertical && pos.position.horizontal === currentPos?.horizontal) {
                this.selectedNotificationPosition = pos.name;
                break;
            }
        }


        this.notificationDelay = preferences.notificationAutoHideDelay;
        this.transferExport = preferences.transferExport;
        this.transferPageSize = preferences.transferPageSize;

        const validCloseOptions = this.daemonCloseOptions.map((itm) => itm.value);
        if (!validCloseOptions.includes(preferences.daemonClose)) {
            this.prefService.daemonClose = 'ask';
            preferences.daemonClose = 'ask';
        }
        this.selectedDaemonClose = preferences.daemonClose;
    }

    notificationPositionChanged(event: MatSelectChange) {
        for (const pos of NotificationPositions) {
            if (pos.name === event.value) {
                this.prefService.notificationPosition = pos.position;
                return;
            }
        }
    }

    notificationAutoHideChanged(event: MatSelectChange) {
        this.prefService.notificationHideDelay = event.value;
    }

    daemonCloseChanged(event: MatSelectChange) {
        this.prefService.daemonClose = event.value;
    }

    close() {
        return () => {
            this.dialogRef.close();
        };
    }
}
