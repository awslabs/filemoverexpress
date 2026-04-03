import { Component } from '@angular/core';
import { BucketBrowserComponent } from '@app/components/layout/bucket-browser/bucket-browser.component';
import { DaemonBrowserComponent } from '@app/components/layout/daemon-browser/daemon-browser.component';

@Component({
    selector: 'fme-transfer',
    templateUrl: './transfer.component.html',
    styleUrls: ['./transfer.component.scss'],
    imports: [
        DaemonBrowserComponent, BucketBrowserComponent,
    ],
})
export class TransferComponent {

}
