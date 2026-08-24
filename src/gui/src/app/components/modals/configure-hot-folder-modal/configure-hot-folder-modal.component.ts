import { Component, EventEmitter, inject, OnInit, Output } from '@angular/core';
import { FormArray, FormGroup } from '@angular/forms';
import {
    MAT_DIALOG_DATA,
    MatDialogActions,
    MatDialogContent,
    MatDialogRef,
    MatDialogTitle,
} from '@angular/material/dialog';
import { HintPopoverService } from '@services/hint-popover/hint-popover.service';
import { ConfigureHotFolderModalData } from '@app/components/modals/configure-hot-folder-modal/configure-hot-folder-modal.interfaces';
import { NotificationMessages } from '@app/constants/common.constants';
import { FmeConfig, HotFolders } from '@classes/config';
import { HotFolderFormComponent } from '@containers/forms/hot-folder-form/hot-folder-form.component';
import { HotFolderFormGroup } from '@containers/forms/hot-folder-form/hot-folder-form.interfaces';
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
    private hintPopover = inject(HintPopoverService);

    @Output() hotFoldersSaved = new EventEmitter<boolean>();
    hotFolders: HotFolders[] = [];
    hotFolderForm: FormArray<FormGroup<HotFolderFormGroup>> | null = null;
    private originalConfig: FmeConfig | null = null;

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

        this.hintPopover.open(event.currentTarget as HTMLElement, message);
    }

    /**
     * Updates the stored hot folder FormGroup.
     *
     * @param {FormGroup} hotFolderForm - FormGroup from nested hot folder form component
     */
    updateHotFolderForm(hotFolderForm: FormArray<FormGroup<HotFolderFormGroup>>) {
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
            // Surface validation (e.g. a missing hot folder name) instead of silently
            // saving. markAllAsTouched makes the required-field errors render.
            if (this.hotFolderForm && this.hotFolderForm.invalid) {
                this.hotFolderForm.markAllAsTouched();
                this.notifications.warning('Give each hot folder a name and complete the required fields before saving.');
                return;
            }
            if (this.originalConfig && this.hotFolderForm) {
                if (this.hotFolderForm) {
                    this.originalConfig.uploadHotFolders = this.hotFolderForm.getRawValue();
                    this.fmeClientService.setConfiguration(this.originalConfig).subscribe({
                        next: () => {
                            console.debug('Successfully updated hot folders.');
                            this.notifications.success('Successfully updated hot folders.');
                            this.hotFoldersSaved.emit(true);
                            this.dialogRef.close();
                        },
                        error: (error) => {
                            console.error(`Error occurred when updating hot folders: ${error}`);
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
