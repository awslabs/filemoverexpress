import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileBrowserComponent } from './file-browser.component';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';

describe('FileBrowserComponent', () => {
    let component: FileBrowserComponent;
    let fixture: ComponentFixture<FileBrowserComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                MatTableModule,
                MatIconModule,
                NoopAnimationsModule,
                MatSnackBarModule,
                MatMenuModule,
            ],
        });
        fixture = TestBed.createComponent(FileBrowserComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
