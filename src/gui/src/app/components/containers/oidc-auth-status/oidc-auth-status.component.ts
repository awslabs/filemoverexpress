import { Component, inject, input, OnDestroy, OnInit, output } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { WailsService } from '@services/wails/wails.service';
import { Subscription, timer } from 'rxjs';
import { MatTooltip } from '@angular/material/tooltip';

export interface OIDCAuthState {
    authenticated: boolean;
    identity: string;
    expiresAt: number;
    error: string;
    pending: boolean;
}

@Component({
    selector: 'fme-oidc-auth-status',
    templateUrl: './oidc-auth-status.component.html',
    styleUrls: ['./oidc-auth-status.component.scss'],
    imports: [
        MatButton,
        MatIcon,
        MatProgressSpinner,
        MatIconButton,
        MatTooltip,
    ],
})
export class OidcAuthStatusComponent implements OnInit, OnDestroy {
    private fmeClient = inject(FmeClientService);
    private wails = inject(WailsService);

    profileName = input.required<string>();
    authenticated = output<boolean>();

    state: OIDCAuthState = {
        authenticated: false,
        identity: '',
        expiresAt: 0,
        error: '',
        pending: false,
    };

    showDetails = false;
    private pollSubscription: Subscription | null = null;

    ngOnInit() {
        this.fetchCurrentStatus();
    }

    ngOnDestroy() {
        this.stopPolling();
    }

    private fetchCurrentStatus() {
        this.fmeClient.getOIDCStatus(this.profileName()).subscribe({
            next: (res) => {
                if (res.authenticated) {
                    this.state = {
                        authenticated: true,
                        identity: res.identity,
                        expiresAt: Number(res.expiresAt),
                        error: '',
                        pending: false,
                    };
                } else if (res.error) {
                    this.state = { ...this.state, error: res.error };
                }
            },
        });
    }

    signIn() {
        this.state = { ...this.state, pending: true, error: '' };

        this.fmeClient.initiateOIDCLogin(this.profileName()).subscribe({
            next: (res) => {
                if (res.authorizationUrl) {
                    this.openAuthUrl(res.authorizationUrl);
                    this.startPolling();
                }
            },
            error: (err) => {
                this.state = { ...this.state, pending: false, error: err.message || 'Login initiation failed' };
            },
        });
    }

    signOut() {
        this.fmeClient.logoutOIDC(this.profileName()).subscribe({
            next: () => {
                this.state = {
                    authenticated: false,
                    identity: '',
                    expiresAt: 0,
                    error: '',
                    pending: false,
                };
                this.authenticated.emit(false);
            },
            error: (err) => {
                this.state = { ...this.state, error: err.message || 'Logout failed' };
            },
        });
    }

    retry() {
        this.state = { ...this.state, error: '' };
        this.signIn();
    }

    cancel() {
        this.stopPolling();
        this.state = { ...this.state, pending: false, error: '' };
    }

    private openAuthUrl(url: string) {
        this.wails.externalLink(url).subscribe({
            error: () => window.open(url, '_blank'),
        });
    }

    get isExpiringSoon(): boolean {
        if (!this.state.authenticated || !this.state.expiresAt) {
            return false;
        }
        const tenMinutes = 10 * 60;
        return (this.state.expiresAt - Math.floor(Date.now() / 1000)) < tenMinutes;
    }

    get isExpired(): boolean {
        if (!this.state.authenticated || !this.state.expiresAt) {
            return false;
        }
        return this.state.expiresAt < Math.floor(Date.now() / 1000);
    }

    get timeRemainingShort(): string {
        if (!this.state.expiresAt) {
            return '';
        }
        const secondsLeft = this.state.expiresAt - Math.floor(Date.now() / 1000);
        if (secondsLeft <= 0) {
            return '';
        }
        if (secondsLeft < 60) {
            return `${secondsLeft}s`;
        }
        if (secondsLeft < 3600) {
            return `${Math.floor(secondsLeft / 60)}m`;
        }
        const hours = Math.floor(secondsLeft / 3600);
        const minutes = Math.floor((secondsLeft % 3600) / 60);
        if (minutes === 0) {
            return `${hours}h`;
        }
        return `${hours}h ${minutes}m`;
    }

    get timeRemaining(): string {
        if (!this.state.expiresAt) {
            return '';
        }
        const secondsLeft = this.state.expiresAt - Math.floor(Date.now() / 1000);
        if (secondsLeft <= 0) {
            return '';
        }
        if (secondsLeft < 300) {
            const minutes = Math.floor(secondsLeft / 60);
            const seconds = secondsLeft % 60;
            if (minutes === 0) {
                return `${seconds}s`;
            }
            return `${minutes}m ${seconds}s`;
        }
        if (secondsLeft < 3600) {
            const minutes = Math.floor(secondsLeft / 60);
            return `${minutes} minutes`;
        }
        const hours = Math.floor(secondsLeft / 3600);
        const remainingMinutes = Math.floor((secondsLeft % 3600) / 60);
        if (hours === 1 && remainingMinutes === 0) {
            return 'one hour';
        }
        if (remainingMinutes === 0) {
            return `${hours} hours`;
        }
        return `${hours}h ${remainingMinutes}m`;
    }

    get expirationTimestamp(): string {
        if (!this.state.expiresAt) {
            return '';
        }
        return new Date(this.state.expiresAt * 1000).toLocaleString();
    }

    private startPolling() {
        this.stopPolling();

        const startTime = Date.now();
        const maxDuration = 5 * 60 * 1000; // 5 minutes
        let interval = 2000; // Start at 2s

        const getNextInterval = (): number => {
            const elapsed = Date.now() - startTime;
            if (elapsed < 10000) {
                return 2000; // 2s for first 10 seconds
            }
            // Double the interval, max 16s
            interval = Math.min(interval * 2, 16000);
            return interval;
        };

        const poll = () => {
            if (Date.now() - startTime > maxDuration) {
                this.state = { ...this.state, pending: false, error: 'Login timed out (5 minutes). Please try again.' };
                return;
            }

            this.fmeClient.getOIDCStatus(this.profileName()).subscribe({
                next: (res) => {
                    if (res.error) {
                        this.state = {
                            authenticated: false,
                            identity: '',
                            expiresAt: 0,
                            error: res.error,
                            pending: false,
                        };
                        return;
                    }

                    if (res.authenticated) {
                        this.state = {
                            authenticated: true,
                            identity: res.identity,
                            expiresAt: Number(res.expiresAt),
                            error: '',
                            pending: false,
                        };
                        this.authenticated.emit(true);
                        return;
                    }

                    // Still pending — schedule next poll with backoff
                    const nextInterval = getNextInterval();
                    this.pollSubscription = timer(nextInterval).subscribe(() => poll());
                },
                error: () => {
                    // Network error during poll — retry after backoff
                    const nextInterval = getNextInterval();
                    this.pollSubscription = timer(nextInterval).subscribe(() => poll());
                },
            });
        };

        // Start first poll after initial 2s delay
        this.pollSubscription = timer(2000).subscribe(() => poll());
    }

    private stopPolling() {
        if (this.pollSubscription) {
            this.pollSubscription.unsubscribe();
            this.pollSubscription = null;
        }
    }
}
