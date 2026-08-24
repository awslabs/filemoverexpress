import { inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { UrlTree } from '@angular/router';
import { ConfirmationModalComponent } from '@app/components/modals/confirmation-modal/confirmation-modal.component';
import { discardUnsavedChangesDialog } from '@app/components/modals/confirmation-modal/confirmation-modal.constants';
import { ConfigComponent } from '@containers/forms/config/config.component';
import { Observable, Subject } from 'rxjs';

export function configEditSaveGuard(component: ConfigComponent): Observable<boolean | UrlTree> | boolean {
    const dialog = inject(MatDialog);
    if (component.configForm.dirty) {
        const output$ = new Subject<boolean | UrlTree>();
        const dialogRef = dialog.open(ConfirmationModalComponent, discardUnsavedChangesDialog);
        dialogRef.afterClosed().subscribe((result) => {
            output$.next(result);
        });
        return output$.asObservable();
    }
    return true;
}
