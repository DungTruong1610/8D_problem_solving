import { getDestination, buildHeadersForDestination, Destination } from '@sap-cloud-sdk/connectivity';
import { executeHttpRequest } from '@sap-cloud-sdk/http-client';
import axios from 'axios';
import * as qs from 'qs';
import { createLogger } from '../../../common/util/Logger';
import { BTPServiceLoggingMiddleware } from '../../middleware/BTPServiceLoggingMiddleware';

const logger = createLogger('DestinationCloud');

/**
 * BTP Destination Service - SAP BTP integration for HTTP calls.
 * Handles destination retrieval, authentication, and CSRF token handling.
 */
export class DestinationCloudService {
    private destinationName: string;

    constructor(destinationName: string = '') {
        this.destinationName = destinationName;
    }

    getDestinationName(): string {
        return this.destinationName;
    }

    async getBTPDestination(): Promise<any | null> {
        try {
            if (!this.destinationName) {
                logger.warn('Destination name not set');
                return null;
            }

            logger.info('Retrieving BTP destination', { destinationName: this.destinationName });

            const btpDestinationData = await getDestination({
                destinationName: this.destinationName,
            });

            if (!btpDestinationData) {
                logger.error('Destination not found', { destinationName: this.destinationName });
                return null;
            }

            BTPServiceLoggingMiddleware.logDestinationRetrieval(this.destinationName, true);

            let btpDestinationConfig = btpDestinationData.originalProperties?.destinationConfiguration ?? null;

            if (!btpDestinationConfig && btpDestinationData.originalProperties) {
                btpDestinationConfig = btpDestinationData.originalProperties;
            }

            return {
                destinationData: btpDestinationData,
                destinationConfig: btpDestinationConfig,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Failed to get destination', { destinationName: this.destinationName, error: errorMessage });
            BTPServiceLoggingMiddleware.logDestinationRetrieval(this.destinationName, false, error as Error);
            return null;
        }
    }

    async fetchJwtToken(authTokenUrl: string, clientId: string, clientSecret: string): Promise<string> {
        try {
            const data = qs.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'client_credentials',
                response_type: 'token',
            });

            const response = await axios.request({
                method: 'post',
                maxBodyLength: Infinity,
                url: authTokenUrl,
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                data,
            });

            return response.data.access_token;
        } catch (error) {
            logger.error('JWT token fetch failed', { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }

    async getAuthorizationTokenForSystemUser(destinationName: string): Promise<string> {
        try {
            const btpDestination = await getDestination({ destinationName });

            if (!btpDestination?.originalProperties?.destinationConfiguration) {
                throw new Error(`Invalid destination configuration for: ${destinationName}`);
            }

            const { clientId, clientSecret, tokenServiceURL, tokenServiceUrl } =
                btpDestination.originalProperties.destinationConfiguration;
            const finalTokenUrl = tokenServiceURL || tokenServiceUrl;

            if (!finalTokenUrl) {
                throw new Error('Token Service URL missing in destination config');
            }

            const bodyParams = new URLSearchParams();
            bodyParams.append('grant_type', 'client_credentials');
            bodyParams.append('client_id', clientId);
            bodyParams.append('client_secret', clientSecret);

            const tokenResponse = await fetch(finalTokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: bodyParams,
            });

            if (!tokenResponse.ok) {
                throw new Error(`Failed to retrieve auth token: ${tokenResponse.statusText}`);
            }

            const tokenJson = (await tokenResponse.json()) as { access_token?: string };
            return tokenJson.access_token || '';
        } catch (error) {
            logger.error('Authorization token error', { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }

    async getCsrfRequestHeaders(destination: Destination): Promise<Record<string, string>> {
        try {
            return await buildHeadersForDestination(destination);
        } catch (error: unknown) {
            const err = error as Error;
            logger.error('Failed to fetch CSRF headers', { error: err.message });
            return {};
        }
    }

    protected async executeRequest(
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        servicePath: string,
        requestPath: string,
        data?: any,
        options: Record<string, any> = {}
    ): Promise<any> {
        const btpDestination = this.getBTPDestinationSync();
        if (!btpDestination) {
            throw new Error('Destination not found');
        }

        const { destinationData } = btpDestination;
        const requestEndpoint = `${servicePath}${requestPath}`;

        const callLog = BTPServiceLoggingMiddleware.logServiceCallStart(
            this.destinationName,
            method,
            requestEndpoint,
            data
        );

        try {
            const requestConfig: any = { method, url: requestEndpoint };
            if (data !== undefined) {
                requestConfig.data = data;
            }

            const response = executeHttpRequest(destinationData, requestConfig, options);
            BTPServiceLoggingMiddleware.logServiceCallSuccess(callLog, response.status, response.data);
            return response;
        } catch (error: any) {
            BTPServiceLoggingMiddleware.logServiceCallError(callLog, error, error.response?.status);
            throw error;
        }
    }

    private getBTPDestinationSync(): any {
        // Sync wrapper - in async context use getBTPDestination()
        return null;
    }

    async sendGetRequest(servicePath: string, requestPath: string): Promise<any> {
        return this.executeRequest('GET', servicePath, requestPath);
    }

    async sendPostRequest(servicePath: string, requestPath: string, payload: any): Promise<any> {
        return this.executeRequest('POST', servicePath, requestPath, payload, { fetchCsrfToken: true });
    }

    async sendPutRequest(servicePath: string, requestPath: string, payload: any): Promise<any> {
        return this.executeRequest('PUT', servicePath, requestPath, payload, { fetchCsrfToken: true });
    }
}