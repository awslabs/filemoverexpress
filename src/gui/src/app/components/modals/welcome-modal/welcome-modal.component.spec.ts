import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WelcomeModalComponent } from './welcome-modal.component';
import { MatIconModule } from '@angular/material/icon';

describe('WelcomeModalComponent', () => {
    let component: WelcomeModalComponent;
    let fixture: ComponentFixture<WelcomeModalComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [MatIconModule],
        });
        fixture = TestBed.createComponent(WelcomeModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
