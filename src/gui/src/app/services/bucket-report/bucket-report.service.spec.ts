import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BucketReportService } from './bucket-report.service';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { provideMockStore } from '@ngrx/store/testing';
import { AppState } from '@app/state';
import { initialTestState } from '@state/test.state';
import { StoreModule } from '@ngrx/store';

describe('BucketReportService', () => {
    let service: BucketReportService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                StoreModule, MatSnackBarModule,
            ],
            providers: [
                provideMockStore<AppState>({initialState: initialTestState}),
            ],
        });
        service = TestBed.inject(BucketReportService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
