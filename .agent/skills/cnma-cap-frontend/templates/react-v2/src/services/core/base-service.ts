import axiosInstance from './axiosInstance';
import { ODataQueryBuilder } from './odataHelper';
import type { ODataResponse } from '@/services/types/odata.types';

/**
 * Generic base class for all OData entity services.
 * Extend this for each entity in your application.
 *
 * Features:
 * - Typed CRUD: getList, getById, create, update, delete
 * - OData ETag support (optimistic concurrency for PATCH/DELETE)
 * - Bound/unbound actions and function imports
 *
 * Usage:
 *   class ItemsService extends BaseODataService<Item> {
 *     constructor() { super('odata/v4/ReactDemoService', 'Items'); }
 *   }
 *   export const itemsService = new ItemsService();
 */
export class BaseODataService<T> {
    protected serviceName: string;
    protected entityName: string;
    protected basePath: string;

    constructor(serviceName: string, entityName: string) {
        this.serviceName = serviceName;
        this.entityName = entityName;
        this.basePath = `${serviceName}/${entityName}`;
    }

    // ── GET (list) ────────────────────────────────────────────────────────────

    async getList(queryBuilder?: ODataQueryBuilder | null): Promise<ODataResponse<T>> {
        const qs = queryBuilder ? `?${queryBuilder.build()}` : '';
        const response = await axiosInstance.get<ODataResponse<T>>(`${this.basePath}${qs}`);
        return response.data;
    }

    // ── GET (single by key) ───────────────────────────────────────────────────
    //
    // Captures @odata.etag from response body for optimistic concurrency on
    // subsequent PATCH/DELETE calls. Access via entity.__etag.

    async getById(id: string | number, queryBuilder?: ODataQueryBuilder | null): Promise<T> {
        const qs = queryBuilder ? `?${queryBuilder.build()}` : '';
        const response = await axiosInstance.get<T & { '@odata.etag'?: string }>(
            `${this.basePath}(${this.formatKey(id)})${qs}`
        );
        const data = response.data;
        if (data && typeof data === 'object' && '@odata.etag' in data) {
            (data as any).__etag = (data as any)['@odata.etag'];
        }
        return data as T;
    }

    // ── POST (create) ─────────────────────────────────────────────────────────

    async create(data: Partial<T>): Promise<T> {
        const response = await axiosInstance.post<T & { '@odata.etag'?: string }>(this.basePath, data);
        const result = response.data;
        if (result && typeof result === 'object' && '@odata.etag' in result) {
            (result as any).__etag = (result as any)['@odata.etag'];
        }
        return result as T;
    }

    // ── PATCH (update) ────────────────────────────────────────────────────────
    //
    // Pass entity.__etag as `etag` to satisfy CAP optimistic concurrency.
    // If-Match: * skips concurrency check (use only if intentional).

    async update(id: string | number, data: Partial<T>, etag?: string): Promise<T> {
        const headers: Record<string, string> = {};
        if (etag) headers['If-Match'] = etag;
        const response = await axiosInstance.patch<T>(
            `${this.basePath}(${this.formatKey(id)})`,
            data,
            Object.keys(headers).length > 0 ? { headers } : undefined
        );
        return response.data;
    }

    // ── DELETE ────────────────────────────────────────────────────────────────

    async delete(id: string | number, etag?: string): Promise<void> {
        const headers: Record<string, string> = {};
        if (etag) headers['If-Match'] = etag;
        await axiosInstance.delete(
            `${this.basePath}(${this.formatKey(id)})`,
            Object.keys(headers).length > 0 ? { headers } : undefined
        );
    }

    // ── Bound action (POST on entity set or single entity) ────────────────────

    async callAction<TResult = any>(actionName: string, data: Record<string, any> = {}): Promise<TResult> {
        const response = await axiosInstance.post<TResult>(`${this.basePath}/${actionName}`, data);
        return response.data;
    }

    // ── Unbound action (POST on service root) ─────────────────────────────────

    async callUnboundAction<TResult = any>(actionName: string, data: Record<string, any> = {}): Promise<TResult> {
        const response = await axiosInstance.post<TResult>(`${this.serviceName}/${actionName}`, data);
        return response.data;
    }

    // ── Function import (GET with URL params) ─────────────────────────────────

    async callFunction<TResult = any>(functionName: string, params: Record<string, any> = {}): Promise<TResult> {
        const qs = Object.entries(params)
            .map(([k, v]) => `${k}=${encodeURIComponent(this.formatValue(v))}`)
            .join('&');
        const response = await axiosInstance.get<TResult>(
            `${this.basePath}/${functionName}${qs ? '?' + qs : ''}`
        );
        return response.data;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    protected formatKey(id: string | number): string {
        return typeof id === 'string' ? `'${id}'` : String(id);
    }

    protected formatValue(value: any): string {
        if (typeof value === 'string') return `'${value}'`;
        if (value instanceof Date) return value.toISOString();
        return String(value);
    }
}
