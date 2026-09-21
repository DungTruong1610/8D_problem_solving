// ── Service layer barrel export ───────────────────────────────────────────────
//
// Core infrastructure (re-exported for convenience)
export { default as axiosInstance } from './core/axios-instance';
export { BaseODataService } from './core/base-service';
export { ODataQueryBuilder, ODataFilter } from './core/odata-helper';

// OData types
export type { ODataResponse, ODataSingleResponse, ODataError } from './types/odata.types';

// ── Domain services ───────────────────────────────────────────────────────────
// Add service exports here as you create them:
export { itemsService } from './items-service';
export type { Item } from './items-service';
export { identityHttpClient } from './identity-http-client';
export { eightDService, parseList, isCustomerComplaint, originShort } from './eightd-service';
export type { Report8D, Discipline8D, ReportStatus } from './eightd-service';
export { defectsService, DEFECT_STATUS_TONE } from './defect-service';
export type { DefectItem, DefectCharacteristicItem, DefectStatus } from './defect-service';


