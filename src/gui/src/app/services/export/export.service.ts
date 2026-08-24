import { inject, Injectable, RendererFactory2 } from '@angular/core';
import { formatDate, isPackagedApp } from '@app/utils/utils';
import { ExportJobConfig, ExportJobList, ExportMimeTypes } from './export.interfaces';
import { DEFAULT_EXPORT_JOB_CONFIG } from './export.constants';
import { TransferDirection } from '@app/interfaces/jobs-table';
import { convertTransfersToCsv, convertTransfersToExcel, convertTransfersToJson } from '@services/export/export.utils';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { Task } from '@classes/grpc/task';
import { switchMap } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
import { NotificationsService } from '@services/notifications/notifications.service';
import { WailsService } from '@services/wails/wails.service';
import { Job } from '@classes/grpc';

@Injectable({
    providedIn: 'root',
})
export class ExportService {
    private rf = inject(RendererFactory2);
    private fmeClientService = inject(FmeClientService);
    private notifications = inject(NotificationsService);
    private wails = inject(WailsService);

    /**
     * Export all current jobs known to the daemon
     *
     * @param {ExportJobConfig} [config] Export configuration. Optional
     */
    exportJobs(config?: Partial<ExportJobConfig>) {
        const cfg: ExportJobConfig = {
            ...DEFAULT_EXPORT_JOB_CONFIG,
            ...config,
        };
        const exportData: ExportJobList = {};

        this.fmeClientService.listJobs().subscribe({
            next: (jobs) => {
                for (const job of jobs) {
                    this.getJobTasks(job, exportData, cfg);
                }
            },
            error: (err) => {
                console.error(err);
            },
        });
    }

    private getJobTasks(job: Job, exportData: ExportJobList, cfg: ExportJobConfig, notifyEmpty = false) {
        const jobTasks: Task[] = [];

        this.fmeClientService.listTasksForJob(job.jobId).subscribe({
            next: (task) => jobTasks.push(task),
            error: (err) => {
                console.error(err);
                if (notifyEmpty) {
                    // An empty task stream (e.g. a skipped job with no transfers) terminates
                    // without a gRPC-Web trailer, which connect-web surfaces as "missing
                    // trailer". Treat that as an empty report, not a failure.
                    if (jobTasks.length === 0 && String(err).includes('missing trailer')) {
                        this.notifications.info('This job has no transfers to export.');
                    } else {
                        this.notifications.error(`Couldn't export job report: ${err}`);
                    }
                }
            },
            complete: () => {
                // A job with no transfers (e.g. a skipped job where every file was filtered
                // out) would otherwise produce a content-free file with no feedback.
                if (notifyEmpty && jobTasks.length === 0) {
                    this.notifications.info('This job has no transfers to export.');
                    return;
                }
                exportData[job.jobId] = {
                    jobName: job.name,
                    destination: job.destination,
                    direction: job.direction === 'download' ? TransferDirection.Download : TransferDirection.Upload,
                    transferProfileName: job.transferProfileName,
                    bucket: job.bucket,
                    transfers: jobTasks,
                };
                this.processJob(cfg, exportData);
            },
        });
    }

    /**
     * Export a report for a specific job
     *
     * @param {string} jobId ID of the job to generate report for
     * @param {string} config Export configuration
     */
    exportJobById(jobId: string, config?: Partial<ExportJobConfig>) {
        const cfg: ExportJobConfig = {
            ...DEFAULT_EXPORT_JOB_CONFIG,
            ...config,
        };
        const exportData: ExportJobList = {};

        this.fmeClientService.listJobs().pipe(
            switchMap((jobs) => of(jobs.find((itm) => itm.jobId === jobId))),
        ).subscribe({
            next: (job) => {
                if (!job) {
                    this.notifications.error('Couldn\'t export job report: job not found.');
                    return;
                }

                this.getJobTasks(job, exportData, cfg, true);
            },
            error: (err) => {
                console.error(err);
                this.notifications.error(`Couldn't export job report: ${err}`);
            },
        });
    }

    /**
     * Process the gathered list of jobs and their tasks, and convert them to the appropriate output format as defined by config
     *
     * @param {ExportJobConfig} config
     * @param {ExportJobList} data
     * @private
     */
    private processJob(config: ExportJobConfig, data: ExportJobList): void {
        const timestamp = formatDate(new Date(), true);
        const cfg: ExportJobConfig = {
            ...DEFAULT_EXPORT_JOB_CONFIG,
            ...config,
        };

        if (Object.keys(data).length === 0) {
            return;
        }

        let report$: Observable<string>;
        let mt: ExportMimeTypes;

        switch (cfg.format) {
            case 'csv':
                report$ = convertTransfersToCsv(this.wails, data);
                mt = ExportMimeTypes.CSV;
                break;
            case 'xlsx':
                report$ = convertTransfersToExcel(this.wails, data);
                mt = ExportMimeTypes.XLSX;
                break;
            case 'json':
                report$ = convertTransfersToJson(this.wails, data);
                mt = ExportMimeTypes.JSON;
                break;
            default:
                console.error(`exportTransfers was called with an invalid format: ${cfg.format}`);
                return;
        }

        report$.subscribe((result) => {
            if (!result && cfg.format === 'xlsx') {
                this.notifications.info('There are no jobs to export. Not downloading XLSX file.');
                return;
            }
            this.downloadFile(`${cfg.filename}-${timestamp}.${cfg.format}`, mt, result);
        });
    }

    /**
     * Downloads a file
     *
     * @param {string} filename File name.
     * @param {string} mimetype MIME type of the file.
     * @param {string} data Base64-encoded data of the file.
     * @private
     */
    private downloadFile(filename: string, mimetype: string, data: string) {
        if (isPackagedApp()) {
            // The packaged Wails webview ignores anchor / `data:` URL downloads, and the
            // export data is generated in-memory (never written to disk), so there is
            // nothing to reveal. Prompt the user with a native Save dialog instead and
            // let the Go side write the bytes. See issue #24.
            this.wails.saveFile(filename, data).subscribe({
                next: (savedPath) => {
                    if (savedPath) {
                        this.notifications.success(`Exported to ${savedPath}`);
                    }
                },
                error: (err) => {
                    this.notifications.error(`Export failed: ${err}`);
                },
            });
            return;
        }

        // Dev / browser mode: the anchor `data:` URL download works here.
        const renderer = this.rf.createRenderer(null, null);
        const link = renderer.createElement('a');
        link.href = `data:${mimetype};base64,${data}`;
        link.download = filename;
        link.click();
        link.remove();
    }
}
