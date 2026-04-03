import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RefreshButtonComponent } from './refresh-button.component';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';

describe('RefreshButtonComponent', () => {
    let component: RefreshButtonComponent;
    let fixture: ComponentFixture<RefreshButtonComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                MatIconModule,
                MatTooltipModule,
                MatBadgeModule,
            ],
        });
        fixture = TestBed.createComponent(RefreshButtonComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
