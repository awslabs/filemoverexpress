import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';

const MIN_RETRIES = 0;
const MAX_RETRIES = 5;
const FATAL_MESSAGE = 'A fatal error has occurred. The application will be shut down.';
const NON_FATAL_MESSAGE = 'Internal error occurred in the application, please restart.';

export interface HandleErrorConfig {
    retryCount?: number,
    fatal?: boolean,
    nonFatalMessage?: string
}

const DEFAULT_HANDLE_ERROR_CONFIG: HandleErrorConfig = {
    retryCount: MIN_RETRIES,
    fatal: false,
    nonFatalMessage: NON_FATAL_MESSAGE,
};

export interface StreamError {
    error: Error | string;
    fatal: boolean;
    message: string;
}

export function handleStreamError<T>(config?: Partial<HandleErrorConfig>): (source$: Observable<T>) => Observable<T> {
    const processedConfig = processHandleErrorInput(config);

    return (source$) => {
        if (processedConfig.retryCount) {
            source$ = source$.pipe(
                retry(processedConfig.retryCount),
            );
        }

        source$ = source$.pipe(
            catchError((err) => {
                const streamError: StreamError = {
                    error: err,
                    fatal: !!processedConfig.fatal,
                    message: processedConfig.fatal ? FATAL_MESSAGE : (processedConfig.nonFatalMessage || ''),
                };
                return throwError(() => streamError);
            }),
        );

        return source$;
    };
}

function processHandleErrorInput(config?: Partial<HandleErrorConfig>): HandleErrorConfig {
    if (!config) {
        return DEFAULT_HANDLE_ERROR_CONFIG;
    }

    const processedConfig: HandleErrorConfig = {
        ...DEFAULT_HANDLE_ERROR_CONFIG,
        ...config,
    };
    // check that retryCount is valid
    if (!processedConfig.retryCount) {
        processedConfig.retryCount = MIN_RETRIES;
    }
    if (processedConfig.retryCount > MAX_RETRIES) {
        processedConfig.retryCount = MAX_RETRIES;
    }
    if (processedConfig.retryCount < MIN_RETRIES) {
        processedConfig.retryCount = MIN_RETRIES;
    }
    // check that nonFatalMessage is non-empty string
    if (!processedConfig.nonFatalMessage) {
        processedConfig.nonFatalMessage = DEFAULT_HANDLE_ERROR_CONFIG.nonFatalMessage;
    }
    return processedConfig;
}
