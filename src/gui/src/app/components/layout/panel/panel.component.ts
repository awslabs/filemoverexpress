import { Component, input, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'fme-panel',
    imports: [],
    templateUrl: './panel.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrl: './panel.component.scss',
})
export class PanelComponent {
    panelClass = input<'default' | 'info' | 'success' | 'warning' | 'error'>('default');
}
