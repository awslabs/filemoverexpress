import { createReducer, on } from '@ngrx/store';
import { ConnectionState } from '../../models/connection-state-model';
import * as FmeClientActions from '../actions/fme-client.actions';

export const fmeClientFeatureKey = 'fmeClient';

export interface FmeClientState {
    connectionState: ConnectionState;
}

export const initialState: FmeClientState = {
    connectionState: ConnectionState.DISCONNECTED,
};

export const reducer = createReducer(
    initialState,
    on(FmeClientActions.tryConnect,
        (state) => {
            return {
                ...state,
                connectionState: ConnectionState.CONNECTING,
            };
        },
    ),
    on(FmeClientActions.succeedConnect,
        (state) => {
            return {
                ...state,
                connectionState: ConnectionState.CONNECTED,
            };
        },
    ),
    on(FmeClientActions.disconnect,
        (state) => {
            return {
                ...state,
                connectionState: ConnectionState.DISCONNECTED,
            };
        },
    ),
);
