import { CdkCellDef } from '@angular/cdk/table';
import { Directive, Input } from '@angular/core';
import { MatCellDef, MatTableDataSource } from '@angular/material/table';
import { Observable } from 'rxjs';

@Directive({
    // Intentionally overriding the built-in selector mat-tables to enforce type safety in all tables
    // eslint-disable-next-line @angular-eslint/directive-selector
    selector: '[matCellDef]', // same selector as MatCellDef
    providers: [
        {
            provide: CdkCellDef,
            useExisting: TypeSafeMatCellDefDirective,
        },
    ],
})
export class TypeSafeMatCellDefDirective<T> extends MatCellDef {
    // leveraging syntactic-sugar syntax when we use *matCellDef
    @Input() matCellDefDataSource!: | T[] | Observable<T[]> | MatTableDataSource<T>;

    // ngTemplateContextGuard flag to help with the Language Service
    static ngTemplateContextGuard<T>(dir: TypeSafeMatCellDefDirective<T>, ctx: unknown): ctx is { $implicit: T; index: number } {
        return true;
    }
}
