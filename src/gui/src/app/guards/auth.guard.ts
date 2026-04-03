import { inject } from '@angular/core';
import { combineLatest, Observable, of } from 'rxjs';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { switchMap } from 'rxjs/operators';
import { Router, UrlTree } from '@angular/router';
import { ConnectionState } from '@state/models/connection-state-model';

export function configRouteGuard(): Observable<boolean | UrlTree> {
    const progress = inject(FmeClientService);
    const router = inject(Router);

    return combineLatest([
        progress.metadata, progress.connectionState,
    ]).pipe(
        switchMap((
            [
                evt, connStatus,
            ],
        ) => {
            return of(evt.permissions.allowUiConfiguration && connStatus == ConnectionState.CONNECTED ? true : router.parseUrl('/home'));
        }),
    );
}
