import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AppState } from '@app/state';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { provideMockStore } from '@ngrx/store/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { StoreModule } from '@ngrx/store';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { initialTestState } from '@state/test.state';
import { appRoutes } from '@app/components/layout/shell/app.routes';
import { BehaviorSubject } from 'rxjs';
import { MetadataEvent } from '@events/core';
import { ConnectionState } from '@state/models/connection-state-model';

describe('configRouteGuard', () => {
    let location: Location;
    let router: Router;
    const mockMetadata$ = new BehaviorSubject<MetadataEvent>(new MetadataEvent());
    const mockConnectionState$ = new BehaviorSubject<ConnectionState>(ConnectionState.DISCONNECTED);

    const mockFmeClientService = {
        get metadata() {
            return mockMetadata$.asObservable();
        },
        get connectionState() {
            return mockConnectionState$.asObservable();
        },
    };

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                RouterTestingModule.withRoutes(appRoutes),
                MatSnackBarModule,
                StoreModule,
            ],
            providers: [
                { provide: FmeClientService, useValue: mockFmeClientService }, provideMockStore<AppState>({ initialState: initialTestState }),
            ],
        });
        location = TestBed.inject(Location);
        router = TestBed.inject(Router);
        router.initialNavigation();
    });

    it('should guard when edit config disabled', async () => {
        await router.navigate(['/home/config']);
        expect(location.path()).toBe('/home');
    });
});
