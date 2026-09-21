sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/core/HTML"
], function (UIComponent, HTML) {
    "use strict";

    /**
     * SAP UI5 Wrapper Component for React App (BTP Workzone / FLP).
     *
     * Responsibilities:
     * 1. Renders the React app inside an <iframe> (same-origin, html5-apps-repo-rt)
     * 2. Provides bidirectional postMessage bridge:
     *    - Sends INITIAL_STATE (hash + search) to React on iframe load
     *    - Handles REQUEST_INITIAL_STATE from React (re-send state)
     *    - Handles ROUTE_CHANGE from React → updates FLP hash in window.top
     *
     * The React app uses useFLPSync.ts to consume this protocol.
     */
    return UIComponent.extend("{{NAMESPACE}}.Component", {
        metadata: {
            manifest: "json"
        },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);
            this._setupIframeMessaging();
        },

        createContent: function () {
            var sAppPath = sap.ui.require.toUrl("{{NAMESPACE_PATH}}");
            var sIndexUrl = sAppPath + "/index.html";
            var that = this;
            var sIframeId = "reactAppIframe-" + Date.now();

            // Store reference once DOM is ready
            setTimeout(function () {
                that._iframe = document.getElementById(sIframeId);
                if (that._iframe) {
                    that._iframe.addEventListener('load', function () {
                        that._sendInitialStateToIframe();
                    });
                }
            }, 100);

            return new HTML({
                content: '<iframe id="' + sIframeId + '" src="' + sIndexUrl + '" style="width:100%; height:100%; border:none; display:block;"></iframe>'
            });
        },

        /**
         * Listen for postMessage events from the React iframe.
         */
        _setupIframeMessaging: function () {
            var that = this;
            window.addEventListener('message', function (event) {
                // TODO production: validate event.origin against your BTP subdomain
                if (!event.data) return;

                if (event.data.type === 'REQUEST_INITIAL_STATE') {
                    that._sendInitialStateToIframe();
                } else if (event.data.type === 'ROUTE_CHANGE') {
                    that._updateFLPHash(event.data.route);
                }
            });
        },

        /**
         * Send current FLP hash + search params to the React iframe.
         * Called on iframe load and whenever React requests it.
         */
        _sendInitialStateToIframe: function () {
            if (!this._iframe || !this._iframe.contentWindow) return;

            // Use window.top to get the actual browser URL (FLP is top-level)
            var targetWindow = window.top || window;
            var hash   = targetWindow.location.hash   || '';
            var search = targetWindow.location.search  || '';

            this._iframe.contentWindow.postMessage({
                type:   'INITIAL_STATE',
                hash:   hash,
                search: search
            }, '*');
        },

        /**
         * Update the FLP hash in window.top when React navigates.
         * Preserves the existing FLP intent hash prefix and only updates &/innerRoute.
         */
        _updateFLPHash: function (route) {
            try {
                var targetWindow = window.top || window;
                var currentHash  = targetWindow.location.hash;

                // FLP hash format: #SemanticObject-action?params&/innerRoute
                var basePart = currentHash.split('&/')[0];
                var newHash  = route ? basePart + '&/' + route : basePart;

                if (currentHash !== newHash) {
                    targetWindow.history.replaceState(
                        null, '',
                        targetWindow.location.origin +
                        targetWindow.location.pathname +
                        targetWindow.location.search +
                        newHash
                    );
                }
            } catch (e) {
                // cross-origin top window — expected in some FLP environments
                console.warn('[Component] Could not update FLP hash:', e.message);
            }
        }
    });
});
