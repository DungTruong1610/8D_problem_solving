import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

/**
 * Shared Axios instance for all API/OData calls.
 *
 * CRITICAL: Empty baseURL forces relative paths, required for BTP Workzone
 * (Managed AppRouter) compatibility. Absolute paths break the sub-path routing.
 *
 * Features:
 * - Lazy CSRF token fetch + automatic retry on 403 (CSRF expiry)
 * - 401 handler: reloads the page to re-trigger AppRouter authentication
 * - 403 on read: tags error.isForbidden = true for UI to detect auth denial
 */

const axiosInstance: AxiosInstance = axios.create({
    baseURL: '',            // Relative — DO NOT change. Required for WorkZone AppRouter.
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,  // Required for XSUAA session cookie
    timeout: 30_000,
});

// ── CSRF token cache ──────────────────────────────────────────────────────────

let csrfToken: string | null = null;
let tokenFetchPromise: Promise<string | null> | null = null;

/**
 * Fetch CSRF token via GET with X-CSRF-Token: Fetch header.
 * Uses $metadata endpoint — lightweight, always accessible.
 * Replace OData path with your service's metadata URL.
 */
const fetchCsrfToken = async (): Promise<string | null> => {
    if (tokenFetchPromise) return tokenFetchPromise;

    tokenFetchPromise = (async () => {
        try {
            const response = await axios.get('./api/cnma/{{SERVICE_NAME}}/$metadata', {
                headers: { 'X-CSRF-Token': 'Fetch' },
            });
            csrfToken = response.headers['x-csrf-token'] ?? null;
            return csrfToken;
        } catch {
            // Don't throw — return null so GET requests still work.
            // The 403 will surface through the response interceptor.
            csrfToken = null;
            return null;
        } finally {
            tokenFetchPromise = null;
        }
    })();

    return tokenFetchPromise;
};

// ── Request interceptor — attach CSRF token to write operations ───────────────

axiosInstance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
        const method = config.method?.toLowerCase();
        if (method && ['post', 'put', 'patch', 'delete'].includes(method)) {
            if (!csrfToken) await fetchCsrfToken();
            if (csrfToken && config.headers) {
                config.headers['X-CSRF-Token'] = csrfToken;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ── Response interceptor — handle auth errors ─────────────────────────────────

let isHandling401 = false;

axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const status = error.response?.status;

        // ── 401: session expired → reload to re-authenticate via AppRouter ──
        if (status === 401 && !isHandling401) {
            isHandling401 = true;
            console.warn('[Session] Token expired — reloading for re-authentication.');
            window.location.reload();
            // Never resolve — prevents stale UI errors from appearing
            return new Promise(() => { });
        }

        // ── 403 on write op → CSRF may have expired, retry once ────────────
        if (status === 403 && !originalRequest._retry) {
            const method = originalRequest.method?.toLowerCase();
            if (method && ['post', 'put', 'patch', 'delete'].includes(method)) {
                originalRequest._retry = true;
                csrfToken = null; // Clear stale token
                await fetchCsrfToken();
                if (csrfToken) {
                    originalRequest.headers['X-CSRF-Token'] = csrfToken;
                    return axiosInstance(originalRequest);
                }
            }
        }

        // ── 403 on read → authorization denied, tag so UI can show AccessDenied ──
        if (status === 403) {
            error.isForbidden = true;
        }

        return Promise.reject(error);
    }
);

export default axiosInstance;
