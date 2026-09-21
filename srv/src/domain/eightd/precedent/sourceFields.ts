/**
 * Flatten SAP payload to path map, and build source field catalog for Object Schema panel.
 */

export type AttributeValue = string | string[];
export type AttributeMap = Record<string, AttributeValue>;

const MAX_DEPTH = 6;
const MAX_PATHS = 400;

function unwrapEnvelope(raw: unknown): unknown {
    if (!raw || typeof raw !== 'object') return raw;
    const obj = raw as Record<string, unknown>;
    if (!('value' in obj)) return obj;
    if (Array.isArray(obj.value)) return obj.value[0] ?? obj;
    if (obj.value && typeof obj.value === 'object') return obj.value;
    return obj;
}

function leafValue(v: unknown): string | null {
    if (v == null) return null;
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : null;
    if (typeof v === 'string') {
        const s = v.trim();
        return s === '' ? null : s;
    }
    return null;
}

export function flattenPayload(raw: unknown): AttributeMap {
    const out: AttributeMap = {};
    const collected = new Map<string, string[]>();

    const walk = (node: unknown, path: string, depth: number): void => {
        if (depth > MAX_DEPTH || collected.size > MAX_PATHS) return;

        if (Array.isArray(node)) {
            for (const item of node) walk(item, `${path}[]`, depth + 1);
            return;
        }

        if (node && typeof node === 'object') {
            for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
                walk(value, path ? `${path}.${key}` : key, depth + 1);
            }
            return;
        }

        const value = leafValue(node);
        if (value === null || !path) return;
        const bucket = collected.get(path);
        if (bucket) {
            if (!bucket.includes(value)) bucket.push(value);
        } else {
            collected.set(path, [value]);
        }
    };

    walk(unwrapEnvelope(raw), '', 0);

    for (const [path, values] of collected) {
        out[path] = values.length === 1 && !path.includes('[]') ? values[0] : values;
    }
    return out;
}

export function parseAttributes(value: unknown): AttributeMap {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as AttributeMap;
    if (typeof value !== 'string' || !value.trim()) return {};
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as AttributeMap)
            : {};
    } catch {
        return {};
    }
}

const PATH_TO_COLUMN: Readonly<Record<string, string>> = Object.freeze({
    notificationId: 'notificationId',
    origin: 'origin',
    symptomShortText: 'symptomShortText',
    status: 'sapStatus',
    quantityExtent: 'quantityExtent',
    'workCenter.workCenterId': 'workCenterId',
    'workCenter.description': 'workCenterDesc',
    'defect.defectCode': 'defectCode',
    'defect.defectText': 'defectText',
    'material.materialId': 'materialId',
    'material.description': 'materialDesc',
    'material.materialGroup': 'materialFamily',
    'batch.batchId': 'batchId',
});

const DERIVED_FIELDS: ReadonlyArray<{
    path: string;
    label: string;
    group: string;
    note: string;
    sourceTable: string;
    methods: string[];
}> = Object.freeze([
    {
        path: 'defectKeywords',
        label: 'Defect keywords',
        group: 'derived',
        note: 'Normalized defect text tokens excluding stop words. Computed at load time.',
        sourceTable: 'HistoricalCases - GD 3 Defects (Keywords)',
        methods: ['keyword'],
    },
    {
        path: 'materialFamily',
        label: 'Material group (MATKL)',
        group: 'derived',
        note: 'Material group classification used for fallback family matching.',
        sourceTable: 'HistoricalCases - GD 1 Materials (Family)',
        methods: ['exact', 'family'],
    },
    {
        path: 'rootCauseCategory',
        label: 'Root cause category',
        group: 'derived',
        note: 'Ishikawa diagram branch marked as root cause in historical investigation.',
        sourceTable: 'HistoricalCases - 5-Why & Ishikawa',
        methods: ['exact'],
    },
    {
        path: 'embedding',
        label: 'Case narrative (vector)',
        group: 'derived',
        note: 'High-dimensional vector embedding of case description text. Used for semantic search.',
        sourceTable: 'HistoricalCases.searchText (embedding)',
        methods: ['cosine'],
    },
]);

export interface SourceFieldInfo {
    path: string;
    label: string;
    group: string;
    multiValued: boolean;
    occurrence: number;
    caseCount: number;
    distinctValues: number;
    sampleValues: string[];
    column: string | null;
    indexed: boolean;
    origin: 'sap' | 'derived';
    sourceTable: string;
    methods: string[];
    note: string;
}

function humanize(path: string): string {
    const last = path.split('.').pop() ?? path;
    const words = last
        .replace(/[]/g, '')
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .trim();
    if (!words) return path;
    return words[0].toUpperCase() + words.slice(1).toLowerCase();
}

function discrimination(distinct: number, occurrence: number): string {
    if (occurrence === 0) return 'No historical cases in library contain this field.';
    if (distinct <= 1) {
        return 'All cases share the exact same value - exact match will match all cases without changing rank.';
    }
    if (distinct === occurrence && occurrence > 2) {
        return 'Every case has a unique value - likely an ID, exact match will rarely hit.';
    }
    return `${distinct} distinct values across ${occurrence} cases - good discrimination for matching.`;
}

function suggestMethods(multiValued: boolean, distinct: number, occurrence: number): string[] {
    if (distinct <= 1 || (distinct === occurrence && occurrence > 2)) return ['keyword'];
    return multiValued ? ['exact', 'keyword'] : ['exact', 'keyword', 'family'];
}

export function buildSourceFieldCatalog(payloads: readonly unknown[]): SourceFieldInfo[] {
    const caseCount = payloads.length;
    const stats = new Map<string, { occurrence: number; values: Set<string>; multi: boolean }>();

    for (const payload of payloads) {
        const flat = flattenPayload(payload);
        for (const [path, value] of Object.entries(flat)) {
            const entry = stats.get(path) ?? { occurrence: 0, values: new Set<string>(), multi: false };
            entry.occurrence++;
            if (Array.isArray(value)) {
                entry.multi = true;
                for (const item of value) if (entry.values.size < 50) entry.values.add(item);
            } else if (entry.values.size < 50) {
                entry.values.add(value);
            }
            stats.set(path, entry);
        }
    }

    const sapFields: SourceFieldInfo[] = [...stats.entries()].map(([path, entry]) => {
        const column = PATH_TO_COLUMN[path] ?? null;
        const values = [...entry.values];
        return {
            path,
            label: humanize(path),
            group: path.split('.')[0].replace(/[]$/, ''),
            multiValued: entry.multi,
            occurrence: entry.occurrence,
            caseCount,
            distinctValues: entry.values.size,
            sampleValues: values.slice(0, 3),
            column,
            indexed: column !== null,
            origin: 'sap',
            sourceTable: column ? `HistoricalCases.${column}` : 'HistoricalCases.attributesJson',
            methods: suggestMethods(entry.multi, entry.values.size, entry.occurrence),
            note: discrimination(entry.values.size, entry.occurrence),
        };
    });

    const derived: SourceFieldInfo[] = DERIVED_FIELDS.map((field) => ({
        path: field.path,
        label: field.label,
        group: field.group,
        multiValued: false,
        occurrence: caseCount,
        caseCount,
        distinctValues: 0,
        sampleValues: [],
        column: field.path,
        indexed: field.path !== 'embedding',
        origin: 'derived',
        sourceTable: field.sourceTable,
        methods: field.methods,
        note: field.note,
    }));

    return [...sapFields, ...derived].sort(
        (a, b) => a.group.localeCompare(b.group) || a.path.localeCompare(b.path),
    );
}
