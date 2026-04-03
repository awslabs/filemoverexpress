import { TestBed } from '@angular/core/testing';
import { LogsService } from './logs.service';
import { provideMockStore } from '@ngrx/store/testing';
import { AppState } from '@app/state';
import { initialTestState } from '@state/test.state';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBarModule } from '@angular/material/snack-bar';

describe('LogsService', () => {
    let service: LogsService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [NoopAnimationsModule, MatSnackBarModule],
            providers: [
                provideMockStore<AppState>({initialState: initialTestState}),
            ],
        });
        service = TestBed.inject(LogsService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
