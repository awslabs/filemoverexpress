import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SelectMenuDropdownComponent } from './select-menu-dropdown.component';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

describe('SelectMenuDropdownComponent', () => {
    let component: SelectMenuDropdownComponent;
    let fixture: ComponentFixture<SelectMenuDropdownComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                MatMenuModule,
                MatIconModule,
                MatTooltipModule,
            ],
        });
        fixture = TestBed.createComponent(SelectMenuDropdownComponent);
        fixture.componentRef.setInput('dropdownItems', []);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
