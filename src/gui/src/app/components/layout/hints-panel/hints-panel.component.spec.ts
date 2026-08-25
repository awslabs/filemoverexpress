import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HINT_POPOVER_MODE, HintsPanelComponent } from './hints-panel.component';

describe('HintsPanelComponent', () => {
    let component: HintsPanelComponent;
    let fixture: ComponentFixture<HintsPanelComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                HintsPanelComponent,
            ],
            providers: [
                {
                    provide: HINT_POPOVER_MODE,
                    useValue: 'config',
                },
            ],
        })
            .compileComponents();

        fixture = TestBed.createComponent(HintsPanelComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
