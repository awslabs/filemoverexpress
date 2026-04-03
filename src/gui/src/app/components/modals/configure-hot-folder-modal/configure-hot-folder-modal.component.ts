import { Component, EventEmitter, inject, OnInit, Output } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { HintsPanelComponent } from '@app/components/layout/hints-panel/hints-panel.component';
import { ConfigureHotFolderModalData } from '@app/components/modals/configure-hot-folder-modal/configure-hot-folder-modal.interfaces';
import { NotificationMessages } from '@app/constants/common.constants';
import { FmeConfig, HotFolders } from '@classes/config';
import { HotFolderFormComponent } from '@containers/forms/hot-folder-form/hot-folder-form.component';
import { HotFolderData } from '@containers/forms/hot-folder-form/hot-folder-form.interfaces';
import { ButtonComponent } from '@primitives/buttons/button/button.component';
import { NotificationsService } from '@services/notifications/notifications.service';
import { FmeClientService } from '@services/fme-client/fme-client.service';

@Component({
    selector: 'fme-configure-hot-folder-modal',
    templateUrl: './configure-hot-folder-modal.component.html',
    styleUrls: ['./configure-hot-folder-modal.component.scss'],
    imports: [
        MatDialogTitle,
        MatDialogContent,
        HotFolderFormComponent,
        MatDialogActions,
        ButtonComponent,
    ],
})
export class ConfigureHotFolderModalComponent implements OnInit {
    data = inject<ConfigureHotFolderModalData>(MAT_DIALOG_DATA);
    dialogRef = inject<MatDialogRef<ConfigureHotFolderModalComponent>>(MatDialogRef);
    private fmeClientService = inject(FmeClientService);
    private notifications = inject(NotificationsService);
    private bottomSheet = inject(MatBottomSheet);


    @Output() hotFoldersSaved = new EventEmitter<boolean>();
    preFillNewHotFolderData: HotFolderData = {};
    hotFolders: HotFolders[] = [];
    hotFolderForm: FormGroup | null = null;
    private originalConfig: FmeConfig | null = null;

    constructor() {
        const data = this.data;

        this.preFillNewHotFolderData = {
            localSourcePath: data.hotFolderSourcePath,
        };
    }

    /**
     * Get the hot folders from the configuration file
     */
    ngOnInit() {
        this.fmeClientService.getConfiguration().subscribe({
            next: (result) => {
                this.originalConfig = result;
                this.hotFolders = result.uploadHotFolders;
            },
            error: (error) => {
                this.notifications.warning(`${NotificationMessages.GET_CONFIG_FAILURE}: ${error}`);
            },
        });
    }

    /**
     * Show hot folder hints
     *
     * @param {MouseEvent} event - Click MouseEvent
     * @param {string} message - Hint message string
     */
    toggleHint(event: MouseEvent, message: string) {
        event.stopPropagation();
        event.preventDefault();

        this.bottomSheet.open(HintsPanelComponent, {
            data: message,
            panelClass: 'bottom-sheet-hints',
        });
    }

    /**
     * Updates the stored hot folder FormGroup.
     *
     * @param {FormGroup} hotFolderForm - FormGroup from nested hot folder form component
     */
    updateHotFolderForm(hotFolderForm: FormGroup) {
        this.hotFolderForm = hotFolderForm;
    }

    /**
     * Cancel and close the dialog
     */
    cancel() {
        return () => {
            this.dialogRef.close();
        };
    }

    /**
     * Save the changes made to hot folders to the configuration file and close the dialog
     */
    save() {
        return () => {
            if (this.originalConfig && this.hotFolderForm) {
                const uploadHotFolders = this.hotFolderForm.get('uploadHotFolders');
                if (uploadHotFolders) {
                    this.originalConfig.uploadHotFolders = uploadHotFolders.getRawValue();
                    this.fmeClientService.setConfiguration(this.originalConfig).subscribe({
                        next: () => {
                            this.notifications.success('Successfully updated hot folders.');
                            this.hotFoldersSaved.emit(true);
                            this.dialogRef.close();
                        },
                        error: (error) => {
                            this.notifications.warning(`Error occurred when updating hot folders: ${error}`);
                            this.dialogRef.close();
                        },
                    });
                }
            } else {
                this.dialogRef.close();
            }
        };
    }
}
