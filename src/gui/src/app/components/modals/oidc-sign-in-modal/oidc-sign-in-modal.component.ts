import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import {
    MAT_DIALOG_DATA,
    MatDialogActions,
    MatDialogContent,
    MatDialogRef,
    MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { ButtonComponent } from '@app/components/primitives/buttons/button/button.component';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { WailsService } from '@services/wails/wails.service';
import { Subscription, timer } from 'rxjs';
import { OidcSignInModalData, OidcSignInModalResult } from './oidc-sign-in-modal.interfaces';

/**
 * Modal that drives the OIDC sign-in flow: it starts the login, opens the system
 * browser for the identity provider, and polls for completion — showing a clear
 * "waiting" state with Cancel, or an error with Try again / Edit configuration.
 * Closes with 'authenticated' on success, 'edit' to open config, or null on cancel.
 */
@Component({
    selector: 'fme-oidc-sign-in-modal',
    templateUrl: './oidc-sign-in-modal.component.html',
    styleUrls: ['./oidc-sign-in-modal.component.scss'],
    imports: [
        MatDialogTitle,
        MatDialogContent,
        MatDialogActions,
        ButtonComponent,
        MatIcon,
        MatProgressSpinner,
    ],
})
export class OidcSignInModalComponent implements OnInit, OnDestroy {
    data = inject<OidcSignInModalData>(MAT_DIALOG_DATA);
    private dialogRef = inject<MatDialogRef<OidcSignInModalComponent, OidcSignInModalResult>>(MatDialogRef);
    private fmeClient = inject(FmeClientService);
    private wails = inject(WailsService);

    pending = false;
    error = '';
    private pollSubscription: Subscription | null = null;
    private startTime = 0;

    ngOnInit() {
        this.beginSignIn();
    }

    ngOnDestroy() {
        this.stopPolling();
    }

    /**
     * Kicks off (or retries) the OIDC login: request the authorization URL, open it in
     * the system browser, then poll for the daemon to report an authenticated session.
     */
    beginSignIn() {
        this.error = '';
        this.pending = true;
        this.fmeClient.initiateOIDCLogin(this.data.profileName).subscribe({
            next: (res) => {
                if (res.authorizationUrl) {
                    this.openAuthUrl(res.authorizationUrl);
                    this.startPolling();
                } else {
                    this.pending = false;
                    this.error = 'Could not start sign-in. Please try again.';
                }
            },
            error: (err) => {
                this.pending = false;
                this.error = err?.message || 'Could not start sign-in. Please try again.';
            },
        });
    }

    cancel() {
        return () => {
            this.stopPolling();
            this.dialogRef.close(null);
        };
    }

    tryAgain() {
        return () => {
            this.beginSignIn();
        };
    }

    editConfiguration() {
        return () => {
            this.stopPolling();
            this.dialogRef.close('edit');
        };
    }

    private openAuthUrl(url: string) {
        this.wails.externalLink(url).subscribe({
            error: () => window.open(url, '_blank'),
        });
    }

    private startPolling() {
        this.stopPolling();
        this.startTime = Date.now();
        const maxDuration = 5 * 60 * 1000;
        let interval = 2000;

        const nextInterval = (): number => {
            if (Date.now() - this.startTime < 10000) {
                return 2000;
            }
            interval = Math.min(interval * 2, 16000);
            return interval;
        };

        const poll = () => {
            if (Date.now() - this.startTime > maxDuration) {
                this.pending = false;
                this.error = 'Sign-in timed out after 5 minutes. Please try again.';
                return;
            }
            this.fmeClient.getOIDCStatus(this.data.profileName).subscribe({
                next: (res) => {
                    if (res.error) {
                        this.pending = false;
                        this.error = res.error;
                        return;
                    }
                    if (res.authenticated) {
                        this.pending = false;
                        this.dialogRef.close('authenticated');
                        return;
                    }
                    this.pollSubscription = timer(nextInterval()).subscribe(() => poll());
                },
                error: () => {
                    this.pollSubscription = timer(nextInterval()).subscribe(() => poll());
                },
            });
        };

        this.pollSubscription = timer(2000).subscribe(() => poll());
    }

    private stopPolling() {
        if (this.pollSubscription) {
            this.pollSubscription.unsubscribe();
            this.pollSubscription = null;
        }
    }
}
