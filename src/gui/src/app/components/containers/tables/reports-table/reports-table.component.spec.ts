import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReportsTableComponent } from './reports-table.component';
import { StoreModule } from '@ngrx/store';
import { MatOptionModule } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatInputModule } from '@angular/material/input';
import { provideMockStore } from '@ngrx/store/testing';
import { AppState } from '@app/state';
import { initialTestState } from '@state/test.state';
import { MatSnackBarModule } from '@angular/material/snack-bar';

describe('ReportsTableComponent', () => {
    let component: ReportsTableComponent;
    let fixture: ComponentFixture<ReportsTableComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                MatSnackBarModule,
                StoreModule,
                MatOptionModule,
                MatTableModule,
                MatFormFieldModule,
                NoopAnimationsModule,
                MatInputModule,
            ],
            providers: [
                provideMockStore<AppState>({initialState: initialTestState}),
            ],
        });
        fixture = TestBed.createComponent(ReportsTableComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
