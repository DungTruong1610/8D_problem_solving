import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';
import { Result } from '../../core/Result';
import { AppConfig } from '../../core/AppConfig';

export class HttpClient {
    private static instance: HttpClient;
    private axiosInstance: AxiosInstance;
    private csrfToken: string | null = null;

    private constructor() {
        this.axiosInstance = axios.create({
            // CRITICAL: Use relative path (e.g., './api/cnma/...') so API calls go through 
            // the app's xs-app.json routing when running in Launchpad context. 
            // An absolute path (/api/...) would go to the launchpad root and fail.
            baseURL: AppConfig.API_BASE_URL,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            withCredentials: true, // Include cookies/auth tokens in cross-origin requests
            paramsSerializer: {
                encode: (param: string) => {
                    return encodeURIComponent(param).replace(/%40/g, '@').replace(/%3A/g, ':').replace(/%24/g, '$').replace(/%2C/g, ',').replace(/%20/g, '%20').replace(/\+/g, '%20');
                }
            }
        });

        // Response interceptor for error handling & CSRF token capture
        this.axiosInstance.interceptors.response.use(
            (response: AxiosResponse) => {
                // Capture CSRF token if present
                const token = response.headers['x-csrf-token'];
                if (token) {
                    this.csrfToken = token;
                    this.axiosInstance.defaults.headers.common['X-CSRF-Token'] = token;
                }
                return response;
            },
            (error) => {
                // Trigger CSRF refresh on 403?
                return Promise.reject(error);
            }
        );
    }

    public static getInstance(): HttpClient {
        if (!HttpClient.instance) {
            HttpClient.instance = new HttpClient();
        }
        return HttpClient.instance;
    }

    public async get<T>(url: string, config?: any): Promise<Result<T>> {
        try {
            const response = await this.axiosInstance.get<T>(url, config);
            return Result.ok<T>(response.data);
        } catch (error: any) {
            return this.handleError<T>(error);
        }
    }

    public async post<T>(url: string, data?: any, config?: any): Promise<Result<T>> {
        try {
            await this.ensureCsrfToken(); // Ensure token before POST
            const response = await this.axiosInstance.post<T>(url, data, config);
            return Result.ok<T>(response.data);
        } catch (error: any) {
            return this.handleError<T>(error);
        }
    }

    private async ensureCsrfToken(): Promise<void> {
        if (!this.csrfToken) {
            try {
                // Fetch token from root or metadata
                await this.axiosInstance.get('/', {
                    headers: { 'X-CSRF-Token': 'Fetch' }
                });
            } catch (e) {
                console.warn("Failed to fetch CSRF token", e);
            }
        }
    }

    private handleError<T>(error: any): Result<T> {
        let message = 'Unknown error';
        if (axios.isAxiosError(error)) {
            message = error.response?.data?.error?.message || error.message;
        } else if (error instanceof Error) {
            message = error.message;
        }
        return Result.fail<T>(message);
    }
}
