/**
 * Integration Module - External system integrations
 *
 * Sub-modules:
 * - btp:      SAP BTP services (Destination, Auth, Connectivity)
 * - erp:      SAP ERP systems (S/4HANA, ECC)
 * - messaging: Event mesh and messaging services
 */
export * from './btp';
export * from './erp';
export * from './messaging/MessagePublisher';