/**
 * Frontend Types - Template File
 * 
 * This file demonstrates the pattern for importing CDS-generated types
 * and defining runtime enum constants.
 * 
 * IMPORTANT: Update this file when schema.cds changes.
 * Run: npm run build:types (from project root)
 */

// =============================================================================
// CDS Entity Types - Import from generated @cds-models
// =============================================================================
// Uncomment and adjust based on your schema.cds namespace:
// 
// import type { 
//     Request as CdsRequest, 
//     RequestType as CdsRequestType 
// } from '#cds-models/sap/your-namespace';
// 
// export type Request = CdsRequest;
// export type RequestType = CdsRequestType;

// =============================================================================
// Enum Constants - Define for runtime use
// These MUST match the enum definitions in schema.cds
// =============================================================================

/**
 * Example Status Enum
 * Update values to match your schema.cds entity status field
 */
export const Status = {
    DRAFT: 'DRAFT',
    SUBMITTED: 'SUBMITTED',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    REJECTED: 'REJECTED',
} as const;

export type Status = typeof Status[keyof typeof Status];

/**
 * Example Priority Enum
 * Update values to match your schema.cds entity priority field
 */
export const Priority = {
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW'
} as const;

export type Priority = typeof Priority[keyof typeof Priority];

// =============================================================================
// Frontend-Specific Types
// Types that exist only in frontend, not in schema.cds
// =============================================================================

export interface Attachment {
    ID: string;
    createdAt?: string;
    createdBy?: string;
    fileName: string;
    mimeType: string;
    size: number;
    contentId?: string;
    url?: string;
}
