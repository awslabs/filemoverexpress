import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransferProfileFormComponent } from './transfer-profile-form.component';
import { AppState } from '@app/state';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { StoreModule } from '@ngrx/store';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { provideMockStore } from '@ngrx/store/testing';
import { initialTestState } from '@state/test.state';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { FmeClientService } from '@services/fme-client/fme-client.service';

describe('TransferProfileFormComponent', () => {
    let component: TransferProfileFormComponent;
    let fixture: ComponentFixture<TransferProfileFormComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                MatExpansionModule,
                MatDialogModule,
                ReactiveFormsModule,
                MatInputModule,
                MatSelectModule,
                MatFormFieldModule,
                MatSlideToggleModule,
                MatTooltipModule,
                MatChipsModule,
                MatSnackBarModule,
                StoreModule,
                MatAutocompleteModule,
            ],
            providers: [
                MatDialog,
                MatBottomSheet,
                FmeClientService,
                provideMockStore<AppState>({initialState: initialTestState}),
            ],
        })
            .compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(TransferProfileFormComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should default auth method to aws-profile', () => {
        const authMethod = component.transferProfileForm.get('authMethod');
        expect(authMethod?.value).toBe('aws-profile');
    });

    it('should not require OIDC fields when auth method is aws-profile', () => {
        const issuerUrl = component.transferProfileForm.get('oidcIssuerUrl');
        const clientId = component.transferProfileForm.get('oidcClientId');
        const roleArn = component.transferProfileForm.get('oidcRoleArn');

        issuerUrl?.setValue('');
        clientId?.setValue('');
        roleArn?.setValue('');

        expect(issuerUrl?.valid).toBe(true);
        expect(clientId?.valid).toBe(true);
        expect(roleArn?.valid).toBe(true);
    });

    it('should require OIDC fields when auth method is oidc', () => {
        const authMethod = component.transferProfileForm.get('authMethod');
        authMethod?.setValue('oidc');

        const issuerUrl = component.transferProfileForm.get('oidcIssuerUrl');
        const clientId = component.transferProfileForm.get('oidcClientId');
        const roleArn = component.transferProfileForm.get('oidcRoleArn');

        issuerUrl?.setValue('');
        clientId?.setValue('');
        roleArn?.setValue('');

        expect(issuerUrl?.hasError('required')).toBe(true);
        expect(clientId?.hasError('required')).toBe(true);
        expect(roleArn?.hasError('required')).toBe(true);
    });

    it('should clear OIDC validation errors when switching back to aws-profile', () => {
        const authMethod = component.transferProfileForm.get('authMethod');
        authMethod?.setValue('oidc');

        const issuerUrl = component.transferProfileForm.get('oidcIssuerUrl');
        issuerUrl?.setValue('');
        expect(issuerUrl?.hasError('required')).toBe(true);

        authMethod?.setValue('aws-profile');
        expect(issuerUrl?.hasError('required')).toBe(false);
        expect(issuerUrl?.valid).toBe(true);
    });

    it('should have default scopes value', () => {
        const scopes = component.transferProfileForm.get('oidcScopes');
        expect(scopes?.value).toBe('openid, email, profile, offline_access');
    });

    it('should have persist session defaulted to false', () => {
        const persist = component.transferProfileForm.get('oidcPersistSession');
        expect(persist?.value).toBe(false);
    });

    it('should have session duration defaulted to 0', () => {
        const duration = component.transferProfileForm.get('oidcSessionDurationSeconds');
        expect(duration?.value).toBe(0);
    });

    it('should show redirect URI hint when auth method is oidc', () => {
        const authMethod = component.transferProfileForm.get('authMethod');
        authMethod?.setValue('oidc');
        fixture.detectChanges();

        const hint = fixture.nativeElement.querySelector('.redirect-uri-hint');
        expect(hint).toBeTruthy();
        expect(hint.textContent).toContain('127.0.0.1:9876/callback');
        expect(hint.textContent).toContain('127.0.0.1:9877/callback');
        expect(hint.textContent).toContain('127.0.0.1:9878/callback');
    });

    it('should not show redirect URI hint when auth method is aws-profile', () => {
        const authMethod = component.transferProfileForm.get('authMethod');
        authMethod?.setValue('aws-profile');
        fixture.detectChanges();

        const hint = fixture.nativeElement.querySelector('.redirect-uri-hint');
        expect(hint).toBeNull();
    });
});
