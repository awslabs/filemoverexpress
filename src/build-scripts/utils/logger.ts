export enum LogLevel {
    Error = 'error',
    Warn = 'warn',
    Info = 'info',
    Debug = 'debug'
}

export class Logger {
    static verbose: boolean = false;

    static error(message: string, error?: Error): void {
        console.error(`[ERROR] ${message}`);
        if (error) {
            console.error(error.stack || error.message);
        }
    }

    static warn(message: string): void {
        console.warn(`[WARN] ${message}`);
    }

    static info(message: string): void {
        console.log(`[INFO] ${message}`);
    }

    static debug(message: string): void {
        if (!Logger.verbose) {
            return;
        }

        console.debug(`[DEBUG] ${message}`);
    }

    static success(message: string): void {
        console.log(`[SUCCESS] ${message}`);
    }
}
