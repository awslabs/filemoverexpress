import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransferSettingsModalComponent } from './transfer-settings-modal.component';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatInputModule } from '@angular/material/input';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';

describe('TransferSettingsModalComponent', () => {
    let component: TransferSettingsModalComponent;
    let fixture: ComponentFixture<TransferSettingsModalComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                NoopAnimationsModule,
                MatDialogModule,
                ScrollingModule,
                MatSlideToggleModule,
                FormsModule,
                ReactiveFormsModule,
                MatFormFieldModule,
                MatInputModule,
                MatTooltipModule,
                MatBadgeModule,
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
