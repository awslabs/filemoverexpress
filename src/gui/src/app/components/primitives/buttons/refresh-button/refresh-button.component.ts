import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { ButtonComponent } from '@app/components/primitives/buttons/button/button.component';

@Component({
    selector: 'fme-refresh-button',
    templateUrl: './refresh-button.component.html',
    styleUrls: ['./refresh-button.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
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
