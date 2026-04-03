import { TestBed } from '@angular/core/testing';
import { ShutdownService } from '@services/shutdown/shutdown.service';
import { provideMockStore } from '@ngrx/store/testing';
import { AppState } from '@app/state';
import { initialTestState } from '@state/test.state';
import { StoreModule } from '@ngrx/store';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';

describe('ShutdownService', () => {
    let service: ShutdownService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                StoreModule,
                MatSnackBarModule,
                MatDialogModule,

            ],
            providers: [
                provideMockStore<AppState>({initialState: initialTestState}),
            ],
        });
        service = TestBed.inject(ShutdownService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
