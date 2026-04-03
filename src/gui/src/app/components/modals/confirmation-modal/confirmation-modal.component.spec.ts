import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ConfirmationModalComponent } from './confirmation-modal.component';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';

describe('ConfirmationModalComponent', () => {
    let component: ConfirmationModalComponent;
    let fixture: ComponentFixture<ConfirmationModalComponent>;

    beforeEach(waitForAsync(() => {
        TestBed.configureTestingModule({
            imports: [MatBadgeModule, MatTooltipModule],
            providers: [
                MatDialog,
                {provide: MAT_DIALOG_DATA, useValue: {}},
                {provide: MatDialogRef, useValue: {}},
            ],
        })
            .compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(ConfirmationModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
