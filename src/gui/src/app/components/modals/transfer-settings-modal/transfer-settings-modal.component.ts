import { CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { NgTemplateOutlet, TitleCasePipe } from '@angular/common';
import { Component, EventEmitter, inject, Output, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatHint, MatInput, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { FileBrowserObject, FileBrowserObjectType } from '@app/components/layout/file-browser/file-browser.interfaces';
import {
    ObjectTypeCount,
    TransferDirection,
    TransferSettingsModalData,
    TransferSettingsModalResult,
} from '@app/components/modals/transfer-settings-modal/transfer-settings-modal.interfaces';
import { BasenamePipe } from '@app/pipes/basename.pipe';
import { FileBrowserIconPipe } from '@app/pipes/file-browser-icon.pipe';
import { EnterSubmitDirective } from '@app/directives/enter-submit.directive';
import { ButtonComponent } from '@primitives/buttons/button/button.component';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { NotificationDestination } from '@gen/es/fme/v1/notifications_pb';

@Component({
    selector: 'fme-transfer-settings-modal',
    templateUrl: './transfer-settings-modal.component.html',
    styleUrls: ['./transfer-settings-modal.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        MatDialogTitle,
        TitleCasePipe,
        MatDialogContent,
        CdkVirtualScrollViewport,
        CdkVirtualForOf,
        CdkFixedSizeVirtualScroll,
        NgTemplateOutlet,
        MatIcon,
        FileBrowserIconPipe,
        BasenamePipe,
        MatFormField,
        MatLabel,
        MatInput,
        ReactiveFormsModule,
        MatSlideToggle,
        MatHint,
        MatSelect,
        MatOption,
        MatDialogActions,
        ButtonComponent,
        EnterSubmitDirective,
    ],
})
export class TransferSettingsModalComponent {
    data = inject<TransferSettingsModalData>(MAT_DIALOG_DATA);
    dialogRef = inject<MatDialogRef<TransferSettingsModalComponent>>(MatDialogRef);
    private fmeClientService = inject(FmeClientService);

    @Output() transferSettingsResult = new EventEmitter<TransferSettingsModalResult>();
    forceTransfers: FormControl;
    jobName: FormControl;
    // "Notify me when this finishes": when on, the selected destination name is threaded
    // onto the upload request so the daemon posts a webhook when the job finishes/fails.
    notifyEnabled = new FormControl<boolean>(false, {nonNullable: true});
    notifyDestination = new FormControl<string>('', {nonNullable: true});
    notificationDestinations: NotificationDestination[] = [];
    totalObjectCounts: ObjectTypeCount = {
        numFolders: 0,
        numFiles: 0,
    };
    displayedObjects: FileBrowserObject[] = [];
    transferDirection = '';
    protected readonly FileBrowserObjectType = FileBrowserObjectType;

    constructor() {
        const data = this.data;

        switch (data.transferDirection) {
            case TransferDirection.UPLOAD:
                this.transferDirection = 'upload';
                break;
            case TransferDirection.DOWNLOAD:
                this.transferDirection = 'download';
                break;
            default:
                this.transferDirection = 'transfer';
        }
        this.displayedObjects = data.objectsToTransfer;
        if (data.dragOriginObjectName) {
            // sort list to bring drag origin object to start of list while preserving old older for rest of list
            this.displayedObjects.sort((a, b) => {
                if (a.name === data.dragOriginObjectName) {
                    return -1;
                }
                if (b.name === data.dragOriginObjectName) {
                    return 1;
                }
                return 0;
            });
        }
        for (const transferObject of data.objectsToTransfer) {
            switch (transferObject.type) {
                case FileBrowserObjectType.FOLDER:
                    this.totalObjectCounts.numFolders++;
                    break;
                case FileBrowserObjectType.FILE:
                case FileBrowserObjectType.UNKNOWN:
                default:
                    this.totalObjectCounts.numFiles++;
            }
        }

        this.forceTransfers = new FormControl<boolean>(data.forceTransfers === null);
        this.jobName = new FormControl<string>(data.jobName || '', Validators.required);

        this.loadNotificationDestinations();
    }

    /**
     * Load the configured webhook destinations so the "Notify me" selector can offer them.
     * Failures are non-fatal: the selector simply stays empty.
     */
    private loadNotificationDestinations() {
        this.fmeClientService.getConfiguration().subscribe({
            next: (config) => {
                this.notificationDestinations = config.notifications?.destinations ?? [];
                // Pre-select the default destination, if any, for convenience.
                const defaultDest = this.notificationDestinations.find((d) => d.isDefault);
                if (defaultDest) {
                    this.notifyDestination.setValue(defaultDest.name);
                } else if (this.notificationDestinations.length) {
                    this.notifyDestination.setValue(this.notificationDestinations[0].name);
                }
            },
            error: () => {
                this.notificationDestinations = [];
            },
        });
    }

    /** Destination name to report, or undefined when notifications are off / none chosen. */
    private resolveNotifyDestination(): string | undefined {
        if (!this.notifyEnabled.value) {
            return undefined;
        }
        return this.notifyDestination.value || undefined;
    }

    cancel() {
        return () => {
            this.transferSettingsResult.emit({
                performTransfer: false,
                forceTransfers: this.forceTransfers.value,
                jobName: this.jobName.value,
            });
            this.dialogRef.close();
        };
    }

    transfer() {
        return () => {
            this.transferSettingsResult.emit({
                performTransfer: true,
                jobName: this.jobName.value,
                forceTransfers: this.forceTransfers.value,
                notifyDestination: this.resolveNotifyDestination(),
            });
            this.dialogRef.close();
        };
    }
}
