import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MetadataService } from './metadata.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Overlay } from '@angular/cdk/overlay';
import { provideMockStore } from '@ngrx/store/testing';
import { AppState } from '@app/state';
import { initialTestState } from '@state/test.state';
import { FmeClientService } from '@services/fme-client/fme-client.service';

describe('MetadataService', () => {
    let service: MetadataService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [],
            providers: [
                MatSnackBar,
                FmeClientService,
                Overlay,
                provideMockStore<AppState>({initialState: initialTestState}),
            ],
        });
        service = TestBed.inject(MetadataService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
