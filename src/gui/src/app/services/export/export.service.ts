import { inject, Injectable, RendererFactory2 } from '@angular/core';
import { formatDate } from '@app/utils/utils';
import { ExportJobConfig, ExportJobList, ExportMimeTypes } from './export.interfaces';
import { DEFAULT_EXPORT_JOB_CONFIG } from './export.constants';
import { TransferDirection } from '@app/interfaces/jobs-table';
import { convertTransfersToCsv, convertTransfersToExcel, convertTransfersToJson } from '@services/export/export.utils';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { Task } from '@classes/grpc/task';
import { switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { NotificationsService } from '@services/notifications/notifications.service';
import { Job } from '@classes/grpc';

@Injectable({
    providedIn: 'root',
})
export class ExportService {
    private rf = inject(RendererFactory2);
    private fmeClientService = inject(FmeClientService);
    private notifications = inject(NotificationsService);

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

    private getJobTasks(job: Job, exportData: ExportJobList, cfg: ExportJobConfig) {
        const jobTasks: Task[] = [];

        this.fmeClientService.listTasksForJob(job.jobId).subscribe({
            next: (task) => jobTasks.push(task),
            error: (err) => {
                console.error(err);
            },
            complete: () => {
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
                    return;
                }

                this.getJobTasks(job, exportData, cfg);
            },
            error: (err) => {
                console.error(err);
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
    private async processJob(config: ExportJobConfig, data: ExportJobList): Promise<void> {
        const timestamp = formatDate(new Date(), true);
        const cfg: ExportJobConfig = {
            ...DEFAULT_EXPORT_JOB_CONFIG,
            ...config,
        };

        if (Object.keys(data).length === 0) {
            return;
        }

        let result: string;
        let mt: ExportMimeTypes;

        switch (cfg.format) {
            case 'csv':
                result = convertTransfersToCsv(data);
                mt = ExportMimeTypes.CSV;
                break;
            case 'xlsx':
                result = await convertTransfersToExcel(data);
                if (!result) {
                    this.notifications.info('There are no jobs to export. Not downloading XLSX file.');
                    return;
                }
                mt = ExportMimeTypes.XLSX;
                break;
            case 'json':
                result = convertTransfersToJson(data);
                mt = ExportMimeTypes.JSON;
                break;
            default:
                console.error(`exportTransfers was called with an invalid format: ${cfg.format}`);
                return;
        }

        this.downloadFile(`${cfg.filename}-${timestamp}.${cfg.format}`, mt, result);
    }

    /**
     * Downloads a file
     *
     * @param {string} filename File name.
     * @param {string} mimetype MIME type of the file.
     * @param {string} data Data of the file.
     * @private
     */
    private downloadFile(filename: string, mimetype: string, data: string) {
        const renderer = this.rf.createRenderer(null, null);
        const link = renderer.createElement('a');
        link.href = `data:${mimetype};base64,${data}`;
        link.download = filename;
        link.click();
        link.remove();
    }
}
