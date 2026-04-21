import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfigureHotFolderModalComponent } from './configure-hot-folder-modal.component';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { provideMockStore } from '@ngrx/store/testing';
import { AppState } from '@app/state';
import { initialTestState } from '@state/test.state';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatExpansionModule } from '@angular/material/expansion';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MetadataService } from '@services/metadata/metadata.service';
import { of } from 'rxjs';

describe('ConfigureHotFolderModalComponent', () => {
    let component: ConfigureHotFolderModalComponent;
    let fixture: ComponentFixture<ConfigureHotFolderModalComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                NoopAnimationsModule,
                MatDialogModule,
                MatSnackBarModule,
                MatBottomSheetModule,
                MatExpansionModule,
                ReactiveFormsModule,
                MatFormFieldModule,
                MatBadgeModule,
                MatTooltipModule,
            ],
            providers: [
                MatDialog,
                {
                    provide: MAT_DIALOG_DATA,
                    useValue: {},
                },
                {
                    provide: MatDialogRef,
                    useValue: {},
                },
                {
                    provide: MetadataService,
                    useValue: {
                        onUpdate: of(false),
                        transferProfiles: {},
                    },
                },
                provideMockStore<AppState>({initialState: initialTestState}),
            ],
        });
        fixture = TestBed.createComponent(ConfigureHotFolderModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
