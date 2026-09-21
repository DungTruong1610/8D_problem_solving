import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Sync React Router navigation with parent FLP URL using replaceState.
 *
 * This hook ONLY syncs the URL for display/bookmarking purposes.
 * - React Router handles all back/forward navigation internally
 * - Parent URL is updated for deep linking (copy/paste URL works)
 * - No browser history manipulation - just URL display sync
 */
export function useFLPSyncDirect() {
    const location = useLocation();
    const isInitialRenderRef = useRef(true);

    useEffect(() => {
        if (window.parent === window) {
            console.log("[FLP-SYNC] Standalone mode - skipping");
            return;
        }

        const appRoute = location.pathname.replace(/^\//, "");
        console.log("[FLP-SYNC] Syncing route to parent:", appRoute, "| Initial render:", isInitialRenderRef.current);

        try {
            const parentLocation = window.parent.location;
            const currentHash = parentLocation.hash;

            const hasDeepLinkInParent = currentHash.includes("&/");

            if (isInitialRenderRef.current && appRoute === "" && hasDeepLinkInParent) {
                console.log("[FLP-SYNC] Skipping initial sync - waiting for deep link navigation");
                isInitialRenderRef.current = false;
                return;
            }

            isInitialRenderRef.current = false;

            const basePart = currentHash.split("&/")[0];
            const newHash = appRoute ? `${basePart}&/${appRoute}` : basePart;

            if (currentHash !== newHash) {
                const newUrl = parentLocation.origin + parentLocation.pathname + parentLocation.search + newHash;
                window.parent.history.replaceState(null, "", newUrl);
                console.log("[FLP-SYNC] Updated parent URL to:", newUrl);
            }
        } catch (e) {
            console.error("[FLP-SYNC] Cannot access parent (cross-origin?):", e);
        }
    }, [location.pathname]);
}

/**
 * Get the initial route from parent FLP hash on app load.
 */
export function getInitialFLPRoute(): string {
    let initialRoute = "/";

    if (window.parent === window) {
        console.log("[FLP-INIT] Standalone mode - using default route");
        return initialRoute;
    }

    try {
        const parentHash = window.parent.location.hash;
        console.log("[FLP-INIT] Parent hash:", parentHash);

        const parts = parentHash.split("&/");
        if (parts.length > 1) {
            const routePart = parts[parts.length - 1];
            initialRoute = "/" + routePart;
            console.log("[FLP-INIT] Found initial route:", initialRoute);
        } else {
            console.log("[FLP-INIT] No inner route found, using default /");
        }
    } catch (e) {
        console.error("[FLP-INIT] Cannot access parent (cross-origin?):", e);
    }

    return initialRoute;
}

export function isEmbeddedInFLP(): boolean {
    if (window.parent === window) {
        return false;
    }
    try {
        const parentHash = window.parent.location.hash;
        const parentSearch = window.parent.location.search;
        const hasFLPHash = parentHash && parentHash.length > 1 && !parentHash.startsWith('#/');
        const hasSapHint = parentSearch.includes('sap-ui-app-id-hint') || parentHash.includes('sap-ui-app-id-hint');
        return hasFLPHash || hasSapHint;
    } catch (e) {
        console.log("[FLP-DETECT] Cross-origin parent - assuming embedded in FLP");
        return true;
    }
}

export function isInIframe(): boolean {
    return window.parent !== window;
}

export interface FLPParams {
    locale: string | null;
    language: string | null;
    theme: string | null;
}

export function getInitialFLPParams(): FLPParams {
    const result: FLPParams = { locale: null, language: null, theme: null };

    if (window.parent === window) {
        console.log('[FLP-PARAMS] Standalone mode - checking own URL');
        try {
            const params = new URLSearchParams(window.location.search);
            result.locale = params.get('sap-locale');
            result.language = params.get('sap-language');
            result.theme = params.get('sap-theme');
        } catch (e) {
            console.log('[FLP-PARAMS] Error reading own URL params:', e);
        }
        return result;
    }

    console.log('[FLP-PARAMS] Iframe mode - attempting to read parent URL');
    try {
        const params = new URLSearchParams(window.parent.location.search);
        result.locale = params.get('sap-locale');
        result.language = params.get('sap-language');
        result.theme = params.get('sap-theme');
        return result;
    } catch (e) {
        console.log('[FLP-PARAMS] Cannot access parent URL directly (cross-origin, this is normal in FLP)');
    }
    return result;
}

export function normalizeSapLocale(sapLocale: string | null): string | null {
    if (!sapLocale) return null;
    return sapLocale.replace('_', '-').toLowerCase();
}
