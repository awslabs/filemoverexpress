import { NgTemplateOutlet } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatIcon } from '@angular/material/icon';
import { isPackagedApp } from '@app/utils/utils';
import { WailsService } from '@services/wails/wails.service';

@Component({
    selector: 'fme-hints-panel',
    templateUrl: './hints-panel.component.html',
    styleUrls: ['./hints-panel.component.scss'],
    imports: [MatIcon, NgTemplateOutlet],
})
export class HintsPanelComponent {
    private _bottomSheetRef = inject<MatBottomSheetRef<HintsPanelComponent>>(MatBottomSheetRef);
    private wails = inject(WailsService);
    mode = inject(MAT_BOTTOM_SHEET_DATA);

    openExternalLink(event: Event, url: string) {
        event.preventDefault();

        if (isPackagedApp()) {
            this.wails.externalLink(url).subscribe();
        }
    }
}
