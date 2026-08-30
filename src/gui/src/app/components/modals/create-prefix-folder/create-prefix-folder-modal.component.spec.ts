import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { provideMockStore } from '@ngrx/store/testing';
import { AppState } from '@app/state';
import { initialTestState } from '@state/test.state';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CreatePrefixFolderModalComponent } from '@modals/create-prefix-folder/create-prefix-folder-modal.component';
import { CreatePrefixFolderType } from '@modals/create-prefix-folder/create-prefix-folder-modal.interfaces';

describe('CreatePrefixFolderComponent', () => {
    let component: CreatePrefixFolderModalComponent;
    let fixture: ComponentFixture<CreatePrefixFolderModalComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                ReactiveFormsModule,
                MatSnackBarModule,
                MatDialogModule,
                ReactiveFormsModule,
                MatFormFieldModule,
                MatInputModule,
                MatBadgeModule,
                MatTooltipModule,
            ],
            providers: [
                provideMockStore<AppState>({initialState: initialTestState}),
                {
                    provide: MAT_DIALOG_DATA,
                    useValue: {
                        type: CreatePrefixFolderType.Local,
                        parent: '/tmp/',
                    },
                },
                {
                    provide: MatDialogRef,
                    useValue: {},
                },
            ],
        });
        fixture = TestBed.createComponent(CreatePrefixFolderModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
