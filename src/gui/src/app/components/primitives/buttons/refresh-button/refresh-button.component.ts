import { Component, input, output } from '@angular/core';
import { ButtonComponent } from '@app/components/primitives/buttons/button/button.component';

@Component({
    selector: 'fme-refresh-button',
    templateUrl: './refresh-button.component.html',
    styleUrls: ['./refresh-button.component.scss'],
    imports: [
        ButtonComponent,
    ],
})
export class RefreshButtonComponent {
    disabled = input<boolean>(false);
    refreshTooltipMessage = input<string>('');
    showRefreshNotificationBadge = input<boolean>(false);
    refresh = output();

    emitRefresh() {
        return () => {
            this.refresh.emit();
        };
    }
}
