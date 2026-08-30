import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DaemonSelectorDropdownComponent } from './daemon-selector-dropdown.component';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { AppState } from '@app/state';
import { provideMockStore } from '@ngrx/store/testing';
import { initialTestState } from '@state/test.state';
import { MatTooltipModule } from '@angular/material/tooltip';

describe('DaemonSelectorDropdownComponent', () => {
    let component: DaemonSelectorDropdownComponent;
    let fixture: ComponentFixture<DaemonSelectorDropdownComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                MatSnackBarModule,
                MatMenuModule,
                MatIconModule,
                MatDialogModule,
                MatTooltipModule,
            ],
            providers: [
                provideMockStore<AppState>({initialState: initialTestState}),
            ],
        });
        fixture = TestBed.createComponent(DaemonSelectorDropdownComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
