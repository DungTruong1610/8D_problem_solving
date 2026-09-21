/**
 * UI5 Enum Pattern
 * Define enums as sap.ui.define modules for consistent use across controllers and views.
 *
 * CONVENTION:
 * - Place in webapp/utils/Enum/ folder
 * - Use SCREAMING_SNAKE_CASE for enum keys
 * - Export as a frozen object to prevent mutation
 */
sap.ui.define([], function () {
    "use strict";

    const APP_ROUTE = Object.freeze({
        HOME: "RouteHome",
        DETAIL: "RouteDetail",
        CREATE: "RouteCreate",
        EDIT: "RouteEdit",
        SETTINGS: "RouteSettings"
    });

    return APP_ROUTE;
});
