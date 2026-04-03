import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageModalComponent } from './message-modal.component';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';

describe('MessageModalComponent', () => {
    let component: MessageModalComponent;
    let fixture: ComponentFixture<MessageModalComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                MatDialogModule,
                MatBadgeModule,
                MatTooltipModule,
            ],
            providers: [
                MatDialog,
                {provide: MAT_DIALOG_DATA, useValue: {}},
                {provide: MatDialogRef, useValue: {}},
            ],
        });
        fixture = TestBed.createComponent(MessageModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
