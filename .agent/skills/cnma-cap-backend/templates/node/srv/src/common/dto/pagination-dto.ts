/**
 * Common DTOs shared across features.
 */

/**
 * Pagination request parameters.
 */
export interface IPaginationParams {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response wrapper.
 */
export interface IPaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

/**
 * Default pagination settings.
 */
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Build paginated response.
 */
export function buildPaginatedResponse<T>(
    items: T[],
    total: number,
    page: number,
    pageSize: number
): IPaginatedResponse<T> {
    return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
    };
}

/**
 * Parse pagination from query params.
 */
export function parsePagination(params: any): IPaginationParams {
    return {
        page: Math.max(1, parseInt(params.page) || DEFAULT_PAGE),
        pageSize: Math.min(MAX_PAGE_SIZE, parseInt(params.pageSize) || DEFAULT_PAGE_SIZE),
        sortBy: params.sortBy || undefined,
        sortOrder: params.sortOrder === 'desc' ? 'desc' : 'asc',
    };
}