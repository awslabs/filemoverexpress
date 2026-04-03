import { Component } from '@angular/core';
import { TableGroupComponent } from '@containers/tables/table-group/table-group.component';
import { TransferComponent } from '@app/components/layout/transfer/transfer.component';

@Component({
    selector: 'fme-main',
    templateUrl: './main.component.html',
    styleUrls: ['./main.component.scss'],
    imports: [TableGroupComponent, TransferComponent],
})
export class MainComponent {
}
