import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExportJobModalComponent } from './export-job-modal.component';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { StoreModule } from '@ngrx/store';
import { provideMockStore } from '@ngrx/store/testing';
import { AppState } from '@app/state';
import { initialTestState } from '@state/test.state';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { ReactiveFormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';

describe('ExportJobModalComponent', () => {
    let component: ExportJobModalComponent;
    let fixture: ComponentFixture<ExportJobModalComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                MatDialogModule,
                MatSelectModule,
                NoopAnimationsModule,
                MatFormFieldModule,
                StoreModule,
                MatSnackBarModule,
                MatBottomSheetModule,
                ReactiveFormsModule,
                MatTooltipModule,
                MatBadgeModule,
            ],
            providers: [{provide: MatDialogRef, useValue: {}}, provideMockStore<AppState>({initialState: initialTestState})],
        });
        fixture = TestBed.createComponent(ExportJobModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
