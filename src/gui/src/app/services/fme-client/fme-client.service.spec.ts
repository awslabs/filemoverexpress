import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FmeClientService } from './fme-client.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Overlay } from '@angular/cdk/overlay';
import { NotificationsService } from '../notifications/notifications.service';
import { AppState } from '@app/state';
import { provideMockStore } from '@ngrx/store/testing';
import { initialTestState } from '@state/test.state';

describe('FmeClientService', () => {
    let service: FmeClientService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                MatSnackBar,
                NotificationsService,
                Overlay,
                provideMockStore<AppState>({initialState: initialTestState}),
            ],
            imports: [],
        });
        service = TestBed.inject(FmeClientService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
