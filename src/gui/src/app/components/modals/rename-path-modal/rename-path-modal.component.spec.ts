import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RenamePathModalComponent } from './rename-path-modal.component';
import { ReactiveFormsModule } from '@angular/forms';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { provideMockStore } from '@ngrx/store/testing';
import { AppState } from '@app/state';
import { initialTestState } from '@state/test.state';
import { MatIconModule } from '@angular/material/icon';
import { PathType } from '@app/interfaces/paths';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';

describe('RenamePathModalComponent', () => {
    let component: RenamePathModalComponent;
    let fixture: ComponentFixture<RenamePathModalComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                ReactiveFormsModule,
                MatSnackBarModule,
                MatDialogModule,
                ReactiveFormsModule,
                MatFormFieldModule,
                MatInputModule,
                NoopAnimationsModule,
                MatBadgeModule,
                MatTooltipModule,
                MatIconModule,
                MatBottomSheetModule,
            ],
            providers: [
                provideMockStore<AppState>({initialState: initialTestState}),
                {
                    provide: MAT_DIALOG_DATA,
                    useValue: {
                        parentDirectory: '/Users/me/Desktop/',
                        objectToRename: 'my-file',
                        pathType: PathType.FILE,
                        osType: 'darwin',
                    },
                },
                {
                    provide: MatDialogRef,
                    useValue: {},
                },
            ],
        });
        fixture = TestBed.createComponent(RenamePathModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
