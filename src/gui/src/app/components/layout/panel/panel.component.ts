import { Component, input } from '@angular/core';

@Component({
    selector: 'fme-panel',
    imports: [],
    templateUrl: './panel.component.html',
    styleUrl: './panel.component.scss',
})
export class PanelComponent {
    panelClass = input<'default' | 'info' | 'success' | 'warning' | 'error'>('default');
}
