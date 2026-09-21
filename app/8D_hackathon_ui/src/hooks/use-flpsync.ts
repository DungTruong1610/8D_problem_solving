import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Iframe-safe FLP sync using postMessage API.
 *
 * When running inside BTP Workzone (an iframe), we cannot directly access
 * parent.location due to cross-origin restrictions. Instead, we use
 * postMessage to communicate with the parent shell.
 *
 * Messages sent to parent:
 *   { type: 'ROUTE_CHANGE', route: string }
 *
 * Messages received from parent:
 *   { type: 'INITIAL_STATE', hash: string, search: string }
 */

// Module-level state — initialized once at app startup
let initialFLPState: { hash: string; search: string } | null = null;
let stateReceived = false;

// ── Sync hook ─────────────────────────────────────────────────────────────────

/**
 * Syncs React Router navigation with the parent FLP shell URL via postMessage.
 * Call once inside a component rendered within <HashRouter>.
 */
export function useFLPSyncDirect() {
    const location = useLocation();
    const isInitialRenderRef = useRef(true);

    useEffect(() => {
        const isInIframe = window.parent !== window;
        if (!isInIframe) return;

        const appRoute = location.pathname.replace(/^\//, '');
        const hasDeepLinkInParent = initialFLPState?.hash?.includes('&/') ?? false;

        // Skip first sync if parent already has a deep link (let InitialRouteNavigator handle it)
        if (isInitialRenderRef.current && appRoute === '' && hasDeepLinkInParent) {
            isInitialRenderRef.current = false;
            return;
        }

        isInitialRenderRef.current = false;

        try {
            window.parent.postMessage({ type: 'ROUTE_CHANGE', route: appRoute }, '*');
        } catch {
            // cross-origin — silently ignore
        }
    }, [location.pathname]);
}

// ── Initial route ─────────────────────────────────────────────────────────────

/**
 * Determines the initial deep-link route to navigate to on first app load.
 * WorkZone can pass the intended route via URL search params or via the FLP hash.
 */
export function getInitialFLPRoute(): string {
    if (window.parent === window) return '/';

    // Primary: read from iframe's own URL search params (Managed AppRouter)
    const iframeParams = new URLSearchParams(window.location.search);
    const routeParam = iframeParams.get('route') || iframeParams.get('worklist');
    if (routeParam) {
        return '/' + routeParam;
    }

    // Parse FLP hash format: #SemanticObject-action?params&/appRoute
    const parseFLPHash = (hash: string): { route: string; intentParams: string } => {
        const parts = hash.split('&/');
        const route = parts.length > 1 ? '/' + parts[parts.length - 1] : '/';
        const intentPart = parts[0];
        const qIdx = intentPart.indexOf('?');
        const intentParams = qIdx !== -1 ? intentPart.substring(qIdx + 1) : '';
        return { route, intentParams };
    };

    // From postMessage cached state
    if (initialFLPState?.hash) {
        const { route, intentParams } = parseFLPHash(initialFLPState.hash);
        if (route !== '/') {
            return intentParams ? `${route}?${intentParams}` : route;
        }
    }

    // Fallback: try direct parent access (same-origin or local dev)
    try {
        const { route, intentParams } = parseFLPHash(window.parent.location.hash);
        if (route !== '/') {
            return intentParams ? `${route}?${intentParams}` : route;
        }
    } catch {
        // cross-origin — expected in BTP
    }

    return '/';
}

// ── SAP params ────────────────────────────────────────────────────────────────

export interface FLPParams {
    locale: string | null;
    theme: string | null;
}

/**
 * Returns SAP locale and theme from the parent FLP URL.
 */
export function getInitialFLPParams(): FLPParams {
    const result: FLPParams = { locale: null, theme: null };

    if (window.parent === window) {
        // Standalone mode — try own URL
        const params = new URLSearchParams(window.location.search);
        result.locale = params.get('sap-locale');
        result.theme = params.get('sap-theme');
        return result;
    }

    // From postMessage cached state
    if (initialFLPState?.search) {
        const params = new URLSearchParams(initialFLPState.search);
        result.locale = params.get('sap-locale');
        result.theme = params.get('sap-theme');
        return result;
    }

    // Fallback: direct parent access
    try {
        const params = new URLSearchParams(window.parent.location.search);
        result.locale = params.get('sap-locale');
        result.theme = params.get('sap-theme');
    } catch {
        // cross-origin — expected
    }

    return result;
}

// ── Message listener ──────────────────────────────────────────────────────────

/**
 * Initialize postMessage listener to receive initial state from the Workzone shell.
 * Call ONCE at app startup (before rendering).
 */
export function initFLPMessageListener() {
    if (stateReceived) return;

    const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'INITIAL_STATE') {
            initialFLPState = {
                hash: event.data.hash || '',
                search: event.data.search || '',
            };
            stateReceived = true;
        }
    };

    window.addEventListener('message', handleMessage);

    // Request initial state from parent shell
    if (window.parent !== window) {
        try {
            window.parent.postMessage({ type: 'REQUEST_INITIAL_STATE' }, '*');
        } catch {
            // cross-origin
        }
    }
}

// ── Utils ─────────────────────────────────────────────────────────────────────

export function isInIframe(): boolean {
    return window.parent !== window;
}
