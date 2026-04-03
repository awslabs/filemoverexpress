import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatSort, MatSortHeader } from '@angular/material/sort';
import {
    MatCell,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatNoDataRow,
    MatRow,
    MatRowDef,
    MatTable,
    MatTableDataSource,
} from '@angular/material/table';
import { TypeSafeMatCellDefDirective } from '@app/directives/type-safe-mat-cell-def.directive';
import { clear } from '@app/state/notifications/actions/notifications.actions';
import { selectAll } from '@app/state/notifications/notifications.selectors';
import { Store } from '@ngrx/store';
import { ButtonComponent } from '@primitives/buttons/button/button.component';
import { FTNotification } from '@state/models/notifications.model';

@Component({
    selector: 'fme-notification-history-modal',
    templateUrl: './notification-history-modal.component.html',
    styleUrl: './notification-history-modal.component.scss',
    imports: [
        MatDialogTitle,
        MatDialogContent,
        MatTable,
        MatColumnDef,
        MatHeaderCell,
        MatHeaderCellDef,
        MatCell,
        TypeSafeMatCellDefDirective,
        DatePipe,
        MatSortHeader,
        MatSort,
        TitleCasePipe,
        MatHeaderRow,
        MatHeaderRowDef,
        MatRow,
        MatRowDef,
        MatNoDataRow,
        MatDialogActions,
        ButtonComponent,
    ],
})
export class NotificationHistoryModalComponent implements OnInit {
    dialogRef = inject<MatDialogRef<NotificationHistoryModalComponent>>(MatDialogRef);
    store = inject(Store);

    @ViewChild(MatSort, {static: true}) sort!: MatSort;

    dataSource: MatTableDataSource<FTNotification>;
    columns = [
        'timestamp',
        'level',
        'message',
    ];

    constructor() {
        this.dataSource = new MatTableDataSource<FTNotification>();
    }

    ngOnInit() {
        this.dataSource.sort = this.sort;
        this.store.select(selectAll).subscribe((notifications) => {
            this.dataSource.data = notifications;
        });
    }

    clear() {
        return () => {
            this.store.dispatch(clear());
            this.dialogRef.close();
        };
    }

    close() {
        return () => {
            this.dialogRef.close();
        };
    }
}
