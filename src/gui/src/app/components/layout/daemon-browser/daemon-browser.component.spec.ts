import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DaemonBrowserComponent } from './daemon-browser.component';
import { AppState } from '@app/state';
import { provideMockStore } from '@ngrx/store/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { FormsModule } from '@angular/forms';
import { initialTestState } from '@state/test.state';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';

describe('DaemonBrowserComponent', () => {
    let component: DaemonBrowserComponent;
    let fixture: ComponentFixture<DaemonBrowserComponent>;

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
        fixture = TestBed.createComponent(DaemonBrowserComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
