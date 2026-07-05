import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VersionUpdateComponent } from './version-update.component';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { StoreModule } from '@ngrx/store';
import { MatDialogModule } from '@angular/material/dialog';
import { AppState } from '@app/state';
import { provideMockStore } from '@ngrx/store/testing';
import { initialTestState } from '@state/test.state';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('VersionUpdateComponent', () => {
    let component: VersionUpdateComponent;
    let fixture: ComponentFixture<VersionUpdateComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                MatSnackBarModule,
                StoreModule,
                MatDialogModule,
                NoopAnimationsModule,
            ],
            providers: [
                provideMockStore<AppState>({initialState: initialTestState}),
            ],
        }).compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(VersionUpdateComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
