import { describe, it, expect } from 'vitest';
import { Action } from '@ngrx/store';
import { initialState, reducer, uiContextFeatureKey } from './ui-context.reducer';
import * as UiContextActions from '../actions/ui-context.actions';

describe('UiContext Reducer', () => {
    describe('initial state', () => {
        it('should have daemonBrowserPath as empty string', () => {
            expect(initialState.daemonBrowserPath).toBe('');
        });

        it('should have bucketBrowserPath as empty string', () => {
            expect(initialState.bucketBrowserPath).toBe('');
        });
    });

    describe('uiContextFeatureKey', () => {
        it('should equal "uiContext"', () => {
            expect(uiContextFeatureKey).toBe('uiContext');
        });
    });

    describe('unknown action', () => {
        it('should return the previous state', () => {
            const action = {} as Action;

            const result = reducer(initialState, action);

            expect(result).toBe(initialState);
        });
    });

    describe('setDaemonBrowserPath', () => {
        it('should update daemonBrowserPath', () => {
            const path = '/media/footage';
            const action = UiContextActions.setDaemonBrowserPath({ path });

            const result = reducer(initialState, action);

            expect(result.daemonBrowserPath).toBe(path);
        });
    });

    describe('clearDaemonBrowserPath', () => {
        it('should reset daemonBrowserPath to empty string', () => {
            const previousState = { ...initialState, daemonBrowserPath: '/media/footage' };
            const action = UiContextActions.clearDaemonBrowserPath();

            const result = reducer(previousState, action);

            expect(result.daemonBrowserPath).toBe('');
        });
    });

    describe('setBucketBrowserPath', () => {
        it('should update bucketBrowserPath', () => {
            const path = '/project/dailies';
            const action = UiContextActions.setBucketBrowserPath({ path });

            const result = reducer(initialState, action);

            expect(result.bucketBrowserPath).toBe(path);
        });
    });

    describe('clearBucketBrowserPath', () => {
        it('should reset bucketBrowserPath to empty string', () => {
            const previousState = { ...initialState, bucketBrowserPath: '/project/dailies' };
            const action = UiContextActions.clearBucketBrowserPath();

            const result = reducer(previousState, action);

            expect(result.bucketBrowserPath).toBe('');
        });
    });
});
