import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BucketReportModalComponent } from './bucket-report-modal.component';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { StoreModule } from '@ngrx/store';
import { provideMockStore } from '@ngrx/store/testing';
import { AppState } from '@app/state';
import { initialTestState } from '@state/test.state';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';

describe('BucketReportModalComponent', () => {
    let component: BucketReportModalComponent;
    let fixture: ComponentFixture<BucketReportModalComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                MatDialogModule,
                MatSelectModule,
                MatFormFieldModule,
                StoreModule,
                MatSnackBarModule,
                MatBottomSheetModule,
                MatSlideToggleModule,
                ReactiveFormsModule,
                CommonModule,
                MatTooltipModule,
                MatBadgeModule,
            ],
            providers: [
                MatDialog,
                {
                    provide: MAT_DIALOG_DATA,
                    useValue: {},
                },
                {
                    provide: MatDialogRef,
                    useValue: {},
                },
                provideMockStore<AppState>({initialState: initialTestState}),
            ],
        });
        fixture = TestBed.createComponent(BucketReportModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
