type SortDirection = 'asc' | 'desc';

interface QueryParams {
    $top?: number;
    $skip?: number;
    $filter?: string;
    $select?: string;
    $expand?: string;
    $orderby?: string;
    $count?: boolean;
    $search?: string;
    [key: string]: string | number | boolean | undefined;
}

/**
 * Fluent OData query builder.
 *
 * Usage:
 *   const q = new ODataQueryBuilder()
 *     .filter(ODataFilter.contains('name', search))
 *     .orderBy('createdAt', 'desc')
 *     .top(20)
 *     .count();
 *   const url = `${basePath}?${q.build()}`;
 */
export class ODataQueryBuilder {
    private params: QueryParams = {};

    /** $top — max records to return */
    top(value: number): this { this.params.$top = value; return this; }

    /** $skip — skip N records (pagination) */
    skip(value: number): this { this.params.$skip = value; return this; }

    /** $filter — OData filter expression */
    filter(condition: string): this { this.params.$filter = condition; return this; }

    /** $select — comma-separated field names or array */
    select(fields: string | string[]): this {
        this.params.$select = Array.isArray(fields) ? fields.join(',') : fields;
        return this;
    }

    /** $expand — navigation property to expand */
    expand(navigation: string): this { this.params.$expand = navigation; return this; }

    /** $orderby — sort by field and direction */
    orderBy(field: string, direction: SortDirection = 'asc'): this {
        this.params.$orderby = `${field} ${direction}`;
        return this;
    }

    /** $count — include total count in response */
    count(value = true): this { this.params.$count = value; return this; }

    /** $search — full-text search */
    search(term: string): this { this.params.$search = term; return this; }

    /** Build the query string (without leading '?') */
    build(): string {
        return Object.entries(this.params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
            .join('&');
    }

    reset(): this { this.params = {}; return this; }
    getParams(): QueryParams { return { ...this.params }; }
}

// ── Filter helpers ────────────────────────────────────────────────────────────

function fmt(value: string | number | boolean | Date): string {
    if (typeof value === 'string') return `'${value}'`;
    if (value instanceof Date) return value.toISOString();
    return String(value);
}

/**
 * Composable OData filter expression helpers.
 *
 * Usage:
 *   ODataFilter.and(
 *     ODataFilter.contains('name', search),
 *     ODataFilter.eq('status', 'active')
 *   )
 */
export const ODataFilter = {
    eq:                 (f: string, v: string | number | boolean | Date) => `${f} eq ${fmt(v)}`,
    ne:                 (f: string, v: string | number | boolean | Date) => `${f} ne ${fmt(v)}`,
    gt:                 (f: string, v: string | number | Date) => `${f} gt ${fmt(v)}`,
    ge:                 (f: string, v: string | number | Date) => `${f} ge ${fmt(v)}`,
    lt:                 (f: string, v: string | number | Date) => `${f} lt ${fmt(v)}`,
    le:                 (f: string, v: string | number | Date) => `${f} le ${fmt(v)}`,
    contains:           (f: string, v: string) => `contains(${f},${fmt(v)})`,
    containsIgnoreCase: (f: string, v: string) => `contains(tolower(${f}),tolower(${fmt(v)}))`,
    startsWith:         (f: string, v: string) => `startswith(${f},${fmt(v)})`,
    endsWith:           (f: string, v: string) => `endswith(${f},${fmt(v)})`,
    and:                (...conds: string[]) => `(${conds.join(' and ')})`,
    or:                 (...conds: string[]) => `(${conds.join(' or ')})`,
    not:                (cond: string) => `not (${cond})`,
    in:                 (f: string, values: (string | number)[]) =>
                            `${f} in (${values.map((v) => fmt(v as any)).join(',')})`,
};
