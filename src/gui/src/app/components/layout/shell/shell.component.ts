import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToolbarComponent } from '@app/components/layout/toolbar/toolbar.component';

@Component({
    selector: 'fme-root',
    templateUrl: './shell.component.html',
    styleUrls: ['./shell.component.scss'],
    imports: [ToolbarComponent, RouterOutlet],
})
export class ShellComponent {
}
