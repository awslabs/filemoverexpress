import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { map } from 'rxjs';
import { disconnect as fmeClientDisconnect } from '@state/fme-client/actions/fme-client.actions';
import { clearAll as clearAllJobs } from '@state/job/actions/job.actions';

@Injectable()
export class JobEffects {
    private actions$ = inject(Actions);

    clearJobsTableOnDisconnect$ = createEffect(
        () => {
            return this.actions$.pipe(
                ofType(fmeClientDisconnect),
                map(() => clearAllJobs()),
            );
        },
    );
}
