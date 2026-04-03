import { TestBed } from '@angular/core/testing';
import { NotificationsService } from './notifications.service';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { StoreModule } from '@ngrx/store';
import { provideMockStore } from '@ngrx/store/testing';
import { AppState } from '@app/state';
import { initialTestState } from '@state/test.state';

describe('NotificationsService', () => {
    let service: NotificationsService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [MatSnackBarModule, StoreModule],
            providers: [
                provideMockStore<AppState>({initialState: initialTestState}),
            ],
        });
        service = TestBed.inject(NotificationsService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
