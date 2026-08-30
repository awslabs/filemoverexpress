import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JobDetailsModalComponent } from './job-details-modal.component';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { JobDetailsData, TransferDirection } from '@app/interfaces/jobs-table';
import { JobStatus } from '@state/models/job.model';
import { provideMockStore } from '@ngrx/store/testing';
import { AppState } from '@app/state';
import { initialTestState } from '@state/test.state';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { of } from 'rxjs';
import { MatPaginatorModule } from '@angular/material/paginator';

describe('JobDetailsModalComponent', () => {
    let component: JobDetailsModalComponent;
    let fixture: ComponentFixture<JobDetailsModalComponent>;

    const fmeClientSpy = {
        listTasksForJob: vi.fn().mockImplementation((__unused: string) => {
            return of();
        }),
        getConfiguration: vi.fn().mockImplementation(() => {
            return of();
        }),
    };

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                MatDialogModule,
                MatTabsModule,
                MatTableModule,
                MatIconModule,
                MatProgressBarModule,
                FormsModule,
                ReactiveFormsModule,
                MatFormFieldModule,
                MatInputModule,
                MatTooltipModule,
                MatSnackBarModule,
                MatPaginatorModule,
            ],
            providers: [
                {
                    provide: MAT_DIALOG_DATA,
                    useValue: {
                        jobId: 'random-id',
                        jobName: 'job name',
                        direction: TransferDirection.Upload,
                        destination: '',
                        remoteConfiguration: '',
                        started: new Date('2026-08-11T13:39:32'),
                        completed: new Date('2026-08-11T13:39:40'),
                        status: JobStatus.Completed,
                        statusMessage: '',
                        totalBytes: 0,
                        bytesTransferred: 0,
                        progress: 0,
                        timestampTransferring: new Date('2026-08-11T13:39:32'),
                        hasTaskErrors: false,
                        hasSuccessfulTasks: false,
                    } as JobDetailsData,
                },
                {provide: MatDialogRef, useValue: {}},
                {provide: FmeClientService, useValue: fmeClientSpy},
                provideMockStore<AppState>({initialState: initialTestState}),
            ],
        });
        fixture = TestBed.createComponent(JobDetailsModalComponent);

        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
