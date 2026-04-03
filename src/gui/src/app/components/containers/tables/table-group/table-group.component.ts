import { Component } from '@angular/core';
import { MatTab, MatTabGroup } from '@angular/material/tabs';
import { JobsTableComponent } from '@containers/tables/jobs-table/jobs-table.component';
import { LogsTableComponent } from '@containers/tables/logs-table/logs-table.component';
import { ReportsTableComponent } from '@containers/tables/reports-table/reports-table.component';

@Component({
    selector: 'fme-table-group',
    templateUrl: './table-group.component.html',
    styleUrls: ['./table-group.component.scss'],
    imports: [
        MatTabGroup,
        MatTab,
        JobsTableComponent,
        LogsTableComponent,
        ReportsTableComponent,
    ],
})
export class TableGroupComponent {

}
