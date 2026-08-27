import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { BucketBrowserComponent } from '@app/components/layout/bucket-browser/bucket-browser.component';
import { DaemonBrowserComponent } from '@app/components/layout/daemon-browser/daemon-browser.component';

@Component({
    selector: 'fme-transfer',
    templateUrl: './transfer.component.html',
    styleUrls: ['./transfer.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        DaemonBrowserComponent,
        BucketBrowserComponent,
        MatIcon,
    ],
})
export class TransferComponent {

}
