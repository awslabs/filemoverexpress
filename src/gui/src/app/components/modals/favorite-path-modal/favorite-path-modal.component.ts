import { Component, EventEmitter, inject, Output } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatError, MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { FavoritePathModalData } from '@app/components/modals/favorite-path-modal/favorite-path-modal.interfaces';
import { ButtonComponent } from '@primitives/buttons/button/button.component';
import { Bookmark } from '@services/bookmarks/bookmarks.classes';
import { favoritePathExistsValidator } from '@app/classes/form-validators';
import { favoritePathFormMessages } from '@app/constants/common.constants';

@Component({
    selector: 'fme-favorite-path-modal',
    templateUrl: './favorite-path-modal.component.html',
    styleUrls: ['./favorite-path-modal.component.scss'],
    imports: [
        MatDialogTitle,
        MatDialogContent,
        ReactiveFormsModule,
        MatFormField,
        MatLabel,
        MatInput,
        MatError,
        MatDialogActions,
        ButtonComponent,
    ],
})
export class FavoritePathModalComponent {
    data = inject<FavoritePathModalData>(MAT_DIALOG_DATA);
    dialogRef = inject<MatDialogRef<FavoritePathModalComponent>>(MatDialogRef);

    @Output() favoritePathSaved = new EventEmitter<string>();
    favoritePathForm: FormGroup;
    bookmark: Bookmark;
    protected readonly favoritePathFormMessages = favoritePathFormMessages;

    constructor() {
        const data = this.data;

        this.bookmark = data.bookmark;
        const favoritePathValue = data.prefilledFavoritePath ? data.prefilledFavoritePath : '';
        const existingFavoritePaths = data.bookmark ? data.bookmark.favoritePaths : [];

        this.favoritePathForm = new FormGroup({
            favoritePath: new FormControl<string>(favoritePathValue, [
                Validators.required, favoritePathExistsValidator(existingFavoritePaths),
            ]),
        });
    }

    /**
     * Close the modal
     */
    cancel() {
        return () => {
            this.dialogRef.close();
        };
    }

    /**
     * Emit the favorite path form field value string and close the modal
     */
    save() {
        return () => {
            this.favoritePathSaved.emit(this.favoritePathForm.get('favoritePath')?.value);
            this.dialogRef.close();
        };
    }
}
