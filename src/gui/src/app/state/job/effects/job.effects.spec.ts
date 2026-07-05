import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { Observable, of } from 'rxjs';
import { Action } from '@ngrx/store';
import { JobEffects } from './job.effects';
import { disconnect } from '@state/fme-client/actions/fme-client.actions';
import { clearAll } from '@state/job/actions/job.actions';
import { AppState } from '@app/state';
import { initialTestState } from '@state/test.state';
import { firstValueFrom } from 'rxjs';

describe('JobEffects', () => {
    let effects: JobEffects;
    let actions$: Observable<Action>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                JobEffects,
                provideMockActions(() => actions$),
                provideMockStore<AppState>({ initialState: initialTestState }),
            ],
        });

        effects = TestBed.inject(JobEffects);
    });

    it('should be created', () => {
        expect(effects).toBeTruthy();
    });

    describe('clearJobsTableOnDisconnect$', () => {
        it('should dispatch clearAll action when disconnect action is dispatched', async () => {
            actions$ = of(disconnect());

            const result = await firstValueFrom(effects.clearJobsTableOnDisconnect$);

            expect(result).toEqual(clearAll());
        });

        it('should emit clearAll action with correct type', async () => {
            actions$ = of(disconnect());

            const result = await firstValueFrom(effects.clearJobsTableOnDisconnect$);

            expect(result.type).toBe('[Job Service] Clear All Jobs');
        });
    });
});
