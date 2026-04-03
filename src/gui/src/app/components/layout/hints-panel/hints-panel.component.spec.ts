import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HintsPanelComponent } from './hints-panel.component';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetModule, MatBottomSheetRef } from '@angular/material/bottom-sheet';

describe('HintsPanelComponent', () => {
    let component: HintsPanelComponent;
    let fixture: ComponentFixture<HintsPanelComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                MatBottomSheetModule,
            ],
            providers: [
                {
                    provide: MAT_BOTTOM_SHEET_DATA,
                    useValue: {},
                }, {
                    provide: MatBottomSheetRef,
                    useValue: {},
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
