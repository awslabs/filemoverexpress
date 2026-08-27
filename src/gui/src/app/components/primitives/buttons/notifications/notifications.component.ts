import { AsyncPipe } from '@angular/common';
import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { NotificationHistoryModalComponent } from '@app/components/modals/notification-history-modal/notification-history-modal.component';
import { Store } from '@ngrx/store';
import { FTNotification } from '@state/models/notifications.model';
import { selectAll } from '@state/notifications/notifications.selectors';
import { Observable } from 'rxjs';

@Component({
    selector: 'fme-notifications',
    templateUrl: './notifications.component.html',
    styleUrls: ['./notifications.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        MatIconButton,
        MatIcon,
        AsyncPipe,
    ],
})
export class NotificationsComponent {
    private store = inject(Store);
    private dialog = inject(MatDialog);

    notifications$: Observable<FTNotification[]>;

    constructor() {
        this.notifications$ = this.store.select(selectAll);
    }

    showNotifications() {
        this.dialog.open<NotificationHistoryModalComponent>(
            NotificationHistoryModalComponent,
            {
                width: '45vw',
            },
        );
    }
}
