import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationModalComponent } from './confirmation-modal.component';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';

describe('ConfirmationModalComponent', () => {
    let component: ConfirmationModalComponent;
    let fixture: ComponentFixture<ConfirmationModalComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [MatBadgeModule, MatTooltipModule],
            providers: [
                MatDialog,
                {provide: MAT_DIALOG_DATA, useValue: {}},
                {provide: MatDialogRef, useValue: {}},
            ],
        })
            .compileComponents();

        fixture = TestBed.createComponent(ConfirmationModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('does not gate confirm when no acknowledgement is required', () => {
        component.config.acknowledgeText = undefined;
        expect(component.confirmDisabled).toBe(false);
    });

    it('gates confirm until the acknowledgement is checked', () => {
        component.config.acknowledgeText = 'I understand.';
        component.acknowledged = false;
        expect(component.confirmDisabled).toBe(true);

        component.acknowledged = true;
        expect(component.confirmDisabled).toBe(false);
    });

    it('confirm() does not close while the acknowledgement is unchecked', () => {
        const closeSpy = vi.spyOn(component, 'close').mockImplementation(() => undefined);
        component.config.acknowledgeText = 'I understand.';
        component.acknowledged = false;

        component.confirm()();
        expect(closeSpy).not.toHaveBeenCalled();

        component.acknowledged = true;
        component.confirm()();
        expect(closeSpy).toHaveBeenCalledWith(true);
    });
});
