import { NgTemplateOutlet } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatIcon } from '@angular/material/icon';
import { isElectronApp } from '@app/utils/utils';

@Component({
    selector: 'fme-hints-panel',
    templateUrl: './hints-panel.component.html',
    styleUrls: ['./hints-panel.component.scss'],
    imports: [MatIcon, NgTemplateOutlet],
})
export class HintsPanelComponent {
    private _bottomSheetRef = inject<MatBottomSheetRef<HintsPanelComponent>>(MatBottomSheetRef);
    mode = inject(MAT_BOTTOM_SHEET_DATA);

    openExternalLink(event: Event, url: string) {
        event.preventDefault();

        if (isElectronApp()) {
            window.fme?.externalLink(url).then();
        }
    }
}
