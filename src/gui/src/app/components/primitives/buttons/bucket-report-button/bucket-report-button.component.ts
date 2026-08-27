import { Component, inject, input, ChangeDetectionStrategy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { BucketReportModalComponent } from '@app/components/modals/bucket-report-modal/bucket-report-modal.component';
import { ButtonComponent } from '@app/components/primitives/buttons/button/button.component';

@Component({
    selector: 'fme-bucket-report-button',
    templateUrl: './bucket-report-button.component.html',
    styleUrls: ['./bucket-report-button.component.scss'],
    imports: [
        ButtonComponent,
    ],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: true,
})
export class BucketReportButtonComponent {
    dialog = inject(MatDialog);
    public disabled = input<boolean>(false);

    openBucketReportModal() {
        return () => {
            this.dialog.open(BucketReportModalComponent, {width: '40%', maxWidth: '600px', autoFocus: 'dialog'});
        };
    }
}
