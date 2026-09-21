import { Request } from '@sap/cds/apis/services';
import { eBTPDestinationServices } from '../enum/BTPDestinationServices';
import { createLogger } from '../util/Logger';

const logger = createLogger('BTPServiceLogging');

/**
 * BTP Service Call Logging Middleware
 * Tracks HTTP calls to SAP BTP services with structured logging
 */
export interface ServiceCallLog {
    destinationName: string;
    method: string;
    url: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    statusCode?: number;
    success?: boolean;
    error?: string;
}

export class BTPServiceLoggingMiddleware {
    /**
     * Log BTP service call start
     */
    static logServiceCallStart(
        destinationName: string,
        method: string,
        url: string,
        data?: any
    ): ServiceCallLog {
        const startTime = Date.now();

        logger.info('BTP service call started', {
            destinationName,
            method,
            url,
            hasData: !!data,
            dataSize: data ? JSON.stringify(data).length : 0,
        });

        return {
            destinationName,
            method,
            url,
            startTime,
        };
    }

    /**
     * Log successful BTP service call
     */
    static logServiceCallSuccess(callLog: ServiceCallLog, statusCode: number, responseData?: any): void {
        const endTime = Date.now();
        const duration = endTime - callLog.startTime;

        logger.info('BTP service call completed', {
            destinationName: callLog.destinationName,
            method: callLog.method,
            url: callLog.url,
            statusCode,
            duration: `${duration}ms`,
            success: true,
            responseSize: responseData ? JSON.stringify(responseData).length : 0,
        });
    }

    /**
     * Log failed BTP service call
     */
    static logServiceCallError(callLog: ServiceCallLog, error: Error, statusCode?: number): void {
        const endTime = Date.now();
        const duration = endTime - callLog.startTime;

        logger.error('BTP service call failed', {
            destinationName: callLog.destinationName,
            method: callLog.method,
            url: callLog.url,
            statusCode,
            duration: `${duration}ms`,
            success: false,
            error: error.message,
            errorStack: error.stack,
        });
    }

    /**
     * Log destination retrieval
     */
    static logDestinationRetrieval(destinationName: string, success: boolean, error?: Error): void {
        if (success) {
            logger.info('BTP destination retrieved', { destinationName });
        } else {
            logger.error('BTP destination retrieval failed', {
                destinationName,
                error: error?.message,
            });
        }
    }
}

export default BTPServiceLoggingMiddleware;