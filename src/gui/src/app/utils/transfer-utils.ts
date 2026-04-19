import { ProgressBarMode } from '@angular/material/progress-bar';
import { formatBytes } from './utils';
import { TaskElement } from '@app/interfaces/jobs-table';
import { Job } from '@state/models/job.model';

export interface FilterValues {
    term: string | null,
    status: string[] | null,
}

export interface ProgressBarData {
    mode: ProgressBarMode,
    value: number,
    percentage: string,
    description: string,
}

export function jobsTableFilterPredicate(job: Job, term: string): boolean {
    if (term === '') {
        return true;
    }

    const filters: FilterValues = JSON.parse(term);
    if (filters.status?.length) {
        return filters.status.includes(job.status);
    }

    return true;
}

export function tasksTableFilterPredicate(task: TaskElement, term: string): boolean {
    if (term === '') {
        return true;
    }

    const filters: FilterValues = JSON.parse(term);
    let isStatusAvailable = false;
    let isNameAvailable;
    if (filters.status) {
        for (const status of filters.status) {
            if (task.status?.trim() === status) {
                isStatusAvailable = true;
            }
        }
    } else {
        isStatusAvailable = true;
    }

    if (filters.term) {
        isNameAvailable = task.name.trim().toLowerCase().includes(filters.term.toLowerCase());
    } else {
        isNameAvailable = true;
    }

    return isStatusAvailable && isNameAvailable;
}

export function buildFilterString(data: FilterValues) {
    const filter: FilterValues = {
        term: null,
        status: null,
    };

    if (data.term?.trim()) {
        filter.term = data.term.trim().toLowerCase();
    }

    if (data.status?.length) {
        filter.status = data.status;
    }

    if (!filter.term && !filter.status) {
        return '';
    }

    return JSON.stringify(filter);
}

export function processTransferStats(data: { totalBytes: number, completedBytes: number }): ProgressBarData {
    const out: ProgressBarData = {
        mode: 'determinate',
        value: 0,
        percentage: '0%',
        description: '0 Bytes of 0 Bytes',
    };

    if (data.totalBytes > 0) {
        out.value = data.completedBytes / data.totalBytes * 100;
        const completedBytesFormatted = formatBytes(data.completedBytes, 1);
        const totalBytesFormatted = formatBytes(data.totalBytes, 1);
        out.percentage = `${out.value.toFixed()}%`;
        out.description = `${completedBytesFormatted} of ${totalBytesFormatted}`;
    }

    if (out.value !== 0 && out.value !== 100) {
        out.mode = 'buffer';
    }
    return out;
}
