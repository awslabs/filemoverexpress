import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OidcAuthStatusComponent } from './oidc-auth-status.component';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { WailsService } from '@services/wails/wails.service';
import { of, throwError } from 'rxjs';
import { ComponentRef } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('OidcAuthStatusComponent', () => {
    let component: OidcAuthStatusComponent;
    let componentRef: ComponentRef<OidcAuthStatusComponent>;
    let fixture: ComponentFixture<OidcAuthStatusComponent>;
    let mockFmeClient: {
        initiateOIDCLogin: ReturnType<typeof vi.fn>;
        getOIDCStatus: ReturnType<typeof vi.fn>;
        logoutOIDC: ReturnType<typeof vi.fn>;
    };
    let mockWails: {
        externalLink: ReturnType<typeof vi.fn>;
    };

    beforeEach(async () => {
        mockFmeClient = {
            initiateOIDCLogin: vi.fn(),
            getOIDCStatus: vi.fn(),
            logoutOIDC: vi.fn(),
        };
        mockWails = {
            externalLink: vi.fn().mockReturnValue(of(undefined)),
        };

        await TestBed.configureTestingModule({
            imports: [
                OidcAuthStatusComponent, NoopAnimationsModule,
            ],
            providers: [
                { provide: FmeClientService, useValue: mockFmeClient }, { provide: WailsService, useValue: mockWails },
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

    it('should start in unauthenticated state', () => {
        expect(component.state.authenticated).toBe(false);
        expect(component.state.pending).toBe(false);
        expect(component.state.error).toBe('');
    });

    it('should call initiateOIDCLogin and open browser on sign in', () => {
        mockFmeClient.initiateOIDCLogin.mockReturnValue(
            of({ authorizationUrl: 'https://auth.example.com/login' }),
        );
        mockFmeClient.getOIDCStatus.mockReturnValue(
            of({ authenticated: false, identity: '', expiresAt: BigInt(0), error: '' }),
        );

        component.signIn();

        expect(mockFmeClient.initiateOIDCLogin).toHaveBeenCalledWith('test-profile');
        expect(mockWails.externalLink).toHaveBeenCalledWith('https://auth.example.com/login');
        expect(component.state.pending).toBe(true);
    });

    it('should set error state when login initiation fails', () => {
        mockFmeClient.initiateOIDCLogin.mockReturnValue(
            throwError(() => new Error('Connection refused')),
        );

        component.signIn();

        expect(component.state.pending).toBe(false);
        expect(component.state.error).toBe('Connection refused');
    });

    it('should call logoutOIDC and reset state on sign out', () => {
        mockFmeClient.logoutOIDC.mockReturnValue(of({}));

        component.state = {
            authenticated: true,
            identity: 'alice@example.com',
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            error: '',
            pending: false,
        };

        component.signOut();

        expect(mockFmeClient.logoutOIDC).toHaveBeenCalledWith('test-profile');
        expect(component.state.authenticated).toBe(false);
        expect(component.state.identity).toBe('');
    });

    it('should stop polling when status returns authenticated', () => {
        mockFmeClient.initiateOIDCLogin.mockReturnValue(
            of({ authorizationUrl: 'https://auth.example.com/login' }),
        );
        const statusResponse = {
            authenticated: true,
            identity: 'alice@example.com',
            expiresAt: BigInt(Math.floor(Date.now() / 1000) + 3600),
            error: '',
        };
        mockFmeClient.getOIDCStatus.mockReturnValue(of(statusResponse));

        component.signIn();

        // After signIn, polling is started (pending state)
        expect(component.state.pending).toBe(true);
        // The getOIDCStatus mock is configured to return authenticated=true,
        // which the polling timer will pick up after 2s delay
        expect(mockFmeClient.initiateOIDCLogin).toHaveBeenCalledWith('test-profile');
    });

    it('should stop polling when status returns error', () => {
        mockFmeClient.initiateOIDCLogin.mockReturnValue(
            of({ authorizationUrl: 'https://auth.example.com/login' }),
        );
        const statusResponse = {
            authenticated: false,
            identity: '',
            expiresAt: BigInt(0),
            error: 'Authentication denied: user cancelled',
        };
        mockFmeClient.getOIDCStatus.mockReturnValue(of(statusResponse));

        component.signIn();

        // After signIn, component is in pending state waiting for poll
        expect(component.state.pending).toBe(true);
        // The getOIDCStatus mock is configured to return an error,
        // which the polling timer will pick up after 2s delay
        expect(mockFmeClient.initiateOIDCLogin).toHaveBeenCalledWith('test-profile');
    });

    it('should call signIn again on retry', () => {
        mockFmeClient.initiateOIDCLogin.mockReturnValue(
            of({ authorizationUrl: 'https://auth.example.com/login' }),
        );
        mockFmeClient.getOIDCStatus.mockReturnValue(
            of({ authenticated: false, identity: '', expiresAt: BigInt(0), error: '' }),
        );

        component.state = { ...component.state, error: 'previous error' };
        component.retry();

        expect(component.state.error).toBe('');
        expect(mockFmeClient.initiateOIDCLogin).toHaveBeenCalledWith('test-profile');
    });

    it('should detect expiring soon credentials', () => {
        component.state = {
            authenticated: true,
            identity: 'alice@example.com',
            expiresAt: Math.floor(Date.now() / 1000) + 300, // 5 min from now
            error: '',
            pending: false,
        };

        expect(component.isExpiringSoon).toBe(true);
        expect(component.isExpired).toBe(false);
    });

    it('should detect expired credentials', () => {
        component.state = {
            authenticated: true,
            identity: 'alice@example.com',
            expiresAt: Math.floor(Date.now() / 1000) - 60, // 1 min ago
            error: '',
            pending: false,
        };

        expect(component.isExpired).toBe(true);
    });

    it('should not flag expiry when not authenticated', () => {
        component.state = {
            authenticated: false,
            identity: '',
            expiresAt: 0,
            error: '',
            pending: false,
        };

        expect(component.isExpiringSoon).toBe(false);
        expect(component.isExpired).toBe(false);
    });
});
