import { NgClass, NgTemplateOutlet } from '@angular/common';
import { AfterViewInit, Component, inject, OnDestroy, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatIconButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatPaginator } from '@angular/material/paginator';
import { MatProgressBar } from '@angular/material/progress-bar';
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
import { MatTab, MatTabChangeEvent, MatTabGroup } from '@angular/material/tabs';
import { MatTooltip } from '@angular/material/tooltip';
import { Task } from '@app/classes/grpc/task';
import { TaskCounts } from '@app/components/modals/job-details-modal/job-details-modal.interfaces';
import { TypeSafeMatCellDefDirective } from '@app/directives/type-safe-mat-cell-def.directive';
import { JobDetailsData, ObjectType, TaskElement, TransferDirection } from '@app/interfaces/jobs-table';
import { TaskTableStatusClassPipe } from '@app/pipes/jobs-table-status.pipe';
import { TaskStatusPipe } from '@app/pipes/task-status.pipe';
import { TextEllipsesPipe } from '@app/pipes/text-ellipses.pipe';
import { buildFilterString, tasksTableFilterPredicate } from '@app/utils/transfer-utils';
import { stringToTaskStatus } from '@app/utils/utils';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { TaskStatus } from '@state/models/job.model';
import { debounceTime, finalize } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';

const TASK_RELOAD_INTERVAL = 5000;
const PENDING_STATES = [
    TaskStatus.Queued,
    TaskStatus.Checksumming,
    TaskStatus.InProgress,
    TaskStatus.Paused,
];
const SKIPPED_STATES = [TaskStatus.Skipped, TaskStatus.Cancelled];

@Component({
    selector: 'fme-job-details-modal',
    templateUrl: './job-details-modal.component.html',
    styleUrls: ['./job-details-modal.component.scss'],
    imports: [
        MatDialogTitle,
        MatIconButton,
        MatDialogClose,
        MatIcon,
        MatDialogContent,
        MatTooltip,
        TextEllipsesPipe,
        MatTabGroup,
        MatTab,
        MatPaginator,
        ReactiveFormsModule,
        MatFormField,
        MatLabel,
        MatInput,
        MatTable,
        MatColumnDef,
        MatHeaderCell,
        MatCell,
        MatHeaderCellDef,
        TaskTableStatusClassPipe,
        MatProgressBar,
        NgClass,
        TypeSafeMatCellDefDirective,
        TaskStatusPipe,
        MatNoDataRow,
        MatHeaderRow,
        MatRow,
        MatHeaderRowDef,
        MatRowDef,
        NgTemplateOutlet,
    ],
})
export class JobDetailsModalComponent implements AfterViewInit, OnDestroy {
    private fmeClientService = inject(FmeClientService);

    @ViewChild(MatPaginator) paginator!: MatPaginator;

    protected readonly MAX_INFO_STRING_LENGTH = 32;
    protected readonly MAX_TABLE_STRING_LENGTH = 56;
    private refreshTimer: number | null = null;
    filterForm = new FormGroup({
        term: new FormControl<string>(''),
        status: new FormControl<string[]>([]),
    });

    tasksLoaded = false;
    displayedColumns: string[] = [
        'name',
        'progress',
        'status',
    ];
    dataSource: MatTableDataSource<TaskElement>;
    jobDetails: JobDetailsData = {
        jobId: '',
        jobName: '',
        direction: TransferDirection.Upload,
        destination: '',
        remoteConfiguration: '',
        started: new Date(),
        completed: null,
    };
    counts: TaskCounts = {
        total: 0,
        pending: 0,
        completed: 0,
        skipped: 0,
        failed: 0,
    };

    constructor() {
        const data = inject<JobDetailsData>(MAT_DIALOG_DATA);

        this.dataSource = new MatTableDataSource<TaskElement>();
        this.dataSource.filterPredicate = tasksTableFilterPredicate;
        this.jobDetails = data;

        if (this.jobDetails.destination === '') {
            this.jobDetails.destination = '/';
        }

        this.loadTasks();
        this.filterForm.valueChanges.pipe(
            debounceTime(200),
            distinctUntilChanged(),
        ).subscribe(
            () => {
                this.dataSource.filter = buildFilterString(this.filterForm.getRawValue());
            },
        );
        this.dataSource.filter = buildFilterString(this.filterForm.getRawValue());
    }

    ngAfterViewInit() {
        this.dataSource.paginator = this.paginator;
    }

    ngOnDestroy() {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
    }

    /**
     * Fetch and process all tasks for the job
     */
    loadTasks() {
        const taskData: TaskElement[] = [];

        this.fmeClientService.listTasksForJob(this.jobDetails.jobId).pipe(
            finalize(
                () => {
                    this.dataSource.data = [...taskData].sort(
                        (a, b) => a.name < b.name ? -1 : 1,
                    );
                    this.dataSource.filter = buildFilterString(this.filterForm.getRawValue());
                    const newCounts: TaskCounts = {
                        total: 0,
                        pending: 0,
                        completed: 0,
                        skipped: 0,
                        failed: 0,
                    };

                    for (const task of this.dataSource.data) {
                        if (PENDING_STATES.includes(task.status)) {
                            newCounts.pending++;
                        } else if (SKIPPED_STATES.includes(task.status)) {
                            newCounts.skipped++;
                        } else {
                            switch (task.status) {
                                case TaskStatus.Completed:
                                    newCounts.completed++;
                                    break;

                                case TaskStatus.Error:
                                    newCounts.failed++;
                                    break;

                                default:
                                    console.debug(`Got a task with an unexpected status: ${task.status}`);
                            }
                        }
                        newCounts.total++;
                    }
                    this.counts = {...newCounts};
                    this.refreshTimer = window.setTimeout(this.loadTasks.bind(this), TASK_RELOAD_INTERVAL);
                    this.tasksLoaded = true;
                },
            ),
        ).subscribe(
            (task) => {
                taskData.push(this.processTask(task));
            },
        );
    }

    /**
     * Converts a Task objects into a TaskElement for display
     *
     * @param task {Task} Task to convert
     * @returns {TaskElement} Returns a TaskElement
     * @private
     */
    private processTask(task: Task): TaskElement {
        let source: string;
        let totalBytes: number;

        if (task.direction === 'DOWNLOAD') {
            source = task.s3Object.key;
            totalBytes = task.s3Object.size;
        } else {
            source = task.localFile.path;
            totalBytes = task.localFile.size;
        }

        let taskProgress = totalBytes ? Number(((task.bytesTransferred / totalBytes) * 100).toFixed(2)) : 100;
        if (isNaN(taskProgress)) {
            taskProgress = 0;
        }

        if (task.status === 'COMPLETED') {
            taskProgress = 100;
        }

        return {
            name: source,
            progress: taskProgress,
            status: stringToTaskStatus(task.status),
            type: ObjectType.File,
        };
    }

    onTabClick(event: MatTabChangeEvent) {
        if (event.index === 0) {
            this.filterForm.controls.status.setValue([]);
            this.displayedColumns = [
                'name',
                'progress',
                'status',
            ];
        } else if (event.index === 1) {
            this.filterForm.controls.status.setValue([...PENDING_STATES]);
            this.displayedColumns = ['name'];
        } else if (event.index === 2) {
            this.filterForm.controls.status.setValue(['COMPLETED']);
            this.displayedColumns = ['name'];
        } else if (event.index === 3) {
            this.filterForm.controls.status.setValue([...SKIPPED_STATES]);
            this.displayedColumns = ['name'];
        } else if (event.index === 4) {
            this.filterForm.controls.status.setValue(['ERROR']);
            this.displayedColumns = ['name', 'progress'];
        }
    }
}
