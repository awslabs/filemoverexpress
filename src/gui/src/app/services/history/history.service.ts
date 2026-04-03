import { inject, Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { handleStreamError } from '@app/classes/rxjs-operators';
import { NotificationsService } from '../notifications/notifications.service';
import { DEFAULT_URL } from './history.constants';

@Injectable({
    providedIn: 'root',
})
export class HistoryService {
    private router = inject(Router);
    private notifications = inject(NotificationsService);

    previousUrl: string = DEFAULT_URL;
    currentUrl: string = DEFAULT_URL;

    constructor() {
        this.router.events.pipe(
            filter((event) => event instanceof NavigationEnd),
            handleStreamError({retryCount: 5}),
        ).subscribe({
            next: (event) => {
                if (event instanceof NavigationEnd) {
                    this.previousUrl = this.currentUrl || DEFAULT_URL;
                    this.currentUrl = event.url;
                }
            },
            error: (error) => {
                this.notifications.notifyStreamError(error);
            },
        });
    }

    redirectToPrevious() {
        if (this.previousUrl) {
            this.router.navigate([
                this.previousUrl,
            ]).then((navigationSuccessful) => {
                if (!navigationSuccessful) {
                    console.error(`Unable to navigate back to ${this.previousUrl}`);
                }
            });
        }
    }
}
