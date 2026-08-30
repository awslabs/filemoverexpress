import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JobRenameModalComponent } from './job-rename-modal.component';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';

describe('JobRenameModalComponent', () => {
    let component: JobRenameModalComponent;
    let fixture: ComponentFixture<JobRenameModalComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                ReactiveFormsModule,
                MatFormFieldModule,
                MatInputModule,
                MatTooltipModule,
                MatBadgeModule,
            ],
            providers: [{provide: MAT_DIALOG_DATA, useValue: {jobName: 'old-job-name'}}, {provide: MatDialogRef, useValue: {}}],
        });
        fixture = TestBed.createComponent(JobRenameModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
