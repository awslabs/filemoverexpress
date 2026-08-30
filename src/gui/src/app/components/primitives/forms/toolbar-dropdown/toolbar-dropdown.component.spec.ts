import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { AppState } from '@app/state';
import { StoreModule } from '@ngrx/store';
import { provideMockStore } from '@ngrx/store/testing';
import { initialTestState } from '@state/test.state';
import { ToolbarDropdownComponent } from './toolbar-dropdown.component';
import { provideRouter } from '@angular/router';

describe('ToolbarDropdownComponent', () => {
    let component: ToolbarDropdownComponent;
    let fixture: ComponentFixture<ToolbarDropdownComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                MatSnackBarModule,
                MatMenuModule,
                MatIconModule,
                MatDialogModule,
                MatDividerModule,
                StoreModule,
            ],
            providers: [
                provideMockStore<AppState>({initialState: initialTestState}), provideRouter([]),
            ],
        });
        fixture = TestBed.createComponent(ToolbarDropdownComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
