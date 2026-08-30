import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TransferProfileService } from './transfer-profile.service';
import { AppState } from '@app/state';
import { provideMockStore } from '@ngrx/store/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { initialTestState } from '@state/test.state';

describe('TransferProfileService', () => {
    let service: TransferProfileService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                MatSnackBarModule, MatDialogModule,
            ],
            providers: [
                provideMockStore<AppState>({initialState: initialTestState}),
            ],
        });
        service = TestBed.inject(TransferProfileService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
