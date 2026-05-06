import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransferProfileEditorModalComponent } from './transfer-profile-editor-modal.component';
import { AppState } from '@app/state';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { StoreModule } from '@ngrx/store';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { provideMockStore } from '@ngrx/store/testing';
import { initialTestState } from '@state/test.state';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatBadgeModule } from '@angular/material/badge';
import { FmeClientService } from '@services/fme-client/fme-client.service';

describe('TransferProfileEditorModalComponent', () => {
    let component: TransferProfileEditorModalComponent;
    let fixture: ComponentFixture<TransferProfileEditorModalComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                MatDialogModule,
                ReactiveFormsModule,
                MatInputModule,
                MatSelectModule,
                MatFormFieldModule,
                MatSlideToggleModule,
                MatTooltipModule,
                MatChipsModule,
                NoopAnimationsModule,
                MatSnackBarModule,
                StoreModule,
                MatExpansionModule,
                MatAutocompleteModule,
                MatBadgeModule,
            ],
            providers: [
                MatDialog,
                {
                    provide: MAT_DIALOG_DATA,
                    useValue: {},
                },
                {
                    provide: MatDialogRef,
                    useValue: {},
                },
                MatBottomSheet,
                FmeClientService,
                provideMockStore<AppState>({initialState: initialTestState}),
            ],
        })
            .compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(TransferProfileEditorModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
