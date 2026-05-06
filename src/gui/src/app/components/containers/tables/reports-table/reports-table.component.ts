import { DatePipe } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatSort, MatSortHeader } from '@angular/material/sort';
import {
    MatCell,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatRow,
    MatRowDef,
    MatTable,
    MatTableDataSource,
} from '@angular/material/table';
import { InventoryReportStatus } from '@app/classes/inventory-report';
import { TypeSafeMatCellDefDirective } from '@app/directives/type-safe-mat-cell-def.directive';
import { BucketReportService } from '@services/bucket-report/bucket-report.service';
import { Subscription } from 'rxjs';
import { isPackagedApp } from '@app/utils/utils';
import { WailsService } from '@services/wails/wails.service';


const REMOTE_CONFIGURATION = 'remoteConfiguration';
const BUCKET = 'bucket';
const STATUS = 'status';
const STARTED = 'started';
const COMPLETED = 'completed';
const OUTPUT_FILE = 'outputFile';

@Component({
    selector: 'fme-reports-table',
    templateUrl: './reports-table.component.html',
    styleUrls: ['./reports-table.component.scss'],
    imports: [
        MatFormField,
        MatLabel,
        MatInput,
        MatTable,
        MatSort,
        MatSortHeader,
        MatColumnDef,
        MatHeaderCell,
        MatHeaderCellDef,
        MatCell,
        TypeSafeMatCellDefDirective,
        DatePipe,
        MatHeaderRow,
        MatHeaderRowDef,
        MatRowDef,
        MatRow,
    ],
})
export class ReportsTableComponent implements OnInit, OnDestroy {
    private bucketReport = inject(BucketReportService);
    private wails = inject(WailsService);

    @ViewChild(MatSort, {static: true}) sort!: MatSort;
    displayedColumns: string[] = [
        REMOTE_CONFIGURATION,
        BUCKET,
        STATUS,
        STARTED,
        COMPLETED,
        OUTPUT_FILE,
    ];
    dataSource: MatTableDataSource<InventoryReportStatus>;
    private subscriptions: Subscription[] = [];

    constructor() {
        this.dataSource = new MatTableDataSource<InventoryReportStatus>();
    }

    ngOnInit() {
        this.subscriptions.push(this.bucketReport.bucketReportData.subscribe({
            next: (bucketReportData) => {
                this.dataSource.data = bucketReportData;
            },
        }));
        this.dataSource.sort = this.sort;
    }

    ngOnDestroy() {
        this.subscriptions.map((sub) => sub.unsubscribe());
        this.subscriptions = [];
    }

    /**
     * Apply the filter to the report table
     * @param event Event
     */
    applyFilter(event: Event) {
        const filterValue: string = (event.target as HTMLInputElement).value;
        this.dataSource.filter = filterValue.trim().toLowerCase();
    }

    openItemInFolder(event: Event, filePath: string): void {
        event.preventDefault();
        event.stopPropagation();

        if (!isPackagedApp()) {
            return;
        }

        this.wails.systemShowItemInFolder(filePath).subscribe();
    }
}
