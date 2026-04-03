import { TestBed } from '@angular/core/testing';
import { VersionService } from './version.service';
import { AppState } from '@app/state';
import { provideMockStore } from '@ngrx/store/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { initialTestState } from '@state/test.state';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('VersionService', () => {
    let service: VersionService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                MatSnackBarModule, NoopAnimationsModule,
            ],
            providers: [
                VersionService, provideMockStore<AppState>({initialState: initialTestState}),
            ],
        });
        service = TestBed.inject(VersionService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
