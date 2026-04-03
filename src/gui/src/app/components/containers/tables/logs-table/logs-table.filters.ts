import { LogEntry } from '@state/models/log-entry.model';
import { FormControl } from '@angular/forms';

export interface LogsFilterValues {
    levels: string[] | null,
    keywords: string | null,
    jobs: string[] | null,
}

export interface LogsFilterForm {
    levels: FormControl<string | null>,
    keywords: FormControl<string | null>,
    jobs: FormControl<string | null>,
}

export function filterPredicate(log: LogEntry, term: string): boolean {
    if (term === '') {
        return true;
    }

    const filters: LogsFilterValues = JSON.parse(term);

    // check log level
    if (filters.levels?.length && !filters.levels.includes(log.level)) {
        return false;
    }

    // check search keywords
    if (filters.keywords && !log.message.toLowerCase().includes(filters.keywords.toLowerCase())) {
        return false;
    }

    // check job ID
    if (filters.jobs?.length && (log.jobId === null || !filters.jobs.includes(log.jobId))) {
        return false;
    }

    return true;

}

export function buildFilterString(data: LogsFilterValues) {
    const filter: LogsFilterValues = {
        keywords: null,
        levels: null,
        jobs: null,
    };

    if (data.keywords?.trim()) {
        filter.keywords = data.keywords.trim().toLowerCase();
    }

    if (data.levels?.length) {
        filter.levels = data.levels;
    }

    if (data.jobs?.length) {
        filter.jobs = data.jobs;
    }

    if (!filter.keywords && !filter.levels && !filter.jobs) {
        return '';
    }

    return JSON.stringify(filter);
}
