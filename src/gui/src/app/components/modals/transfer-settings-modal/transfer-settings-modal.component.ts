import { CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { NgTemplateOutlet, TitleCasePipe } from '@angular/common';
import { Component, EventEmitter, inject, Output } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatHint, MatInput, MatLabel } from '@angular/material/input';
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

@Component({
    selector: 'fme-transfer-settings-modal',
    templateUrl: './transfer-settings-modal.component.html',
    styleUrls: ['./transfer-settings-modal.component.scss'],
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
        MatDialogActions,
        ButtonComponent,
        EnterSubmitDirective,
    ],
})
export class TransferSettingsModalComponent {
    data = inject<TransferSettingsModalData>(MAT_DIALOG_DATA);
    dialogRef = inject<MatDialogRef<TransferSettingsModalComponent>>(MatDialogRef);

    @Output() transferSettingsResult = new EventEmitter<TransferSettingsModalResult>();
    forceTransfers: FormControl;
    jobName: FormControl;
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
            });
            this.dialogRef.close();
        };
    }
}
