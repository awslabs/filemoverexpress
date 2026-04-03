import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BucketReportButtonComponent } from './bucket-report-button.component';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { provideMockStore } from '@ngrx/store/testing';
import { AppState } from '@app/state';
import { initialTestState } from '@state/test.state';
import { StoreModule } from '@ngrx/store';

describe('BucketReportButtonComponent', () => {
    let component: BucketReportButtonComponent;
    let fixture: ComponentFixture<BucketReportButtonComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                MatDialogModule,
                MatSnackBarModule,
                MatTooltipModule,
                MatBadgeModule,
                StoreModule,
            ],
            providers: [
                provideMockStore<AppState>({initialState: initialTestState}),
            ],
        });
        fixture = TestBed.createComponent(BucketReportButtonComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
