import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BucketBrowserComponent } from './bucket-browser.component';
import { AppState } from '@app/state';
import { provideMockStore } from '@ngrx/store/testing';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { FormsModule } from '@angular/forms';
import { initialTestState } from '@state/test.state';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { FileBrowserState } from '../file-browser/file-browser.interfaces';

describe('BucketBrowserComponent', () => {
    let component: BucketBrowserComponent;
    let fixture: ComponentFixture<BucketBrowserComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                MatDialogModule,
                MatSnackBarModule,
                MatTableModule,
                MatIconModule,
                MatMenuModule,
                FormsModule,
                NoopAnimationsModule,
                MatTooltipModule,
                MatBadgeModule,
            ],
            providers: [
                provideMockStore<AppState>({initialState: initialTestState}),
            ],
        });
        fixture = TestBed.createComponent(BucketBrowserComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should navigate to starting directory when onOidcAuthChange receives true', () => {
        const spy = vi.spyOn(component, 'navigateToPath');
        component.onOidcAuthChange(true);
        expect(spy).toHaveBeenCalledWith(component.getStartingDirectory());
    });

    it('should clear file listing when onOidcAuthChange receives false', () => {
        component.onOidcAuthChange(false);
        expect(component.fileBrowserData.state).toBe(FileBrowserState.ERROR);
        expect(component.fileBrowserData.list).toEqual([]);
        expect(component.fileBrowserData.error?.title).toBe('Sign In Required');
    });
});
