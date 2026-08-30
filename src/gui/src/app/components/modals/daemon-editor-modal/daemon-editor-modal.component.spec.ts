import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DaemonEditorModalComponent } from './daemon-editor-modal.component';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';

describe('DaemonEditorComponent', () => {
    let component: DaemonEditorModalComponent;
    let fixture: ComponentFixture<DaemonEditorModalComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                MatDialogModule,
                RouterModule,
                MatFormFieldModule,
                MatSlideToggleModule,
                ReactiveFormsModule,
                MatInputModule,
                MatBottomSheetModule,
                MatTooltipModule,
                MatBadgeModule,
            ],
            providers: [
                MatDialog,
                {
                    provide: MAT_DIALOG_DATA,
                    useValue: {},
                },
                {
                    provide: MatDialogRef,
                    useValue: {},
                },
            ],
        })
            .compileComponents();

        fixture = TestBed.createComponent(DaemonEditorModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
