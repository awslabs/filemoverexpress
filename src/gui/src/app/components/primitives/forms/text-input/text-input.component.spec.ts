import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextInputComponent } from './text-input.component';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';

describe('TextInputComponent', () => {
    let component: TextInputComponent;
    let fixture: ComponentFixture<TextInputComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [MatIconModule, FormsModule],
        });
        fixture = TestBed.createComponent(TextInputComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
