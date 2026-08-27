import { AsyncPipe, DatePipe, NgClass } from '@angular/common';
import { Component, inject, OnInit, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormField, MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSort, MatSortHeader } from '@angular/material/sort';
import {
    MatCell,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatNoDataRow,
    MatRow,
    MatRowDef,
    MatTable,
    MatTableDataSource,
} from '@angular/material/table';
import { handleStreamError } from '@app/classes/rxjs-operators';
import { TypeSafeMatCellDefDirective } from '@app/directives/type-safe-mat-cell-def.directive';
import { EventLogLevel } from '@app/interfaces/events';
import { buildFilterString, filterPredicate, LogsFilterForm } from '@containers/tables/logs-table/logs-table.filters';
import { Store } from '@ngrx/store';
import { selectAll as selectAllJobs } from '@state/job/job.selectors';
import { selectAll } from '@state/logs/logs.selectors';
import { Job } from '@state/models/job.model';
import { LogEntry } from '@state/models/log-entry.model';
import { debounceTime, Observable } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';

@Component({
    selector: 'fme-logs-table',
    templateUrl: './logs-table.component.html',
    styleUrls: ['./logs-table.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        ReactiveFormsModule,
        MatFormField,
        MatInput,
        MatSelect,
        MatOption,
        AsyncPipe,
        MatTable,
        MatSort,
        MatColumnDef,
        MatHeaderCell,
        MatHeaderCellDef,
        MatSortHeader,
        MatCell,
        TypeSafeMatCellDefDirective,
        DatePipe,
        MatHeaderRow,
        MatHeaderRowDef,
        MatRow,
        MatRowDef,
        NgClass,
        MatNoDataRow,
    ],
})
export class LogsTableComponent implements OnInit {
    private store = inject(Store);

    @ViewChild(MatSort, {static: true}) sort!: MatSort;

    displayedColumns: string[] = [
        'timestamp',
        'level',
        'message',
    ];

    // Mockup log toolbar: rounded chip toggles (All / Info / Warn / Error) instead of a
    // multi-select dropdown. Values map to the canonical EventLogLevel; null = All (no
    // level filter). The filter model stays an array so the existing filterPredicate works.
    levelChips: { label: string; value: EventLogLevel | null }[] = [
        {label: 'All', value: null},
        {label: 'Info', value: EventLogLevel.Info},
        {label: 'Warn', value: EventLogLevel.Warning},
        {label: 'Error', value: EventLogLevel.Error},
    ];
    dataSource: MatTableDataSource<LogEntry> = new MatTableDataSource<LogEntry>();
    filterForm: FormGroup = new FormGroup<LogsFilterForm>({
        levels: new FormControl<string>(''),
        keywords: new FormControl<string>(''),
        jobs: new FormControl<string>(''),
    });
    jobs$: Observable<Job[]>;

    /** Display label for a level token — the enum stores 'warning' but the mockup shows WARN. */
    levelDisplay(level: string): string {
        return level === EventLogLevel.Warning ? 'warn' : level;
    }

    /** True when the given chip reflects the current filter (null chip = "All"/no filter). */
    isLevelActive(value: EventLogLevel | null): boolean {
        const selected = (this.filterForm.get('levels')?.value as string[] | string | null) ?? [];
        const arr = Array.isArray(selected) ? selected : (selected ? [selected] : []);
        return value === null ? arr.length === 0 : arr.includes(value);
    }

    /** Select a single level chip (or All to clear the level filter). */
    selectLevel(value: EventLogLevel | null): void {
        this.filterForm.get('levels')?.setValue(value === null ? [] : [value]);
    }

    constructor() {
        this.jobs$ = this.store.select(selectAllJobs).pipe(distinctUntilChanged());
    }

    ngOnInit() {
        this.dataSource.filterPredicate = filterPredicate;
        this.dataSource.sort = this.sort;

        this.store.select(selectAll).pipe(distinctUntilChanged()).subscribe(
            (logs) => {
                this.dataSource.data = [...logs].reverse();
            },
        );


        this.filterForm.valueChanges.pipe(
            debounceTime(200),
            distinctUntilChanged(),
            handleStreamError({retryCount: 3}),
        ).subscribe(
            () => {
                this.dataSource.filter = buildFilterString(this.filterForm.getRawValue());
            },
        );
    }
}
