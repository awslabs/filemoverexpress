import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VersionUpdateModalComponent } from './version-update-modal.component';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AppState } from '@app/state';
import { provideMockStore } from '@ngrx/store/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { StoreModule } from '@ngrx/store';
import { initialTestState } from '@state/test.state';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';

describe('VersionUpdateModalComponent', () => {
    let component: VersionUpdateModalComponent;
    let fixture: ComponentFixture<VersionUpdateModalComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                MatSnackBarModule,
                StoreModule,
                MatDialogModule,
                MatTooltipModule,
                MatBadgeModule,
            ],
            providers: [
                {
                    provide: MatDialogRef,
                    useValue: {},
                }, provideMockStore<AppState>({initialState: initialTestState}),
            ],
        });
        fixture = TestBed.createComponent(VersionUpdateModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
