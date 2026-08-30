import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OidcAuthStatusComponent } from './oidc-auth-status.component';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { of } from 'rxjs';
import { ComponentRef } from '@angular/core';

describe('OidcAuthStatusComponent', () => {
    let component: OidcAuthStatusComponent;
    let componentRef: ComponentRef<OidcAuthStatusComponent>;
    let fixture: ComponentFixture<OidcAuthStatusComponent>;
    let mockFmeClient: {
        getOIDCStatus: ReturnType<typeof vi.fn>;
        logoutOIDC: ReturnType<typeof vi.fn>;
    };

    beforeEach(async () => {
        mockFmeClient = {
            getOIDCStatus: vi.fn().mockReturnValue(of({ authenticated: false })),
            logoutOIDC: vi.fn().mockReturnValue(of({})),
        };

        await TestBed.configureTestingModule({
            imports: [
                OidcAuthStatusComponent,
            ],
            providers: [
                { provide: FmeClientService, useValue: mockFmeClient },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(OidcAuthStatusComponent);
        component = fixture.componentInstance;
        componentRef = fixture.componentRef;
        componentRef.setInput('profileName', 'test-profile');
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should capture the identity from an authenticated status', () => {
        mockFmeClient.getOIDCStatus.mockReturnValue(of({
            authenticated: true,
            identity: 'alice@example.com',
            expiresAt: BigInt(0),
            error: '',
        }));

        component.ngOnInit();

        expect(mockFmeClient.getOIDCStatus).toHaveBeenCalledWith('test-profile');
        expect(component.identity).toBe('alice@example.com');
    });

    it('should include the identity in the sign-out tooltip when known', () => {
        expect(component.signOutTooltip).toBe('Sign out');
        component.identity = 'alice@example.com';
        expect(component.signOutTooltip).toBe('Sign out (alice@example.com)');
    });

    it('should call logoutOIDC and emit authenticated=false on sign out', () => {
        const emitted: boolean[] = [];
        component.authenticated.subscribe((val: boolean) => emitted.push(val));

        // signOut() returns the click handler (fme-button onClick contract); invoke it.
        component.signOut()();

        expect(mockFmeClient.logoutOIDC).toHaveBeenCalledWith('test-profile');
        expect(emitted).toContain(false);
    });

    it('should render a sign-out icon button', () => {
        const btn = fixture.nativeElement.querySelector('fme-button');
        expect(btn).toBeTruthy();
    });
});
