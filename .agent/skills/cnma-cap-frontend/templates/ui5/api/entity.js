/**
 * UI5 Entity Registry Pattern
 * Centralize all OData entity set names in one file.
 * Controllers reference entity names through this registry instead of hardcoding strings.
 *
 * CONVENTION:
 * - Single file: webapp/api/ENTITY.js
 * - Use SCREAMING_SNAKE_CASE for entity keys
 * - Group by domain/module
 */
sap.ui.define([], function () {
    "use strict";

    const ENTITY_PATH = {
        // Core entities
        MY_ENTITY: "MyEntities",
        MY_ENTITY_DETAIL: "MyEntityDetails",

        // Value Helps
        VH_STATUS: "VHStatuses",
        VH_CATEGORY: "VHCategories"
    };

    return { ...ENTITY_PATH };
});
