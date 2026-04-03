import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JobDetailsModalComponent } from './job-details-modal.component';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { JobDetailsData, TransferDirection } from '@app/interfaces/jobs-table';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { of } from 'rxjs';
import { MatPaginatorModule } from '@angular/material/paginator';

describe('JobDetailsModalComponent', () => {
    let component: JobDetailsModalComponent;
    let fixture: ComponentFixture<JobDetailsModalComponent>;

    const fmeClientSpy = jasmine.createSpyObj('FmeClientService', ['listTasksForJob']);
    fmeClientSpy.listTasksForJob.and.callFake((__unused: string) => {
        return of();
    });

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                NoopAnimationsModule,
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
                        source: '',
                        tasks: [],
                        started: new Date(),
                        completed: null,
                    } as JobDetailsData,
                },
                {provide: MatDialogRef, useValue: {}},
                {provide: FmeClientService, useValue: fmeClientSpy},
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
