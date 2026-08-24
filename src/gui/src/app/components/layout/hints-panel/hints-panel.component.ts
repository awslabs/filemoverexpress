import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, InjectionToken } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { isPackagedApp } from '@app/utils/utils';
import { WailsService } from '@services/wails/wails.service';

/** The hint "mode" (which help section to show), supplied by HintPopoverService via the portal injector. */
export const HINT_POPOVER_MODE = new InjectionToken<string>('HINT_POPOVER_MODE');

@Component({
    selector: 'fme-hints-panel',
    templateUrl: './hints-panel.component.html',
    styleUrls: ['./hints-panel.component.scss'],
    imports: [MatIcon, NgTemplateOutlet],
})
export class HintsPanelComponent {
    private wails = inject(WailsService);
    mode = inject(HINT_POPOVER_MODE);

    openExternalLink(event: Event, url: string) {
        event.preventDefault();

        if (isPackagedApp()) {
            this.wails.externalLink(url).subscribe();
        }
    }
}
