import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransferProfileFormComponent } from './transfer-profile-form.component';
import { AppState } from '@app/state';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { StoreModule } from '@ngrx/store';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { provideMockStore } from '@ngrx/store/testing';
import { initialTestState } from '@state/test.state';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { FmeClientService } from '@services/fme-client/fme-client.service';

describe('TransferProfileFormComponent', () => {
    let component: TransferProfileFormComponent;
    let fixture: ComponentFixture<TransferProfileFormComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                MatExpansionModule,
                MatDialogModule,
                ReactiveFormsModule,
                MatInputModule,
                MatSelectModule,
                MatFormFieldModule,
                MatSlideToggleModule,
                MatTooltipModule,
                MatChipsModule,
                NoopAnimationsModule,
                MatSnackBarModule,
                StoreModule,
                MatAutocompleteModule,
            ],
            providers: [
                MatDialog,
                MatBottomSheet,
                FmeClientService,
                provideMockStore<AppState>({initialState: initialTestState}),
            ],
        })
            .compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(TransferProfileFormComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
