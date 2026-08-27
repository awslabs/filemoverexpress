import { Component, inject, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { StorageServiceError } from '@app/classes/errors';
import { handleStreamError } from '@app/classes/rxjs-operators';
import { VersionUpdateModalComponent } from '@app/components/modals/version-update-modal/version-update-modal.component';
import { BaseEvent } from '@app/interfaces/events';
import { NewVersionAvailableEvent } from '@events/core/new-version-available-event';
import { UnsupportedVersionEvent } from '@events/core/unsupported-version-event';
import { NotificationsService } from '@services/notifications/notifications.service';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { VersionService } from '@services/version/version.service';
import { Subscription } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { STORAGE_SERVICE_ERROR } from './version-update.constants';

@Component({
    selector: 'fme-version-update',
    templateUrl: './version-update.component.html',
    styleUrls: ['./version-update.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        MatIconButton,
        MatIcon,
        MatTooltip,
    ],
})
export class VersionUpdateComponent implements OnDestroy {
    private fmeClient = inject(FmeClientService);
    private notifications = inject(NotificationsService);
    dialog = inject(MatDialog);
    private versionService = inject(VersionService);

    updatesAvailable = false;
    currentVersionUnsupported = false;
    newVersion = '';
    ignoredVersions: string[];
    releaseNotes: string[] = [];
    private subscription: Subscription;

    constructor() {
        this.ignoredVersions = this.versionService.ignoredUpdates;
        this.subscription = this.fmeClient.events$.pipe(
            distinctUntilChanged(),
            handleStreamError({retryCount: 5}),
        ).subscribe({
            next: (evt) => {
                this.handleVersionEvent((evt as BaseEvent));
            },
            error: (error) => {
                this.fmeClient.processStreamError(error);
            },
        });
    }

    ngOnDestroy() {
        this.subscription.unsubscribe();
    }

    openDownloadModal(): void {
        this.dialog.open(VersionUpdateModalComponent, {width: '50%', autoFocus: 'dialog'});
    }

    tooltipText(): string {
        if (this.currentVersionUnsupported) {
            return `Newest supported version is ${this.newVersion}, click to visit downloads page`;
        }
        return `An update is available to ${this.newVersion}, click to visit downloads page`;
    }

    public get ignore(): boolean {
        return this.ignoredVersions.includes(this.newVersion);
    }

    public get skip(): boolean {
        return this.versionService.skipStatus;
    }

    private handleVersionEvent(evt: BaseEvent) {
        if (evt instanceof NewVersionAvailableEvent) {
            this.handleNewVersionEvent((evt as NewVersionAvailableEvent));
        } else if (evt instanceof UnsupportedVersionEvent) {
            this.handleUnsupportedVersionEvent((evt as UnsupportedVersionEvent));
        }
    }

    private handleNewVersionEvent(evt: NewVersionAvailableEvent) {
        try {
            const updates = this.versionService.getAllUpdates();
            this.currentVersionUnsupported = false;
            this.newVersion = evt.newVersion;
            this.releaseNotes = evt.releaseNotes;
            this.updatesAvailable = true;

            if (updates.nextVersion == '' || updates.nextVersion !== evt.newVersion) {
                this.notifications.info(
                    `A new version is available. Current version: ${evt.currentVersion}, New version: ${evt.newVersion}`,
                );
                updates.nextVersion = evt.newVersion;
                updates.releaseNotes = evt.releaseNotes;
            }
        } catch (e) {
            if (e instanceof StorageServiceError) {
                console.debug(STORAGE_SERVICE_ERROR);
                return;
            }
            throw e;
        }
    }

    private handleUnsupportedVersionEvent(evt: UnsupportedVersionEvent) {
        try {
            const updates = this.versionService.getAllUpdates();
            this.updatesAvailable = false;
            this.newVersion = evt.newVersion;
            this.releaseNotes = evt.releaseNotes;
            this.currentVersionUnsupported = true;

            if (updates.nextVersion == '' || updates.nextVersion !== evt.newVersion) {
                this.notifications.info(
                    `Your current version is no longer supported. Current version: ${evt.currentVersion}, Newest supported version: ${evt.newVersion}`,
                );
                updates.nextVersion = evt.newVersion;
                updates.releaseNotes = evt.releaseNotes;
            }
        } catch (e) {
            if (e instanceof StorageServiceError) {
                console.debug(STORAGE_SERVICE_ERROR);
                return;
            }
            throw e;
        }
    }
}
