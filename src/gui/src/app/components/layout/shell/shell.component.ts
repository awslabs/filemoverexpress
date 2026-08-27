import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToolbarComponent } from '@app/components/layout/toolbar/toolbar.component';

@Component({
    selector: 'fme-root',
    templateUrl: './shell.component.html',
    styleUrls: ['./shell.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [ToolbarComponent, RouterOutlet],
})
export class ShellComponent {
}
