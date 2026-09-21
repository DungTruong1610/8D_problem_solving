import { BaseODataService } from './core/baseService';
import { ODataQueryBuilder, ODataFilter } from './core/odataHelper';

/**
 * Item entity interface — matches the CDS schema and OData service.
 * ★ Replace this with your actual entity interface.
 */
export interface Item {
    ID: string;
    name: string;
    description?: string;
    status: string;
    priority: number;
    createdAt?: string;
    modifiedAt?: string;
    /** Populated from @odata.etag — used for optimistic concurrency in update/delete */
    __etag?: string;
}

/**
 * ItemsService — typed CRUD for the Items OData entity set.
 *
 * ★ Pattern for adding your own services:
 *   1. Duplicate this file (e.g., OrdersService.ts)
 *   2. Change the interface and constructor super() args
 *   3. Export a singleton instance
 *
 * Usage:
 *   import { itemsService } from '@/services';
 *   const result = await itemsService.getList(new ODataQueryBuilder().top(50).count());
 */
class ItemsService extends BaseODataService<Item> {
    constructor() {
        // serviceName: path to your OData service (relative, no leading slash)
        // entityName:  OData entity set name
        super('odata/v4/ReactDemoService', 'Items');
    }

    /** Filter items by status */
    async getByStatus(status: string) {
        return this.getList(
            new ODataQueryBuilder()
                .filter(ODataFilter.eq('status', status))
                .orderBy('createdAt', 'desc')
                .count()
        );
    }

    /** Search items by name (case-insensitive contains) */
    async search(term: string) {
        return this.getList(
            new ODataQueryBuilder()
                .filter(
                    ODataFilter.or(
                        ODataFilter.containsIgnoreCase('name', term),
                        ODataFilter.containsIgnoreCase('description', term)
                    )
                )
                .select(['ID', 'name', 'status', 'priority'])
                .top(50)
        );
    }

    /** Paginated list with $top/$skip */
    async getPage(page: number, pageSize = 20) {
        return this.getList(
            new ODataQueryBuilder()
                .top(pageSize)
                .skip((page - 1) * pageSize)
                .orderBy('createdAt', 'desc')
                .count()
        );
    }
}

export const itemsService = new ItemsService();
