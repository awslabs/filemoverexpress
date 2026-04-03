import { inject, Injectable } from '@angular/core';
import { MARKETING_PAGE_URL } from '@app/constants/external-links';
import { jobStatusToString } from '@app/utils/job-utils';
import { formatBytes } from '@app/utils/utils';
import * as CoreEvents from '@events/core';
import * as InventoryEvents from '@events/inventory';
import * as JobEvents from '@events/job';
import { DisconnectType } from '@gen/es/fme/v1/events_pb';
import { Store } from '@ngrx/store';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { addLog } from '@state/logs/actions/logs.actions';
import { JobStatus } from '@state/models/job.model';

const IGNORED_EVENTS = [JobEvents.TaskCompleteEvent] as const;

@Injectable({
    providedIn: 'root',
})
export class LogsService {
    private store = inject(Store);
    private fmeClientService = inject(FmeClientService);

    private jobNames: Record<string, string> = {};

    constructor() {
        this.updateJobNames();

        this.fmeClientService.events$.subscribe({
            next: (evt) => {
                if (evt instanceof InventoryEvents.InventoryReportStartedEvent) {
                    this.handleInventoryStart(evt);
                } else if (evt instanceof InventoryEvents.InventoryReportCompletedEvent) {
                    this.handleInventoryCompleted(evt);
                } else if (evt instanceof InventoryEvents.InventoryReportErrorEvent) {
                    this.handleInventoryError(evt);
                } else if (evt instanceof JobEvents.JobCreateEvent) {
                    this.handleJobCreate(evt);
                } else if (evt instanceof JobEvents.JobStatusChangeEvent) {
                    this.handleJobStatusChange(evt);
                } else if (evt instanceof JobEvents.JobChecksumProgressEvent) {
                    this.handleJobChecksumProgressEvent(evt);
                } else if (evt instanceof JobEvents.JobProgressEvent) {
                    this.handleJobProgress(evt);
                } else if (evt instanceof JobEvents.JobCompleteEvent) {
                    this.handleJobComplete(evt);
                } else if (evt instanceof JobEvents.JobErrorEvent) {
                    this.handleJobError(evt);
                } else if (evt instanceof JobEvents.JobUpdateEvent) {
                    this.handleJobUpdate(evt);
                } else if (evt instanceof CoreEvents.NewVersionAvailableEvent) {
                    this.handleNewVersionAvailable(evt);
                } else if (evt instanceof CoreEvents.UnsupportedVersionEvent) {
                    this.handleUnsupportedVersion(evt);
                } else if (evt instanceof CoreEvents.ServerDisconnectEvent) {
                    this.handleServerDisconnect(evt);
                } else if (evt instanceof CoreEvents.MessageEvent) {
                    this.handleMessage(evt);
                } else if (evt instanceof CoreEvents.MetadataEvent) {
                    this.handleMetadata(evt);
                } else if (evt instanceof CoreEvents.AlertEvent) {
                    this.handleAlert(evt);
                } else if (evt instanceof CoreEvents.TransferStatsEvent) {
                    this.handleTransferStats(evt);
                } else {
                    for (const ignEvt of IGNORED_EVENTS) {
                        if (evt instanceof ignEvt) {
                            return;
                        }
                    }
                    console.error(`LogsService received an event type it couldn't handle: ${evt}`);
                }
            },
            error: (err) => {
                console.error(err);
            },
        });
    }

    init() {
        console.log('Initializing Logs service');
    }

    private updateJobNames() {
        this.fmeClientService.listJobNames().subscribe(
            {
                next: ((jobNames) => {
                    this.jobNames = jobNames;
                }),
                error: (err) => {
                    console.log(`[Logs] Error updating list of jobs: ${err}`);
                },
            },
        );
    }

    private getJobName(jobId: string): string {
        if (jobId in this.jobNames) {
            return this.jobNames[jobId];
        }

        this.updateJobNames();
        return jobId;
    }

    // region Event handlers
    private handleAlert(evt: CoreEvents.AlertEvent) {
        this.store.dispatch(addLog({
            log: {
                level: evt.logLevel,
                message: evt.message,
                timestamp: new Date(),
                jobId: null,
            },
        }));
    }

    private handleMetadata(evt: CoreEvents.MetadataEvent) {
        const txpNames = Object.keys(evt.transferProfiles).join(', ');
        const message = `Metadata event received; Is connection event: ${evt.connectionEvent ? 'yes' : 'no'}, ` +
            `Version: ${evt.version}, ` +
            `Daemon mode: ${evt.daemonMode ? 'yes' : 'false'}, ` +
            `CPU Cores: ${evt.cpuCoreCount}, ` +
            `Allow UI Config: ${evt.permissions.allowUiConfiguration ? 'yes' : 'no'}, ` +
            `Allow Local Rename and Delete: ${evt.permissions.allowLocalRenameDelete ? 'yes' : 'no'}, ` +
            `Allow Remote Rename and Delete: ${evt.permissions.allowRemoteRenameDelete ? 'yes' : 'no'}, ` +
            `Remote Configurations: ${txpNames}, ` +
            `Daemon OS: ${evt.daemonOS}`;

        this.store.dispatch(addLog({
            log: {
                level: evt.logLevel,
                message: message,
                timestamp: new Date(),
                jobId: null,
            },
        }));
    }

    private handleMessage(evt: CoreEvents.MessageEvent) {
        this.store.dispatch(addLog({
            log: {
                level: evt.logLevel,
                message: evt.msg,
                timestamp: new Date(),
                jobId: null,
            },
        }));
    }

    private handleServerDisconnect(evt: CoreEvents.ServerDisconnectEvent) {
        let message: string;

        switch (evt.disconnectType) {
            case DisconnectType.UNSPECIFIED:
                message = 'Unknown disconnect reason';
                break;

            case DisconnectType.CLI_DOWNLOADS_COMPLETE_DISCONNECT_TYPE:
                message = 'Download completed';
                break;

            case DisconnectType.CLI_UPLOADS_COMPLETE_DISCONNECT_TYPE:
                message = 'Upload completed';
                break;

            case DisconnectType.DAEMON_MODE_EXIT_DISCONNECT_TYPE:
                message = 'User-initiated daemon mode shutdown';
                break;
        }

        this.store.dispatch(addLog({
            log: {
                level: evt.logLevel,
                message: message,
                timestamp: new Date(),
                jobId: null,
            },
        }));
    }

    private handleUnsupportedVersion(evt: CoreEvents.UnsupportedVersionEvent) {
        this.store.dispatch(addLog({
            log: {
                level: evt.logLevel,
                message: `Your current version is no longer supported. Current version: ${evt.currentVersion}, Newest supported version: ${evt.newVersion}. Visit ${MARKETING_PAGE_URL} to download`,
                timestamp: new Date(),
                jobId: null,
            },
        }));
    }

    private handleNewVersionAvailable(evt: CoreEvents.NewVersionAvailableEvent) {
        this.store.dispatch(addLog({
            log: {
                level: evt.logLevel,
                message: `A new version is available. Current version: ${evt.currentVersion}, New version: ${evt.newVersion}. Visit ${MARKETING_PAGE_URL} to download`,
                timestamp: new Date(),
                jobId: null,
            },
        }));
    }

    private handleJobError(evt: JobEvents.JobErrorEvent) {
        this.store.dispatch(addLog({
            log: {
                level: evt.logLevel,
                message: `Error for job ${evt.name} - ${evt.error}`,
                timestamp: new Date(),
                jobId: evt.id,
            },
        }));
    }

    private handleJobComplete(evt: JobEvents.JobCompleteEvent) {
        if (evt.hasTaskErrors && evt.hasSuccessfulTasks) {
            this.store.dispatch(addLog({
                log: {
                    level: evt.logLevel,
                    message: `Completed job (with errors) ${evt.name}`,
                    timestamp: new Date(),
                    jobId: evt.id,
                },
            }));
            return;
        }
        if (evt.hasTaskErrors && !evt.hasSuccessfulTasks) {
            this.store.dispatch(addLog({
                log: {
                    level: evt.logLevel,
                    message: `Failed job ${evt.name}`,
                    timestamp: new Date(),
                    jobId: evt.id,
                },
            }));
            return;
        }
        if (evt.hasAllTasksSkipped) {
            this.store.dispatch(addLog({
                log: {
                    level: evt.logLevel,
                    message: `Skipped job ${evt.name}`,
                    timestamp: new Date(),
                    jobId: evt.id,
                },
            }));
            return;
        }
        this.store.dispatch(addLog({
            log: {
                level: evt.logLevel,
                message: `Completed job ${evt.name}`,
                timestamp: new Date(),
                jobId: evt.id,
            },
        }));
    }

    private handleJobProgress(evt: JobEvents.JobProgressEvent) {
        this.store.dispatch(addLog({
            log: {
                level: evt.logLevel,
                message: `Job progress for ${evt.name}: ${formatBytes(evt.bytesTransferred)}/${formatBytes(evt.totalBytes)} transferred`,
                timestamp: new Date(),
                jobId: evt.id,
            },
        }));
    }

    private handleJobCreate(evt: JobEvents.JobCreateEvent) {
        this.jobNames[evt.id] = evt.name;

        this.store.dispatch(addLog({
            log: {
                level: evt.logLevel,
                message: `Created job ${evt.name}`,
                timestamp: new Date(),
                jobId: evt.id,
            },
        }));
    }

    private handleJobStatusChange(evt: JobEvents.JobStatusChangeEvent) {
        // Because the GUI states don't match up with the Daemon states, we need to ignore completion events, or the jobs-stable
        // won't be able to correct display the various completed states. This is because the GUI has states for job completion that does
        // not exist in the backend, such as an explicit `CompleteWithErrors` etc.
        // TODO: Standardize the JobStatus between GUI and CLI
        if (evt.status === JobStatus.Completed) {
            return;
        }

        this.store.dispatch(addLog({
            log: {
                level: evt.logLevel,
                message: `Job '${this.getJobName(evt.id)}' status changed to ${jobStatusToString(evt.status)}`,
                timestamp: evt.timestamp,
                jobId: evt.id,
            },
        }));
    }

    private handleJobChecksumProgressEvent(evt: JobEvents.JobChecksumProgressEvent) {
        const pct = parseFloat(((evt.completed / evt.total) * 100).toFixed(2));

        this.store.dispatch(addLog({
            log: {
                level: evt.logLevel,
                message: `Job '${this.getJobName(evt.jobId)}' checksum ${pct}% complete (${evt.completed}/${evt.total})`,
                timestamp: new Date(),
                jobId: evt.jobId,
            },
        }));
    }

    private handleJobUpdate(evt: JobEvents.JobUpdateEvent) {
        this.store.dispatch(addLog({
            log: {
                level: evt.logLevel,
                message: evt.logMessage,
                timestamp: new Date(),
                jobId: evt.jobId,
            },
        }));
    }

    private handleInventoryError(evt: InventoryEvents.InventoryReportErrorEvent) {
        this.store.dispatch(addLog({
            log: {
                level: evt.logLevel,
                message: `Bucket report for ${evt.bucket} (Prefix: ${evt.prefix}) encountered an error: ${evt.error}`,
                timestamp: new Date(),
                jobId: null,
            },
        }));
    }

    private handleInventoryCompleted(evt: InventoryEvents.InventoryReportCompletedEvent) {
        this.store.dispatch(addLog({
            log: {
                level: evt.logLevel,
                message: `Bucket report for ${evt.bucket} (Prefix: ${evt.prefix}) has completed and is available at ${evt.outputFile}`,
                timestamp: new Date(),
                jobId: null,
            },
        }));
    }

    private handleInventoryStart(evt: InventoryEvents.InventoryReportStartedEvent) {
        this.store.dispatch(addLog({
            log: {
                level: evt.logLevel,
                message: `A bucket report is being generated for ${evt.bucket} (Prefix: ${evt.prefix})`,
                timestamp: new Date(),
                jobId: null,
            },
        }));
    }

    private handleTransferStats(evt: CoreEvents.TransferStatsEvent) {
        this.store.dispatch(addLog({
            log: {
                level: evt.logLevel,
                message: evt.logMessage,
                timestamp: new Date(),
                jobId: null,
            },
        }));
    }

    // endregion
}
