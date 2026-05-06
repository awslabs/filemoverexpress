import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TransferService } from './transfer.service';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { provideMockStore } from '@ngrx/store/testing';
import { AppState } from '@app/state';
import { initialTestState } from '@state/test.state';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('TransferService', () => {
    let service: TransferService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                MatSnackBarModule, NoopAnimationsModule,
            ],
            providers: [
                TransferService, provideMockStore<AppState>({initialState: initialTestState}),
            ],
        });
        service = TestBed.inject(TransferService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
