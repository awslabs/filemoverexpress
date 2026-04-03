import { fakeAsync, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AppState } from '@app/state';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { provideMockStore } from '@ngrx/store/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { StoreModule } from '@ngrx/store';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { initialTestState } from '@state/test.state';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { appRoutes } from '@app/components/layout/shell/app.routes';

describe('configRouteGuard', () => {
    let location: Location;
    let router: Router;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                RouterTestingModule.withRoutes(appRoutes),
                MatSnackBarModule,
                StoreModule,
                NoopAnimationsModule,
            ],
            providers: [
                FmeClientService, provideMockStore<AppState>({initialState: initialTestState}),
            ],
        });
        location = TestBed.inject(Location);
        router = TestBed.inject(Router);
        router.initialNavigation();
    });

    it('should guard when edit config disabled', fakeAsync(() => {
        router.navigate(['/home/config']).then(() => {
            expect(location.path()).toBe('/home');
        });
    }));
});
