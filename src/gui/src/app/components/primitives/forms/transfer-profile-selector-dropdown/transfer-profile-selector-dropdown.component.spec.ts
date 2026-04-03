import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransferProfileSelectorDropdownComponent } from './transfer-profile-selector-dropdown.component';
import { AppState } from '@app/state';
import { provideMockStore } from '@ngrx/store/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { initialTestState } from '@state/test.state';
import { MatTooltipModule } from '@angular/material/tooltip';

describe('TransferProfileSelectorDropdownComponent', () => {
    let component: TransferProfileSelectorDropdownComponent;
    let fixture: ComponentFixture<TransferProfileSelectorDropdownComponent>;

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
        fixture = TestBed.createComponent(TransferProfileSelectorDropdownComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
