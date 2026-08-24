import { Component, inject, input, OnInit, output } from '@angular/core';
import { ButtonComponent } from '@app/components/primitives/buttons/button/button.component';
import { FmeClientService } from '@services/fme-client/fme-client.service';

/**
 * Minimal OIDC sign-out control shown in the S3 toolbar once an authenticated OIDC
 * profile is listing. It intentionally carries no "signed in" status label — a visible
 * bucket listing is already proof of a session — only the sign-out action (which is
 * OIDC-specific and has no other home), with the signed-in identity in its tooltip.
 * The sign-in flow itself lives in the OIDC sign-in modal.
 */
@Component({
    selector: 'fme-oidc-auth-status',
    templateUrl: './oidc-auth-status.component.html',
    styleUrls: ['./oidc-auth-status.component.scss'],
    imports: [
        ButtonComponent,
    ],
})
export class OidcAuthStatusComponent implements OnInit {
    private fmeClient = inject(FmeClientService);

    profileName = input.required<string>();
    authenticated = output<boolean>();

    identity = '';

    ngOnInit() {
        this.fmeClient.getOIDCStatus(this.profileName()).subscribe({
            next: (res) => {
                if (res.authenticated) {
                    this.identity = res.identity;
                }
            },
        });
    }

    get signOutTooltip(): string {
        return this.identity ? `Sign out (${this.identity})` : 'Sign out';
    }

    signOut() {
        return () => {
            this.fmeClient.logoutOIDC(this.profileName()).subscribe({
                next: () => this.authenticated.emit(false),
                error: () => this.authenticated.emit(false),
            });
        };
    }
}
