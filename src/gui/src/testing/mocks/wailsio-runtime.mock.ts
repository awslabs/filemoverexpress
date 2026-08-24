// Mock for @wailsio/runtime to prevent fetch calls during unit tests

export const Application = {
    Quit: () => Promise.resolve(),
};

export const Clipboard = {
    SetText: (__text: string) => Promise.resolve(),
    Text: () => Promise.resolve(''),
};

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Events {
    export class WailsEvent {
        name: string;
        data: unknown;
        sender?: string;

        constructor(name: string, data?: unknown) {
            this.name = name;
            this.data = data ?? null;
        }
    }

    export function Emit(__name: string, __data?: unknown) {
        return Promise.resolve();
    }

    export function On(__eventName: string, __callback: (event: WailsEvent) => void) {
        return () => {
            /* empty */
        };
    }

    export function Once(__eventName: string, __callback: (event: WailsEvent) => void) {
        return () => {
            /* empty */
        };
    }

    export function Off(...__eventNames: string[]) {
        /* empty */
    }

    export function OffAll() {
        /* empty */
    }
}

export const Call = {
    ByID: (...__args: unknown[]) => Promise.resolve(),
    ByName: (...__args: unknown[]) => Promise.resolve(),
};

export type CancellablePromise<T> = Promise<T>;

export const Create = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Array: (__fn: any) => (__arr: any[]) => __arr?.map(__fn) ?? [],
};

export function setTransport() {
    /* empty */
}

export function getTransport() {
    return null;
}

export const objectNames = {};
export const clientId = 'test-client';
