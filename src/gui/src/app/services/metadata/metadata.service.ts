import { inject, Injectable, OnDestroy, signal } from '@angular/core';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { MetadataEvent } from '@events/core';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import { MetadataNotLoadedError, MetadataTransferProfiles, Permissions } from './metadata.interfaces';
import { NULL_METADATA_ERROR } from './metadata.constants';
import { ConnectionState } from '@state/models/connection-state-model';
import { VersionNumber } from '../version/version.constants';

@Injectable({
    providedIn: 'root',
})
export class MetadataService implements OnDestroy {
    private fmeClientService = inject(FmeClientService);
    private metadata: MetadataEvent | null = null;
    private update$: BehaviorSubject<boolean>;
    private updateTransferProfileNames$: Subject<boolean>;
    private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
    private subscriptions: Subscription[] = [];
    metadataSig = signal<MetadataEvent>(new MetadataEvent());

    constructor() {
        this.update$ = new BehaviorSubject<boolean>(false);
        this.updateTransferProfileNames$ = new BehaviorSubject<boolean>(false);
    }

    init() {
        this.subscribeToMetadata();
        console.debug('[MetadataService] Subscribed to metadata events from FmeClientService');
    }

    /**
     * Unsubscribe from all subscriptions
     */
    ngOnDestroy() {
        this.subscriptions.map((subscription) => subscription.unsubscribe());
        this.subscriptions = [];
    }

    /**
     * Subscriptions to fme-client service's metadata and connection state to set new metadata or null out metadata
     * @private
     */
    private subscribeToMetadata() {
        this.subscriptions.push(this.fmeClientService.metadata.subscribe({
            next: (metadata: MetadataEvent) => {
                if (metadata.version === VersionNumber.VERSION_DEFAULT && !this.metadata) {
                    // got fme-client service metadata behavior subject's initial default value
                    return;
                }
                this.metadata = metadata;
                this.update$.next(true);
                this.updateAllMetadata();
                this.metadataSig.set(metadata);
            },
        }));
        this.subscriptions.push(this.fmeClientService.connectionState.subscribe({
            next: (state: ConnectionState) => {
                const oldConnState = this.connectionState;
                this.connectionState = state;
                if (state !== ConnectionState.CONNECTED && this.metadata) {
                    this.metadata = null;
                }
                if (oldConnState === ConnectionState.CONNECTED && state !== ConnectionState.CONNECTED) {
                    // disconnect
                    this.updateAllMetadata();
                }
            },
        }));
    }

    /**
     * Emit on update signal for all subjects
     * @private
     */
    private updateAllMetadata() {
        this.update$.next(true);
        this.updateTransferProfileNames$.next(true);
    }

    /**
     * Get observable for when metadata is updated
     */
    get onUpdate(): Observable<boolean> {
        return this.update$.asObservable();
    }

    /**
     * Get observable for when only the transfer profile names are updated (not the data tied to the names)
     */
    get onUpdateTransferProfileNames(): Observable<boolean> {
        return this.updateTransferProfileNames$.asObservable();
    }

    /**
     * Get all metadata
     * @throws Throws error if the metadata is null
     */
    get allMetadata(): MetadataEvent {
        if (!this.metadata) {
            throw new MetadataNotLoadedError(NULL_METADATA_ERROR);
        }
        return this.metadata;
    }

    /**
     * Get daemonMode from metadata
     * @throws Throws error if the metadata is null
     */
    get daemonMode(): boolean {
        if (!this.metadata) {
            throw new MetadataNotLoadedError(NULL_METADATA_ERROR);
        }
        return this.metadata.daemonMode;
    }

    /**
     * Get transfer profiles from metadata
     * @throws Throws error if the metadata is null
     */
    get transferProfiles(): MetadataTransferProfiles {
        if (!this.metadata) {
            throw new MetadataNotLoadedError(NULL_METADATA_ERROR);
        }
        return this.metadata.transferProfiles;
    }

    /**
     * Get cpuCoreCount from metadata
     * @throws Throws error if the metadata is null
     */
    get cpuCoreCount(): number {
        if (!this.metadata) {
            throw new MetadataNotLoadedError(NULL_METADATA_ERROR);
        }
        return this.metadata.cpuCoreCount;
    }

    /**
     * Get daemonVersion from metadata
     * @throws Throws error if the metadata is null
     */
    get daemonVersion(): string {
        if (!this.metadata) {
            throw new MetadataNotLoadedError(NULL_METADATA_ERROR);
        }
        return this.metadata.version;
    }

    /**
     * Get all permissions data from metadata
     * @throws Throws error if the metadata is null
     */
    get permissions(): Permissions {
        if (!this.metadata) {
            throw new MetadataNotLoadedError(NULL_METADATA_ERROR);
        }
        return this.metadata.permissions;
    }

    /**
     * Get homePath from metadata
     * @throws Throws error if the metadata is null
     */
    get homePath(): string {
        if (!this.metadata) {
            throw new MetadataNotLoadedError(NULL_METADATA_ERROR);
        }
        return this.metadata.homePath;
    }

    /**
     * Get daemonOS from metadata
     * @throws Throws error if the metadata is null
     */
    get daemonOS(): string {
        if (!this.metadata) {
            throw new MetadataNotLoadedError(NULL_METADATA_ERROR);
        }
        return this.metadata.daemonOS;
    }

    /**
     * Get connectionEvent from metadata
     * @throws Throws error if the metadata is null
     */
    get connectionEvent(): boolean {
        if (!this.metadata) {
            throw new MetadataNotLoadedError(NULL_METADATA_ERROR);
        }
        return this.metadata.connectionEvent;
    }

    /**
     * Get awsProfiles from metadata
     * @throws Throws error if the metadata is null
     */
    get awsProfiles(): string[] {
        if (!this.metadata) {
            throw new MetadataNotLoadedError(NULL_METADATA_ERROR);
        }
        return this.metadata.awsProfiles;
    }

    /**
     * Get hotFolderSourceDirectories from metadata
     * @throws Throws error if the metadata is null
     */
    get hotFolderSourceDirectories(): string[] {
        if (!this.metadata) {
            throw new MetadataNotLoadedError(NULL_METADATA_ERROR);
        }
        return this.metadata.hotFolderSourceDirectories;
    }
}
