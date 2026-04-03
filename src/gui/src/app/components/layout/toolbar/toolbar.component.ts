import { Component, inject, OnDestroy } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatToolbar } from '@angular/material/toolbar';
import { handleStreamError } from '@app/classes/rxjs-operators';
import { WelcomeModalComponent } from '@app/components/modals/welcome-modal/welcome-modal.component';
import { NotificationsComponent } from '@primitives/buttons/notifications/notifications.component';
import { VersionUpdateComponent } from '@primitives/buttons/version-update/version-update.component';
import { ToolbarDropdownComponent } from '@primitives/forms/toolbar-dropdown/toolbar-dropdown.component';
import { MetadataService } from '@services/metadata/metadata.service';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { ConnectionState } from '@state/models/connection-state-model';
import { Subscription } from 'rxjs';

@Component({
    selector: 'fme-toolbar',
    templateUrl: './toolbar.component.html',
    styleUrls: ['./toolbar.component.scss'],
    imports: [
        MatToolbar,
        MatIconButton,
        MatIcon,
        ToolbarDropdownComponent,
        NotificationsComponent,
        VersionUpdateComponent,
    ],
})
export class ToolbarComponent implements OnDestroy {
    private dialog = inject(MatDialog);
    private fmeClient = inject(FmeClientService);
    private metadataService = inject(MetadataService);

    connected = false;
    allowUiConfiguration = false;
    version = '';
    subscriptions: Subscription[] = [];

    constructor() {
        const metadataService = this.metadataService;

        this.subscriptions.push(this.metadataService.onUpdate.pipe(handleStreamError({retryCount: 5, fatal: true})).subscribe({
            next: (metadataLoaded) => {
                try {
                    if (metadataLoaded) {
                        this.version = metadataService.daemonVersion;
                        this.allowUiConfiguration = metadataService.permissions.allowUiConfiguration;
                    }
                } catch (e) {
                    console.warn(`Failed to load metadata from daemon: ${e}`);
                    this.version = '';
                    this.allowUiConfiguration = false;
                }
            },
            error: (error) => {
                this.fmeClient.processStreamError(error);
            },
        }));

        this.subscriptions.push(this.fmeClient.connectionState.pipe(handleStreamError({retryCount: 5, fatal: true})).subscribe({
            next: (connectionState) => {
                this.connected = connectionState === ConnectionState.CONNECTED;
            },
            error: (error) => {
                this.fmeClient.processStreamError(error);
            },
        }));
    }

    ngOnDestroy() {
        this.subscriptions.map((subscription) => subscription.unsubscribe());
        this.subscriptions = [];
    }

    openWelcomeModal(): void {
        this.dialog.open(WelcomeModalComponent, {
            width: '700px',
            autoFocus: 'dialog',
        });
    }
}
