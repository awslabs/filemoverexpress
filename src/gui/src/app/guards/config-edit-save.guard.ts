import { inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { UrlTree } from '@angular/router';
import { ConfirmationModalComponent } from '@app/components/modals/confirmation-modal/confirmation-modal.component';
import { ConfigComponent } from '@containers/forms/config/config.component';
import { Observable, Subject } from 'rxjs';

export function configEditSaveGuard(component: ConfigComponent): Observable<boolean | UrlTree> | boolean {
    const dialog = inject(MatDialog);
    if (component.configForm.dirty) {
        const output$ = new Subject<boolean | UrlTree>();
        const dialogRef = dialog.open(
            ConfirmationModalComponent,
            {
                width: '50%',
                data: {
                    cancelText: 'Keep Editing',
                    confirmText: 'Proceed',
                    message: 'It looks like you may have some unsaved changes. If you proceed all unsaved changes will be discarded',
                    title: 'Discard Unsaved Changes?',
                    confirmClass: 'primary',
                },
            },
        );
        dialogRef.afterClosed().subscribe((result) => {
            output$.next(result);
        });
        return output$.asObservable();
    }
    return true;
}
