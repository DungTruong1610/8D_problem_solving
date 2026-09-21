/**
 * UI5 Interface Pattern
 * Use interfaces to define data shapes. This enforces consistency across the app.
 *
 * CONVENTION:
 * - Place in webapp/interfaces/ folder
 * - Use `Implementation()` factory pattern for creating instances
 * - Return spread of base fields + optional additional info
 */
sap.ui.define([], function () {
    "use strict";
    return {
        Implementation: function (ADDITIONAL_INFO) {
            const USER_BASE = {
                logonEmail: "",
                userName: "",
                firstName: "",
                lastName: "",
                role: [],
                scopes: []
            };

            if (ADDITIONAL_INFO) {
                return { ...USER_BASE, ...ADDITIONAL_INFO };
            }
            return { ...USER_BASE };
        }
    };
});
