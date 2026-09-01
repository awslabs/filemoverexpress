import { Component, inject, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
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
import { Store } from '@ngrx/store';
import { addLog } from '@state/logs/actions/logs.actions';
import { Subject, Subscription, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
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
    changeDetection: ChangeDetectionStrategy.Eager,
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
    private store = inject(Store);

    pending = false;
    error = '';
    private pollSubscription: Subscription | null = null;
    private startTime = 0;
    private readonly destroy$ = new Subject<void>();

    ngOnInit() {
        this.beginSignIn();
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
        this.stopPolling();
    }

    /**
     * Kicks off (or retries) the OIDC login: request the authorization URL, open it in
     * the system browser, then poll for the daemon to report an authenticated session.
     */
    beginSignIn() {
        this.error = '';
        this.pending = true;
        this.fmeClient.initiateOIDCLogin(this.data.profileName).pipe(
            takeUntil(this.destroy$),
        ).subscribe({
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
                this.error = this.friendlyError(err?.message);
            },
        });
    }

    cancel() {
        return () => {
            this.stopPolling();
            this.dialogRef.close(null);
        };
    }

    /**
     * Turns a raw sign-in error into something a user can act on. Transport-level
     * artifacts (a dropped connection surfaces as "missing trailer"; an unclassified
     * ConnectError is prefixed "[unknown]") are meaningless to the user, so map them to
     * plain language and strip any leading "[code]" prefix from the rest.
     */
    private friendlyError(raw: string | undefined): string {
        const msg = (raw ?? '').trim();
        // Record the technical detail in the Logs table — the modal only shows a friendly
        // summary, and OIDC/SSO sign-in failures were previously absent from Logs entirely.
        this.store.dispatch(addLog({
            log: {
                level: 'error',
                message: `OIDC sign-in failed for "${this.data.profileName}": ${msg || 'no detail provided'}`,
                timestamp: new Date(),
                jobId: null,
            },
        }));
        if (!msg) {
            return 'Sign-in didn\u2019t complete. Please try again.';
        }
        if (/missing trailer|\[unknown\]|failed to fetch|econn|network error/i.test(msg)) {
            return 'Sign-in didn\u2019t complete \u2014 the connection dropped before it finished. Please try again.';
        }
        return msg.replace(/^\[[^\]]+\]\s*/, '');
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
            this.fmeClient.getOIDCStatus(this.data.profileName).pipe(
                takeUntil(this.destroy$),
            ).subscribe({
                next: (res) => {
                    if (res.error) {
                        this.pending = false;
                        this.error = this.friendlyError(res.error);
                        return;
                    }
                    if (res.authenticated) {
                        this.pending = false;
                        this.dialogRef.close('authenticated');
                        return;
                    }
                    this.pollSubscription = timer(nextInterval()).pipe(
                        takeUntil(this.destroy$),
                    ).subscribe(() => poll());
                },
                error: () => {
                    this.pollSubscription = timer(nextInterval()).pipe(
                        takeUntil(this.destroy$),
                    ).subscribe(() => poll());
                },
            });
        };

        this.pollSubscription = timer(2000).pipe(
            takeUntil(this.destroy$),
        ).subscribe(() => poll());
    }

    private stopPolling() {
        if (this.pollSubscription) {
            this.pollSubscription.unsubscribe();
            this.pollSubscription = null;
        }
    }
}
