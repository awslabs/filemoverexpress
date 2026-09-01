import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { Subject, of, throwError } from 'rxjs';
import { LogsService } from './logs.service';
import { FmeClientService } from '@services/fme-client/fme-client.service';
import { BaseEvent } from '@app/interfaces/events';
import { MessageEvent, AlertEvent } from '@events/core';
import { addLog } from '@state/logs/actions/logs.actions';

// LogsService subscribes to fmeClientService.events$ in its constructor and calls
// fmeClientService.listJobNames() once. For every recognized event it dispatches an
// addLog action to the store. We stub FmeClientService with a controllable events$
// Subject and a listJobNames() we can point at success/error, and spy on Store.dispatch.
// events$ is a Subject driven synchronously in-test, so no queueMicrotask deferral is
// needed here (that is only for the callback-driven RPC methods on the real client).

describe('LogsService', () => {
    let events$: Subject<BaseEvent>;
    let dispatch: ReturnType<typeof vi.fn>;
    let listJobNames: ReturnType<typeof vi.fn>;

    function createService(): LogsService {
        events$ = new Subject<BaseEvent>();
        dispatch = vi.fn();
        listJobNames = vi.fn(() => of({}));

        const fmeClientStub: Partial<FmeClientService> = {
            get events$() {
                return events$.asObservable();
            },
            listJobNames: listJobNames as unknown as FmeClientService['listJobNames'],
        };

        TestBed.configureTestingModule({
            providers: [
                LogsService,
                {provide: Store, useValue: {dispatch}},
                {provide: FmeClientService, useValue: fmeClientStub},
            ],
        });
        return TestBed.inject(LogsService);
    }

    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    it('should be created and request job names once on construction', () => {
        const service = createService();
        expect(service).toBeTruthy();
        expect(listJobNames).toHaveBeenCalledTimes(1);
    });

    it('dispatches addLog for a MessageEvent with its message + level', () => {
        createService();
        events$.next(new MessageEvent('hello world', 'info'));
        expect(dispatch).toHaveBeenCalledWith(
            addLog({log: expect.objectContaining({message: 'hello world', level: 'info', jobId: null})}),
        );
    });

    it('dispatches addLog for an AlertEvent', () => {
        createService();
        events$.next(new AlertEvent('disk full', 'warning'));
        expect(dispatch).toHaveBeenCalledWith(
            addLog({log: expect.objectContaining({message: 'disk full', jobId: null})}),
        );
    });

    it('logs an error (no dispatch) for an unrecognized event type', () => {
        createService();
        const errSpy = vi.spyOn(console, 'error');
        // A bare BaseEvent that matches none of the instanceof branches.
        events$.next({logLevel: 'info', logMessage: 'x'} as unknown as BaseEvent);
        expect(errSpy).toHaveBeenCalled();
        expect(dispatch).not.toHaveBeenCalled();
    });

    it('handles a stream error without throwing', () => {
        createService();
        const errSpy = vi.spyOn(console, 'error');
        events$.error(new Error('stream blew up'));
        expect(errSpy).toHaveBeenCalled();
    });

    it('swallows a listJobNames error during construction', () => {
        events$ = new Subject<BaseEvent>();
        dispatch = vi.fn();
        listJobNames = vi.fn(() => throwError(() => new Error('no jobs')));
        const fmeClientStub: Partial<FmeClientService> = {
            get events$() {
                return events$.asObservable();
            },
            listJobNames: listJobNames as unknown as FmeClientService['listJobNames'],
        };
        TestBed.configureTestingModule({
            providers: [
                LogsService,
                {provide: Store, useValue: {dispatch}},
                {provide: FmeClientService, useValue: fmeClientStub},
            ],
        });
        // Construction must not throw even though listJobNames errors.
        expect(() => TestBed.inject(LogsService)).not.toThrow();
    });

    it('init() logs without error', () => {
        const service = createService();
        expect(() => service.init()).not.toThrow();
    });
});
