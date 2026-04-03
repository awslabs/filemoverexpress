import { createFeature, createReducer, on } from '@ngrx/store';
import * as FmeClientActions from '@state/fme-client/actions/fme-client.actions';
import { initialState } from '@state/fme-client/reducers/fme-client.reducer';
import { ConnectionState } from '@state/models/connection-state-model';

export const fmeClientFeature = createFeature({
    name: 'fmeClient',
    reducer: createReducer(
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
    ),
});
