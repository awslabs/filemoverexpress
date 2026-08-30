import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HotFolderFormComponent } from './hot-folder-form.component';
import { provideMockStore } from '@ngrx/store/testing';
import { AppState } from '@app/state';
import { initialTestState } from '@state/test.state';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';

describe('HotFolderFormComponent', () => {
    let component: HotFolderFormComponent;
    let fixture: ComponentFixture<HotFolderFormComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                MatSnackBarModule,
                MatExpansionModule,
                ReactiveFormsModule,
                MatFormFieldModule,
                MatBadgeModule,
                MatTooltipModule,
            ],
            providers: [provideMockStore<AppState>({initialState: initialTestState})],
        });
        fixture = TestBed.createComponent(HotFolderFormComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
