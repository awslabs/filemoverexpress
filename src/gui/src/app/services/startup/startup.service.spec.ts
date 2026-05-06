import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialogModule } from '@angular/material/dialog';
import { StartupService } from '@services/startup/startup.service';

describe('StartupService', () => {
    let service: StartupService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                MatDialogModule,
            ],
        });
        service = TestBed.inject(StartupService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
