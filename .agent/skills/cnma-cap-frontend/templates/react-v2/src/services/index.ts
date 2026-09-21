// ── Service layer barrel export ───────────────────────────────────────────────
//
// Core infrastructure (re-exported for convenience)
export { default as axiosInstance } from './core/axiosInstance';
export { BaseODataService } from './core/baseService';
export { ODataQueryBuilder, ODataFilter } from './core/odataHelper';

// OData types
export type { ODataResponse, ODataSingleResponse, ODataError } from './types/odata.types';

// ── Domain services ───────────────────────────────────────────────────────────
// Add service exports here as you create them:
export { itemsService } from './itemsService';
export type { Item } from './itemsService';
