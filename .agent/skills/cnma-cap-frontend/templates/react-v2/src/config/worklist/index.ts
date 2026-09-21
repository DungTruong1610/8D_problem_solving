/**
 * Worklist configuration for the Home/Items entity.
 *
 * Pattern: each "worklist" (entity list view) has:
 *   - columnDefs: column definitions for the data table
 *   - filterConfig: filter bar configuration (field types, labels, options)
 *
 * ★ Duplicate this folder for each entity in your application.
 *   e.g., config/orders/, config/invoices/, config/employees/
 */

export * from './itemsColumns.config';
export * from './itemsFilterConfig';
