/**
 * HttpClient — Centralized API client for all backend communication.
 *
 * CONVENTION:
 * - Place in src/data/datasources/
 * - Single instance shared across all repositories (via DI container)
 * - Handles: base URL, auth headers, CSRF tokens, error normalization
 * - All repositories use this instead of raw fetch/axios
 *
 * WHY: Centralizing HTTP calls ensures consistent error handling,
 * auth token refresh, and request/response logging across the app.
 */

export interface HttpClientConfig {
    baseUrl: string;
    defaultHeaders?: Record<string, string>;
}

export class HttpClient {
    private baseUrl: string;
    private defaultHeaders: Record<string, string>;

    constructor(config: HttpClientConfig) {
        this.baseUrl = config.baseUrl;
        this.defaultHeaders = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            ...config.defaultHeaders,
        };
    }

    private async request<T>(method: string, path: string, body?: any): Promise<T> {
        const url = `${this.baseUrl}${path}`;

        const response = await fetch(url, {
            method,
            headers: this.defaultHeaders,
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(
                `[HttpClient] ${method} ${path} failed (${response.status}): ${errorBody}`
            );
        }

        // Handle 204 No Content
        if (response.status === 204) return {} as T;

        return response.json() as Promise<T>;
    }

    async get<T>(path: string): Promise<T> {
        return this.request<T>("GET", path);
    }

    async post<T>(path: string, body: any): Promise<T> {
        return this.request<T>("POST", path, body);
    }

    async patch<T>(path: string, body: any): Promise<T> {
        return this.request<T>("PATCH", path, body);
    }

    async delete(path: string): Promise<void> {
        await this.request<void>("DELETE", path);
    }

    /**
     * Fetch CSRF token from OData service (SAP-specific).
     * Call this before POST/PATCH/DELETE if backend requires CSRF.
     */
    async fetchCsrfToken(path: string = "/"): Promise<string> {
        const response = await fetch(`${this.baseUrl}${path}`, {
            method: "HEAD",
            headers: { ...this.defaultHeaders, "X-CSRF-Token": "Fetch" },
        });
        return response.headers.get("X-CSRF-Token") || "";
    }
}
