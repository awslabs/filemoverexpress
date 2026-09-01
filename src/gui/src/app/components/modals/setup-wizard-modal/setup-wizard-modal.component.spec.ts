import { describe, it, expect, beforeEach, vi } from 'vitest';
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
    let dialogRefClose: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        dialogRefClose = vi.fn();
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
                    useValue: {close: dialogRefClose},
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

    describe('transfer profile step transitions', () => {
        it('marks the profile step skipped and clears validity on skip', () => {
            component.onTransferProfileSkip();
            expect(component.wizardStepStates.transferProfile.skipped).toBe(true);
            expect(component.wizardStepStates.transferProfile.validSetup).toBe(false);
            expect(component.wizardStepStates.transferProfile.edited).toBe(false);
        });

        it('marks the profile step submitted and stores the profile on submit', () => {
            component.transferProfileForm.get('name')?.setValue('my-profile');
            component.onTransferProfileSubmit();
            expect(component.wizardStepStates.transferProfile.validSetup).toBe(true);
            expect(component.wizardStepStates.transferProfile.edited).toBe(true);
            expect(component.setupWizardResult.transferProfiles['my-profile']).toBeDefined();
        });

        it('resets skipToEnd on welcome next', () => {
            component.onWelcomeNext();
            expect(component.skipToEnd).toBe(false);
        });
    });

    describe('doneText', () => {
        it('reports a skipped tutorial', () => {
            component.onTransferProfileSkip();
            expect(component.doneText()).toContain('skipped');
        });

        it('reports a completed valid setup', () => {
            component.wizardStepStates.transferProfile.skipped = false;
            component.wizardStepStates.transferProfile.validSetup = true;
            expect(component.doneText()).toContain('set up a Remote Configuration');
        });

        it('reports completion without a valid configuration', () => {
            component.wizardStepStates.transferProfile.skipped = false;
            component.wizardStepStates.transferProfile.validSetup = false;
            expect(component.doneText()).toContain('valid Remote Configuration');
        });
    });

    describe('completeSetup', () => {
        it('closes the dialog with checkSetup reflecting the stop-showing toggle', () => {
            component.stopShowingWizard = true;
            component.completeSetup();
            expect(dialogRefClose).toHaveBeenCalledWith(expect.objectContaining({checkSetup: false}));
        });
    });

    describe('updateTransferProfileForm', () => {
        it('swaps in a new form group', () => {
            const newForm = component.transferProfileForm;
            component.updateTransferProfileForm(newForm);
            expect(component.transferProfileForm).toBe(newForm);
        });
    });
});
