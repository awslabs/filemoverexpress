import { TitleCasePipe } from '@angular/common';
import { Component, EventEmitter, inject, Output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatError, MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { HintsPanelComponent } from '@app/components/layout/hints-panel/hints-panel.component';
import { bookmarkFormMessages } from '@app/constants/common.constants';
import { DEFAULT_BOOKMARK_NAME } from '@app/services/bookmarks/bookmarks.constants';
import { Bookmark as IBookmark } from '@app/services/bookmarks/bookmarks.interfaces';
import { isElectronApp } from '@app/utils/utils';
import { ButtonComponent } from '@primitives/buttons/button/button.component';
import { DaemonEditorModalData } from './daemon-editor-modal.interfaces';

@Component({
    selector: 'fme-daemon-editor',
    templateUrl: './daemon-editor-modal.component.html',
    styleUrls: ['./daemon-editor-modal.component.scss'],
    imports: [
        MatDialogTitle,
        TitleCasePipe,
        MatDialogContent,
        ReactiveFormsModule,
        MatFormField,
        MatLabel,
        MatInput,
        MatError,
        MatSlideToggle,
        MatIcon,
        MatDialogActions,
        ButtonComponent,
    ],
})
export class DaemonEditorModalComponent {
    data = inject<DaemonEditorModalData>(MAT_DIALOG_DATA);
    dialogRef = inject<MatDialogRef<DaemonEditorModalComponent>>(MatDialogRef);
    private bottomSheet = inject(MatBottomSheet);

    @Output() bookmarkSaved = new EventEmitter<IBookmark>();

    bookmarkForm: FormGroup;
    mode: 'add' | 'edit';
    remote = false;
    bookmarkFormMessages = bookmarkFormMessages;

    constructor() {
        const data = this.data;

        this.mode = data.mode;
        this.remote = data.remote;

        this.bookmarkForm = new FormGroup({
            name: new FormControl<string>('', Validators.required),
            host: new FormControl<string>('', Validators.required),
            port: new FormControl<number>(50006, [
                Validators.required,
                Validators.min(0),
                Validators.max(65535),
            ]),
            encryption: new FormControl<boolean>(false),
            pre_shared_key: new FormControl<string>('', Validators.pattern(/\S/)),
        });

        if (data.bookmark) {
            this.bookmarkForm.patchValue(data.bookmark);
            this.bookmarkForm.controls['name'].disable();
        }

        if (data.bookmark?.name === DEFAULT_BOOKMARK_NAME) {
            this.bookmarkForm.controls['host'].disable();
        } else {
            this.bookmarkForm.controls['encryption'].setValue(true);
            this.bookmarkForm.controls['encryption'].disable();
            this.bookmarkForm.controls['pre_shared_key'].addValidators(Validators.required);
            this.bookmarkForm.controls['pre_shared_key'].updateValueAndValidity();
        }
    }

    cancel() {
        return () => {
            this.dialogRef.close();
        };
    }

    save() {
        return () => {
            this.bookmarkSaved.emit(this.bookmarkForm.getRawValue());
        };
    }

    toggleHint(event: MouseEvent, message: string) {
        event.stopPropagation();
        event.preventDefault();

        this.bottomSheet.open(HintsPanelComponent, {
            data: message,
            panelClass: 'bottom-sheet-hints',
        });
    }

    openExternalLink(event: Event, url: string) {
        event.preventDefault();

        if (isElectronApp()) {
            window.fme?.externalLink(url).then();
        }
    }
}
