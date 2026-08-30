import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SetupWizardModalComponent } from './setup-wizard-modal.component';
import { AppState } from '@app/state';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { StoreModule } from '@ngrx/store';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatStepperModule } from '@angular/material/stepper';
import { MatIconModule } from '@angular/material/icon';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { provideMockStore } from '@ngrx/store/testing';
import { initialTestState } from '@state/test.state';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { FmeClientService } from '@services/fme-client/fme-client.service';

describe('SetupWizardModalComponent', () => {
    let component: SetupWizardModalComponent;
    let fixture: ComponentFixture<SetupWizardModalComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                MatDialogModule,
                FormsModule,
                ReactiveFormsModule,
                MatInputModule,
                MatSelectModule,
                MatFormFieldModule,
                MatSlideToggleModule,
                MatTooltipModule,
                MatChipsModule,
                MatCheckboxModule,
                MatSnackBarModule,
                StoreModule,
                MatExpansionModule,
                MatStepperModule,
                MatIconModule,
                MatAutocompleteModule,
            ],
            providers: [
                MatDialog,
                {
                    provide: MAT_DIALOG_DATA,
                    useValue: {
                        initialData: {
                            transferProfiles: {},
                        },
                    },
                },
                {
                    provide: MatDialogRef,
                    useValue: {},
                },
                MatBottomSheet,
                FmeClientService,
                provideMockStore<AppState>({initialState: initialTestState}),
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(SetupWizardModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
