import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OidcSignInModalComponent } from './oidc-sign-in-modal.component';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { WailsService } from '@services/wails/wails.service';
import { of, Subject, throwError } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { OidcSignInModalData } from './oidc-sign-in-modal.interfaces';

describe('OidcSignInModalComponent', () => {
    let component: OidcSignInModalComponent;
    let fixture: ComponentFixture<OidcSignInModalComponent>;
    let mockFmeClient: {
        initiateOIDCLogin: ReturnType<typeof vi.fn>;
        getOIDCStatus: ReturnType<typeof vi.fn>;
    };
    let mockWails: {
        externalLink: ReturnType<typeof vi.fn>;
    };
    let mockDialogRef: {
        close: ReturnType<typeof vi.fn>;
    };

    const dialogData: OidcSignInModalData = { profileName: 'test-oidc-profile' };

    beforeEach(async () => {
        mockFmeClient = {
            initiateOIDCLogin: vi.fn().mockReturnValue(of({ authorizationUrl: 'https://idp.example.com/auth?code=abc' })),
            getOIDCStatus: vi.fn().mockReturnValue(of({ authenticated: false, error: '' })),
        };
        mockWails = {
            externalLink: vi.fn().mockReturnValue(of(undefined)),
        };
        mockDialogRef = {
            close: vi.fn(),
        };

        await TestBed.configureTestingModule({
            imports: [OidcSignInModalComponent, NoopAnimationsModule],
            providers: [
                { provide: MAT_DIALOG_DATA, useValue: dialogData },
                { provide: MatDialogRef, useValue: mockDialogRef },
                { provide: FmeClientService, useValue: mockFmeClient },
                { provide: WailsService, useValue: mockWails },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(OidcSignInModalComponent);
        component = fixture.componentInstance;
    });

    afterEach(() => {
        // Ensure component is destroyed to trigger cleanup
        fixture.destroy();
    });

    it('should create', () => {
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    describe('beginSignIn', () => {
        it('should call initiateOIDCLogin with the profile name', () => {
            fixture.detectChanges();
            expect(mockFmeClient.initiateOIDCLogin).toHaveBeenCalledWith('test-oidc-profile');
        });

        it('should set pending to true on start', () => {
            // Don't trigger ngOnInit yet — call manually
            component.beginSignIn();
            expect(component.pending).toBe(true);
        });

        it('should open the auth URL via WailsService on success', () => {
            fixture.detectChanges();
            expect(mockWails.externalLink).toHaveBeenCalledWith('https://idp.example.com/auth?code=abc');
        });

        it('should set error when authorizationUrl is empty', () => {
            mockFmeClient.initiateOIDCLogin.mockReturnValue(of({ authorizationUrl: '' }));
            fixture.detectChanges();
            expect(component.pending).toBe(false);
            expect(component.error).toContain('Could not start sign-in');
        });

        it('should set error when initiateOIDCLogin fails', () => {
            mockFmeClient.initiateOIDCLogin.mockReturnValue(throwError(() => new Error('Network failure')));
            fixture.detectChanges();
            expect(component.pending).toBe(false);
            expect(component.error).toBe('Network failure');
        });

        it('should set a generic error message when the error has no message', () => {
            mockFmeClient.initiateOIDCLogin.mockReturnValue(throwError(() => ({})));
            fixture.detectChanges();
            expect(component.error).toContain('Could not start sign-in');
        });
    });

    describe('polling', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should close the dialog with "authenticated" when status reports authenticated', async () => {
            mockFmeClient.getOIDCStatus.mockReturnValue(of({ authenticated: true, error: '' }));
            fixture.detectChanges();

            // Initial poll delay is 2000ms
            await vi.advanceTimersByTimeAsync(2000);

            expect(mockDialogRef.close).toHaveBeenCalledWith('authenticated');
            expect(component.pending).toBe(false);
        });

        it('should set error when status reports an error', async () => {
            mockFmeClient.getOIDCStatus.mockReturnValue(of({
                authenticated: false,
                error: 'Authentication denied: User denied consent',
            }));
            fixture.detectChanges();

            await vi.advanceTimersByTimeAsync(2000);

            expect(component.pending).toBe(false);
            expect(component.error).toBe('Authentication denied: User denied consent');
            expect(mockDialogRef.close).not.toHaveBeenCalled();
        });

        it('should continue polling when status is not yet authenticated', async () => {
            let callCount = 0;
            mockFmeClient.getOIDCStatus.mockImplementation(() => {
                callCount++;
                if (callCount >= 3) {
                    return of({ authenticated: true, error: '' });
                }
                return of({ authenticated: false, error: '' });
            });
            fixture.detectChanges();

            // First poll at 2000ms
            await vi.advanceTimersByTimeAsync(2000);
            expect(callCount).toBe(1);

            // Second poll (within 10s window, so interval is still 2000ms)
            await vi.advanceTimersByTimeAsync(2000);
            expect(callCount).toBe(2);

            // Third poll
            await vi.advanceTimersByTimeAsync(2000);
            expect(callCount).toBe(3);
            expect(mockDialogRef.close).toHaveBeenCalledWith('authenticated');
        });

        it('should time out after 5 minutes', async () => {
            mockFmeClient.getOIDCStatus.mockReturnValue(of({ authenticated: false, error: '' }));
            fixture.detectChanges();

            // vi.useFakeTimers also fakes Date.now, so advanceTimersByTime moves both
            // the timer queue and the clock forward. Advance past the 5-minute max duration
            // plus a buffer to trigger the timeout check at the start of the next poll().
            await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 20000);

            expect(component.pending).toBe(false);
            expect(component.error).toContain('timed out');
        });

        it('should retry polling on network errors', async () => {
            let callCount = 0;
            mockFmeClient.getOIDCStatus.mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    return throwError(() => new Error('Network error'));
                }
                return of({ authenticated: true, error: '' });
            });
            fixture.detectChanges();

            // First poll — network error
            await vi.advanceTimersByTimeAsync(2000);
            expect(callCount).toBe(1);
            expect(component.error).toBe(''); // no user-visible error on transient failure

            // Retry poll (still within 10s window, so 2000ms)
            await vi.advanceTimersByTimeAsync(2000);
            expect(callCount).toBe(2);
            expect(mockDialogRef.close).toHaveBeenCalledWith('authenticated');
        });
    });

    describe('cancel', () => {
        it('should close the dialog with null', () => {
            fixture.detectChanges();
            component.cancel()();
            expect(mockDialogRef.close).toHaveBeenCalledWith(null);
        });
    });

    describe('tryAgain', () => {
        it('should restart the sign-in flow', () => {
            mockFmeClient.initiateOIDCLogin.mockReturnValue(of({ authorizationUrl: '' }));
            fixture.detectChanges();
            expect(component.error).toContain('Could not start sign-in');

            // Now mock a successful response for retry
            mockFmeClient.initiateOIDCLogin.mockReturnValue(of({ authorizationUrl: 'https://idp.example.com/retry' }));
            component.tryAgain()();

            expect(component.error).toBe('');
            expect(component.pending).toBe(true);
            expect(mockFmeClient.initiateOIDCLogin).toHaveBeenCalledTimes(2);
        });
    });

    describe('editConfiguration', () => {
        it('should close the dialog with "edit"', () => {
            fixture.detectChanges();
            component.editConfiguration()();
            expect(mockDialogRef.close).toHaveBeenCalledWith('edit');
        });
    });

    describe('destroy$ cleanup', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should not call dialog.close after component is destroyed', async () => {
            mockFmeClient.getOIDCStatus.mockReturnValue(of({ authenticated: true, error: '' }));
            fixture.detectChanges();

            // Destroy before the poll fires
            fixture.destroy();

            await vi.advanceTimersByTimeAsync(2000);

            // The dialog should NOT have been closed because takeUntil(destroy$) cancelled the timer
            expect(mockDialogRef.close).not.toHaveBeenCalled();
        });

        it('should cancel in-flight initiateOIDCLogin on destroy', async () => {
            const loginSubject = new Subject<{ authorizationUrl: string }>();
            mockFmeClient.initiateOIDCLogin.mockReturnValue(loginSubject.asObservable());

            fixture.detectChanges();
            expect(component.pending).toBe(true);

            // Destroy while the login request is still in-flight
            fixture.destroy();

            // Emit after destruction — should be ignored
            loginSubject.next({ authorizationUrl: 'https://idp.example.com/late' });
            loginSubject.complete();

            expect(mockWails.externalLink).not.toHaveBeenCalled();
        });
    });
});
