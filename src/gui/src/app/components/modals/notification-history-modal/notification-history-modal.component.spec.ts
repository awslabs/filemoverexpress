import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationHistoryModalComponent } from './notification-history-modal.component';
import { MatDialogRef } from '@angular/material/dialog';
import { provideMockStore } from '@ngrx/store/testing';
import { AppState } from '@app/state';
import { initialTestState } from '@state/test.state';
import { StoreModule } from '@ngrx/store';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSortModule } from '@angular/material/sort';
import { ReactiveFormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('NotificationHistoryModalComponent', () => {
    let component: NotificationHistoryModalComponent;
    let fixture: ComponentFixture<NotificationHistoryModalComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                StoreModule,
                MatBadgeModule,
                MatTooltipModule,
                MatSortModule,
                ReactiveFormsModule,
                MatTableModule,
                NoopAnimationsModule,
            ],
            providers: [{provide: MatDialogRef, useValue: {}}, provideMockStore<AppState>({initialState: initialTestState})],
        });

        fixture = TestBed.createComponent(NotificationHistoryModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
