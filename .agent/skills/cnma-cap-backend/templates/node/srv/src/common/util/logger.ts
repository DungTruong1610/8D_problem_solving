/**
 * Logger utility - wrapper around cds.log.
 * Never use console.log; always use cds.log.
 */
export class Logger {
    private context: string;

    constructor(context: string) {
        this.context = context;
    }

    info(message: string, data?: any): void {
        cds.log.info(`[${this.context}] ${message}`, data || '');
    }

    warn(message: string, data?: any): void {
        cds.log.warn(`[${this.context}] ${message}`, data || '');
    }

    error(message: string, error?: any): void {
        const details = error instanceof Error
            ? { message: error.message, stack: error.stack }
            : error;
        cds.log.error(`[${this.context}] ${message}`, details || '');
    }

    debug(message: string, data?: any): void {
        if (process.env.DEBUG) {
            cds.log.debug(`[${this.context}] ${message}`, data || '');
        }
    }
}

/**
 * Create logger instance for a feature.
 */
export function createLogger(feature: string): Logger {
    return new Logger(feature);
}