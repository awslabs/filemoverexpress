import { describe, it, expect, beforeEach } from 'vitest';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { TypeSafeMatCellDefDirective } from './type-safe-mat-cell-def.directive';

interface TestRow {
    id: number;
    name: string;
}

@Component({
    template: `
        <table mat-table [dataSource]="dataSource">
            <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Name</th>
                <td mat-cell *matCellDef="let row; dataSource: dataSource">{{ row.name }}</td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
        </table>
    `,
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatTableModule, TypeSafeMatCellDefDirective],
})
class HostComponent {
    displayedColumns = ['name'];
    dataSource = new MatTableDataSource<TestRow>([
        { id: 1, name: 'Alice' }, { id: 2, name: 'Bob' },
    ]);
}

describe('TypeSafeMatCellDefDirective', () => {
    let fixture: ComponentFixture<HostComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HostComponent],
        });
        fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
    });

    it('should create the host component with the directive applied', () => {
        expect(fixture.componentInstance).toBeTruthy();
    });

    it('should render table rows with data from the dataSource', () => {
        const rows = fixture.nativeElement.querySelectorAll('tr.mat-mdc-row');
        expect(rows.length).toBe(2);
    });

    it('should render cell content with type-safe access to row properties', () => {
        const cells = fixture.nativeElement.querySelectorAll('td.mat-mdc-cell');
        expect(cells[0].textContent.trim()).toBe('Alice');
        expect(cells[1].textContent.trim()).toBe('Bob');
    });

    it('should provide ngTemplateContextGuard that returns true', () => {
        // ngTemplateContextGuard is a static method used by the Angular Language Service
        // for type narrowing — it always returns true
        const result = TypeSafeMatCellDefDirective.ngTemplateContextGuard(
            {} as TypeSafeMatCellDefDirective<TestRow>,
            {},
        );
        expect(result).toBe(true);
    });

    it('should update rendered content when dataSource changes', () => {
        fixture.componentInstance.dataSource.data = [
            { id: 3, name: 'Charlie' },
        ];
        fixture.detectChanges();

        const cells = fixture.nativeElement.querySelectorAll('td.mat-mdc-cell');
        expect(cells.length).toBe(1);
        expect(cells[0].textContent.trim()).toBe('Charlie');
    });
});
