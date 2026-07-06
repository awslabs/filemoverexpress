import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ExportService } from './export.service';
import { AppState } from '@app/state';
import { provideMockStore } from '@ngrx/store/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { initialTestState } from '@state/test.state';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('ExportService', () => {
    let service: ExportService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                MatSnackBarModule, NoopAnimationsModule,
            ],
            providers: [
                ExportService, provideMockStore<AppState>({initialState: initialTestState}),
            ],
        });
        service = TestBed.inject(ExportService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
