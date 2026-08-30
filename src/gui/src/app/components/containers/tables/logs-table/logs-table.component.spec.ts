import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LogsTableComponent } from './logs-table.component';
import { StoreModule } from '@ngrx/store';
import { provideMockStore } from '@ngrx/store/testing';
import { MatMenuModule } from '@angular/material/menu';
import { MatOptionModule } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { AppState } from '@app/state';
import { MatSelectModule } from '@angular/material/select';
import { initialTestState } from '@state/test.state';
import { MatInputModule } from '@angular/material/input';

describe('LogsTableComponent', () => {
    let component: LogsTableComponent;
    let fixture: ComponentFixture<LogsTableComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                StoreModule,
                MatMenuModule,
                MatOptionModule,
                MatTableModule,
                ReactiveFormsModule,
                MatFormFieldModule,
                MatSelectModule,
                MatInputModule,
            ],
            providers: [
                provideMockStore<AppState>({initialState: initialTestState}),
            ],
        });
        fixture = TestBed.createComponent(LogsTableComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
