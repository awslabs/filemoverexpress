import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransferSettingsModalComponent } from './transfer-settings-modal.component';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSelectModule } from '@angular/material/select';
import { of } from 'rxjs';
import { FmeClientService } from '@services/fme-client/fme-client.service';

describe('TransferSettingsModalComponent', () => {
    let component: TransferSettingsModalComponent;
    let fixture: ComponentFixture<TransferSettingsModalComponent>;

    // Minimal FmeClientService stub: the modal loads notification destinations in its
    // constructor via getConfiguration(). An empty notifications list keeps the notify
    // row hidden without pulling in the real service's transport dependencies.
    const fmeClientStub = {
        getConfiguration: () => of({notifications: {destinations: []}}),
    } as unknown as FmeClientService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                MatDialogModule,
                ScrollingModule,
                MatSlideToggleModule,
                FormsModule,
                ReactiveFormsModule,
                MatFormFieldModule,
                MatInputModule,
                MatTooltipModule,
                MatBadgeModule,
                MatSelectModule,
            ],
            providers: [
                MatDialog,
                {
                    provide: MAT_DIALOG_DATA,
                    useValue: {
                        objectsToTransfer: [],
                    },
                },
                {
                    provide: MatDialogRef,
                    useValue: {},
                },
                {
                    provide: FmeClientService,
                    useValue: fmeClientStub,
                },
            ],
        });
        fixture = TestBed.createComponent(TransferSettingsModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
