import { createHash } from 'node:crypto';

import type { CaseContext, DisciplineCode, DisciplineDraft } from './types';

export type RuntimeScalarType = 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'object' | 'array';

export interface RuntimeFieldConstraints {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    minItems?: number;
    maxItems?: number;
    pattern?: string;
    enum?: unknown[];
}

export interface RuntimeFormField {
    key: string;
    label: string;
    widget: string;
    type: RuntimeScalarType;
    width?: string;
    visible: boolean;
    colSpan: number;
    rowSpan: number;
    constraints: RuntimeFieldConstraints;
    /**
     * Ai điền trường này. `ai_enrichment` (mặc định) là AI sinh; mọi giá trị
     * khác — `manual_input`, `sap_qm`, `vector_search` — là dữ liệu đến từ nơi
     * khác và AI KHÔNG được ghi.
     */
    source?: string;
    items?: RuntimeFieldDefinition;
    properties?: Record<string, RuntimeFieldDefinition>;
}

export interface RuntimeFieldDefinition {
    type: RuntimeScalarType;
    title?: string;
    description?: string;
    format?: string;
    /** Giới hạn độ dài khai trong Data Schema, kể cả cho phần tử của mảng. */
    maxLength?: number;
    items?: RuntimeFieldDefinition;
    properties?: Record<string, RuntimeFieldDefinition>;
    required?: string[];
    enum?: unknown[];
}

export interface RuntimeFormSchema {
    version: 1;
    fields: RuntimeFormField[];
    groups: Array<{ id: string; label: string; fieldKeys: string[]; width?: string; columns: number; order: number }>;
    spacers: Array<{ id: string; groupId: string; order: number; colSpan: number; height: 'small' | 'medium' | 'large' }>;
}

export interface RuntimeRule {
    id: string;
    type: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    enabled: boolean;
    field?: string;
    pattern?: string;
    inputFields?: string[];
    min?: number;
    max?: number;
    enum?: unknown[];
}

export interface RuntimeStepConfig {
    version: 1;
    stepCode: DisciplineCode;
    enabled: boolean;
    configVersion: string;
    inputSchema: { type: 'object'; properties: Record<string, RuntimeFieldDefinition>; required: string[] } | null;
    formSchema: RuntimeFormSchema | null;
    rules: RuntimeRule[];
}

export interface InputDiagnostic {
    path: string;
    status: 'resolved' | 'missing' | 'type-invalid';
    expectedType?: RuntimeScalarType;
    actualType?: string;
}

export interface ValidationViolation {
    ruleId: string;
    path: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
}

const SUPPORTED_TYPES = new Set<RuntimeScalarType>(['string', 'number', 'integer', 'boolean', 'date', 'object', 'array']);
const SUPPORTED_RULES = new Set(['required', 'length', 'range', 'enum', 'citationRequired', 'sourcePattern', 'requiredDisclosure', 'dataBackedWhenInputPresent']);

function objectValue(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('configuration must be a JSON object');
    return value as Record<string, unknown>;
}

function parseJson(value: string, name: string): Record<string, unknown> | null {
    if (!value.trim()) return null;
    try { return objectValue(JSON.parse(value)); }
    catch (error) { throw new Error(`${name}: ${error instanceof Error ? error.message : 'invalid JSON'}`); }
}

function normalizeDefinition(value: unknown, path: string): RuntimeFieldDefinition {
    const source = objectValue(value);
    const type = String(source.type ?? 'string') as RuntimeScalarType;
    if (!SUPPORTED_TYPES.has(type)) throw new Error(`${path}: unsupported type ${type}`);
    const properties = type === 'object' && source.properties
        ? Object.fromEntries(Object.entries(objectValue(source.properties)).map(([key, item]) => [key, normalizeDefinition(item, `${path}.${key}`)]))
        : undefined;
    return {
        type,
        title: typeof source.title === 'string' ? source.title : undefined,
        description: typeof source.description === 'string' ? source.description : undefined,
        format: typeof source.format === 'string' ? source.format : undefined,
        items: type === 'array' && source.items ? normalizeDefinition(source.items, `${path}[]`) : undefined,
        properties,
        required: Array.isArray(source.required) ? source.required.map(String) : undefined,
        enum: Array.isArray(source.enum) ? source.enum : undefined,
        maxLength: typeof source.maxLength === 'number' ? source.maxLength : undefined,
    };
}

function inferFieldDefinition(key: string, field: Record<string, unknown>, dataDefinitions: Record<string, RuntimeFieldDefinition>): RuntimeFieldDefinition {
    if (field.dataType || field.type) return normalizeDefinition({ type: field.dataType ?? field.type, items: field.items, properties: field.properties, required: field.required, enum: field.enum }, `form field ${key}`);
    const configured = getDefinitionPath(dataDefinitions, key);
    if (configured) return configured;
    const widget = String(field.widget ?? 'input');
    if (widget === 'checkbox' || widget === 'status') return { type: 'boolean' };
    if (widget === 'number') return { type: 'number' };
    if (widget === 'tag-selector' || widget === 'multiSelect' || widget === 'table') return { type: 'array', items: { type: 'string' } };
    return { type: 'string' };
}

function getDefinitionPath(definitions: Record<string, RuntimeFieldDefinition>, path: string): RuntimeFieldDefinition | undefined {
    if (definitions[path]) return definitions[path];
    const parts = path.split('.');
    let current: RuntimeFieldDefinition | undefined = definitions[parts[0]];
    for (let index = 1; current && index < parts.length; index += 1) current = current.properties?.[parts[index]];
    return current;
}

function flattenDefinitionPaths(definitions: Record<string, RuntimeFieldDefinition>, prefix = ''): string[] {
    return Object.entries(definitions).flatMap(([key, definition]) => {
        if (key.includes('.')) return [key];
        const path = prefix ? `${prefix}.${key}` : key;
        return definition.type === 'object' && definition.properties ? flattenDefinitionPaths(definition.properties, path) : [path];
    });
}

export function normalizeStepConfig(stepCode: DisciplineCode, raw: { enabled?: boolean; version?: number; inputSchemaJson?: string; formSchemaJson?: string; constraintsJson?: string }): RuntimeStepConfig {
    const input = parseJson(raw.inputSchemaJson ?? '', 'inputSchemaJson');
    const inputProperties = input?.properties ? objectValue(input.properties) : {};
    const definitions = Object.fromEntries(Object.entries(inputProperties).map(([key, value]) => [key, normalizeDefinition(value, key)]));
    const form = parseJson(raw.formSchemaJson ?? '', 'formSchemaJson');
    const seen = new Set<string>();
    const fields = Array.isArray(form?.fields) ? form.fields.map((item, index) => {
        const field = objectValue(item);
        const key = String(field.binding ?? field.key ?? '').trim();
        if (!key || key.split('.').some((part) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(part))) throw new Error(`formSchemaJson.fields[${index}]: invalid key path`);
        if (seen.has(key)) throw new Error(`formSchemaJson: duplicate field path ${key}`);
        seen.add(key);
        const definition = inferFieldDefinition(key, field, definitions);
        const constraints = field.constraints ? objectValue(field.constraints) as RuntimeFieldConstraints : {};
        return {
            key,
            label: String(field.label ?? definition.title ?? key),
            widget: String(field.widget ?? 'input'),
            type: definition.type,
            width: typeof field.width === 'string' ? field.width : undefined,
            visible: field.visible !== false,
            colSpan: Math.max(1, Number(field.colSpan ?? 1)),
            rowSpan: Math.max(1, Number(field.rowSpan ?? 1)),
            constraints,
            source: typeof field.xSource === 'string' ? field.xSource : undefined,
            items: definition.items,
            properties: definition.properties,
        } satisfies RuntimeFormField;
    }) : [];
    if (input && form) {
        const dataPaths = new Set(flattenDefinitionPaths(definitions));
        const formPaths = new Set(fields.map((field) => field.key));
        const missingInDataSchema = [...formPaths].filter((path) => !dataPaths.has(path));
        const missingInFormEditor = [...dataPaths].filter((path) => !formPaths.has(path));
        if (missingInDataSchema.length || missingInFormEditor.length) {
            throw new Error(`Data Schema and Form Editor fields must match. Missing in Data Schema: ${missingInDataSchema.join(', ') || 'none'}. Missing in Form Editor: ${missingInFormEditor.join(', ') || 'none'}.`);
        }
        for (const field of fields) {
            const definition = getDefinitionPath(definitions, field.key)!;
            if (definition.type !== field.type) throw new Error(`Field ${field.key} has type ${definition.type} in Data Schema but ${field.type} in Form Editor`);
        }
    }
    const groups = Array.isArray(form?.groups) ? form.groups.map((item, index) => {
        const group = objectValue(item);
        const fieldKeys = Array.isArray(group.fieldKeys) ? group.fieldKeys.map(String) : [];
        const unknown = fieldKeys.filter((key) => !seen.has(key));
        if (unknown.length) throw new Error(`formSchemaJson.groups[${index}]: unknown fields ${unknown.join(', ')}`);
        return { id: String(group.id ?? `group-${index + 1}`), label: String(group.label ?? ''), fieldKeys, width: typeof group.width === 'string' ? group.width : undefined, columns: Math.max(1, Number(group.columns ?? 1)), order: Number(group.order ?? index) };
    }) : [];
    const spacers = Array.isArray(form?.spacers) ? form.spacers.map((item, index) => {
        const spacer = objectValue(item);
        return { id: String(spacer.id ?? `spacer-${index + 1}`), groupId: String(spacer.groupId ?? ''), order: Number(spacer.order ?? index), colSpan: Math.max(1, Number(spacer.colSpan ?? 1)), height: (['small', 'medium', 'large'].includes(String(spacer.height)) ? spacer.height : 'small') as 'small' | 'medium' | 'large' };
    }) : [];
    const constraints = parseJson(raw.constraintsJson ?? '', 'constraintsJson');
    const rules = constraints?.enabled === false || !Array.isArray(constraints?.rules) ? [] : constraints.rules.map((item, index) => {
        const rule = objectValue(item);
        const type = String(rule.type ?? '');
        if (!SUPPORTED_RULES.has(type)) throw new Error(`constraintsJson.rules[${index}]: unsupported rule type ${type}`);
        const severity = String(rule.severity ?? 'warning');
        if (!['error', 'warning', 'info'].includes(severity)) throw new Error(`constraintsJson.rules[${index}]: invalid severity ${severity}`);
        return { id: String(rule.id ?? `${stepCode}_RULE_${index + 1}`), type, severity: severity as RuntimeRule['severity'], message: String(rule.message ?? type), enabled: rule.enabled !== false, field: typeof rule.field === 'string' ? rule.field : undefined, pattern: typeof rule.pattern === 'string' ? rule.pattern : undefined, inputFields: Array.isArray(rule.inputFields) ? rule.inputFields.map(String) : undefined, min: typeof rule.min === 'number' ? rule.min : undefined, max: typeof rule.max === 'number' ? rule.max : undefined, enum: Array.isArray(rule.enum) ? rule.enum : undefined };
    });
    const normalized = { version: 1 as const, stepCode, enabled: raw.enabled !== false, inputSchema: input ? { type: 'object' as const, properties: definitions, required: Array.isArray(input.required) ? input.required.map(String) : [] } : null, formSchema: form ? { version: 1 as const, fields, groups, spacers } : null, rules };
    return { ...normalized, configVersion: createHash('sha256').update(JSON.stringify(normalized)).digest('hex').slice(0, 16) };
}

export function getPath(root: unknown, path: string): unknown {
    let current = root;
    for (const segment of path.split('.')) {
        if (Array.isArray(current)) {
            const index = Number(segment);
            if (!Number.isInteger(index)) return undefined;
            current = current[index];
        } else if (current && typeof current === 'object') current = (current as Record<string, unknown>)[segment];
        else return undefined;
    }
    return current;
}

export function setPath(root: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    let current = root;
    for (let index = 0; index < parts.length - 1; index += 1) {
        const part = parts[index];
        const next = current[part];
        if (!next || typeof next !== 'object' || Array.isArray(next)) current[part] = {};
        current = current[part] as Record<string, unknown>;
    }
    current[parts.at(-1)!] = value;
}

function actualType(value: unknown): string { return Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value; }
function matchesType(value: unknown, type: RuntimeScalarType): boolean {
    if (type === 'date') return typeof value === 'string' && !Number.isNaN(Date.parse(value));
    if (type === 'integer') return Number.isInteger(value);
    if (type === 'array') return Array.isArray(value);
    if (type === 'object') return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    return typeof value === type;
}

export function resolveConfiguredInput(config: RuntimeStepConfig, sources: Record<string, unknown>): { input: Record<string, unknown>; diagnostics: InputDiagnostic[] } {
    if (!config.enabled || !config.inputSchema) return { input: sources, diagnostics: [] };
    const input: Record<string, unknown> = {};
    const diagnostics: InputDiagnostic[] = [];
    for (const [path, definition] of Object.entries(config.inputSchema.properties)) {
        const value = getPath(sources, path);
        if (value === undefined) diagnostics.push({ path, status: 'missing', expectedType: definition.type });
        else if (!matchesType(value, definition.type)) diagnostics.push({ path, status: 'type-invalid', expectedType: definition.type, actualType: actualType(value) });
        else { setPath(input, path, value); diagnostics.push({ path, status: 'resolved', expectedType: definition.type, actualType: actualType(value) }); }
    }
    return { input, diagnostics };
}

export function buildFlexibleResponseSchema(configs: Partial<Record<DisciplineCode, RuntimeStepConfig>>): Record<string, unknown> {
    void configs;
    // AI Core expands nested dynamic properties into a serving state machine. Keep
    // only the stable envelope here; Data Schema is enforced by backend validation.
    const data: Record<string, unknown> = { type: 'object' };
    const disciplineProperties = {
        code: { type: 'string', enum: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'] },
        sequence: { type: 'integer' },
        title: { type: 'string' },
        summary: { type: 'string' },
        content: { type: 'string' },
        actionItems: { type: 'array', items: { type: 'string' } },
        sources: { type: 'array', items: { type: 'string' } },
        confidence: { type: 'number' },
        dataBacked: { type: 'boolean' },
        data,
    };
    return {
        type: 'object',
        properties: {
            internalSummary: { type: 'string' },
            customerSummary: { type: 'string', nullable: true },
            disciplines: {
                type: 'array',
                minItems: 8,
                maxItems: 8,
                items: { type: 'object', properties: disciplineProperties, required: Object.keys(disciplineProperties) },
            },
        },
        required: ['internalSummary', 'customerSummary', 'disciplines'],
    };
}

const JSON_TYPE: Record<RuntimeScalarType, string> = {
    string: 'string', number: 'number', integer: 'integer',
    boolean: 'boolean', date: 'string', object: 'object', array: 'array',
};

/**
 * Đổi một định nghĩa trường thành JSON Schema, hoặc `null` khi không mô tả nổi.
 *
 * `null` chứ không phải `{type:'object'}` rỗng là có chủ ý: object không có
 * `properties` khiến structured output của model hoặc bị từ chối, hoặc sinh ra
 * thứ tuỳ hứng. Thà bỏ trường đó khỏi schema — kết quả xấu nhất là nó không
 * được điền, đúng bằng tình trạng hiện tại, chứ không kéo cả bước chết theo.
 */
function definitionSchema(def: RuntimeFieldDefinition | undefined): Record<string, unknown> | null {
    if (!def) return null;
    const type = JSON_TYPE[def.type] ?? 'string';

    if (type === 'object') {
        const entries = Object.entries(def.properties ?? {}).flatMap(([key, value]) => {
            const schema = definitionSchema(value);
            return schema ? [[key, schema] as const] : [];
        });
        if (!entries.length) return null;
        const properties = Object.fromEntries(entries);
        const required = (def.required ?? []).filter((key) => key in properties);
        return { type: 'object', properties, ...(required.length ? { required } : {}) };
    }

    if (type === 'array') {
        const items = definitionSchema(def.items);
        return items ? { type: 'array', items } : null;
    }

    return {
        type,
        ...(def.enum?.length ? { enum: def.enum } : {}),
        // Chuỗi BÊN TRONG phần tử mảng là chỗ nguy hiểm nhất: `maxItems` chỉ chặn
        // SỐ phần tử, không chặn độ dài từng phần tử. Một `fiveWhy[].answer`
        // không trần là đủ để model viết hết 32.000 token trong đúng một phần tử.
        // Đây chính là lỗ đã làm D4 chết vì `finishReason=length`.
        ...(type === 'string' && !def.enum?.length
            ? { maxLength: def.maxLength ?? DEFAULT_MAX_ITEM_STRING }
            : {}),
        ...(def.description ? { description: def.description } : {}),
    };
}

/**
 * Trần mặc định cho mảng không tự khai `maxItems`.
 *
 * Mảng không có trần là lời mời lặp: model nhỏ được cấp hạn mức token rộng sẽ
 * viết tiếp cho đến khi hết chỗ. Đo thực tế: `rootCause.evidenceGaps` trả về 10
 * phần tử trên một case không có dữ liệu điều tra nào.
 *
 * Đây là chốt chặn chạy loạn, không phải luật nghiệp vụ — đặt rộng để không cắt
 * mất output hợp lệ. Bước nào cần chặt hơn thì khai `maxItems` trong Form Editor.
 */
const DEFAULT_MAX_ITEMS = 10;

/**
 * Trần độ dài mặc định cho chuỗi nằm TRONG phần tử mảng.
 *
 * Chặt hơn trần của trường đơn lẻ vì nó nhân với `maxItems`: 10 × 240 ký tự đã
 * là ~2.400 ký tự cho một mảng. Các trường ở đây là câu why/answer/evidence/gap —
 * 600 ký tự là rộng rãi. Cần dài hơn thì khai `maxLength` trong Data Schema,
 * giá trị khai luôn thắng.
 */
const DEFAULT_MAX_ITEM_STRING = 240;

/**
 * Trần độ dài mặc định cho trường chuỗi đơn lẻ.
 *
 * Rộng hơn vì nó không bị nhân lên, nhưng vẫn phải có: một chuỗi không trần là
 * đường chạy loạn bất kể nó nằm ở đâu.
 */
const DEFAULT_MAX_FIELD_STRING = 700;

function fieldSchema(field: RuntimeFormField): Record<string, unknown> | null {
    const type = JSON_TYPE[field.type] ?? 'string';

    if (type === 'array') {
        const items = definitionSchema(field.items);
        if (!items) return null;
        return {
            type: 'array',
            items,
            ...(field.constraints.minItems ? { minItems: field.constraints.minItems } : {}),
            maxItems: field.constraints.maxItems ?? DEFAULT_MAX_ITEMS,
        };
    }

    if (type === 'object') {
        return definitionSchema({ type: 'object', properties: field.properties });
    }

    return {
        type,
        ...(field.constraints.enum?.length ? { enum: field.constraints.enum } : {}),
        // Giới hạn độ dài CÓ trong cấu hình nhưng trước đây bị bỏ khi dựng schema,
        // nên `rootCause.statement` khai maxLength 800 mà model không hề bị chặn.
        ...(field.constraints.minLength ? { minLength: field.constraints.minLength } : {}),
        ...(field.constraints.enum?.length
            ? {}
            : { maxLength: field.constraints.maxLength ?? DEFAULT_MAX_FIELD_STRING }),
        ...(field.label ? { description: field.label } : {}),
    };
}

interface SchemaNode {
    children: Map<string, SchemaNode>;
    leaf?: Record<string, unknown>;
    required: boolean;
}

const emptyNode = (): SchemaNode => ({ children: new Map(), required: false });

function nodeToSchema(node: SchemaNode): Record<string, unknown> | null {
    if (node.leaf) return node.leaf;

    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, child] of node.children) {
        const schema = nodeToSchema(child);
        if (!schema) continue;
        properties[key] = schema;
        // Object cha bắt buộc khi có ít nhất một con bắt buộc — nếu không, model
        // được phép bỏ cả nhánh và ràng buộc của con thành vô nghĩa.
        if (child.required || (!child.leaf && [...child.children.values()].some((c) => c.required))) {
            required.push(key);
        }
    }
    if (!Object.keys(properties).length) return null;
    return { type: 'object', properties, ...(required.length ? { required } : {}) };
}

/**
 * Dựng JSON Schema cho `discipline.data` từ Form Editor của bước.
 *
 * Vì sao cần: prompt CÓ liệt kê `constraints.enum` và `minItems`, nhưng prompt
 * chỉ là lời khuyên. Response schema mới là thứ model bị ràng buộc khi sinh
 * token. Đo trên gemini-2.5-flash với `data: {type:'object'}` rỗng:
 * `team.selectionMethod` trả về chuỗi ngoài danh sách cho phép, và
 * `rootCause.fiveWhy` (bắt buộc, minItems 1) bị bỏ trắng. Cả hai đều là thứ
 * constrained decoding chặn được tuyệt đối.
 *
 * Trả `undefined` khi bước không có form hoặc không trường nào mô tả được —
 * bên gọi khi đó dùng lại envelope phẳng như cũ.
 */
export function buildStepDataSchema(config: RuntimeStepConfig | undefined): Record<string, unknown> | undefined {
    const fields = config?.formSchema?.fields;
    if (!fields?.length) return undefined;

    const root = emptyNode();
    for (const field of fields) {
        // Trường do người hoặc hệ thống khác điền thì KHÔNG đưa vào response
        // schema. Prompt đã dặn "never output team.assignedRoster", nhưng dặn
        // chỉ là dặn — bỏ hẳn khỏi schema thì model không có chỗ để ghi.
        if (field.source && field.source !== 'ai_enrichment') continue;

        const schema = fieldSchema(field);
        if (!schema) continue;

        const parts = field.key.split('.');
        let node = root;
        for (const part of parts.slice(0, -1)) {
            if (!node.children.has(part)) node.children.set(part, emptyNode());
            node = node.children.get(part)!;
        }
        const last = parts[parts.length - 1];
        const child = node.children.get(last) ?? emptyNode();
        child.leaf = schema;
        child.required = Boolean(field.constraints.required);
        node.children.set(last, child);
    }

    return nodeToSchema(root) ?? undefined;
}

export function validateFlexibleResult(discipline: DisciplineDraft, config: RuntimeStepConfig, effectiveInput: Record<string, unknown>): ValidationViolation[] {
    if (!config.enabled || !config.formSchema) return [];
    const violations: ValidationViolation[] = [];
    for (const field of config.formSchema.fields) {
        const value = getPath(discipline.data, field.key);
        const path = `data.${field.key}`;
        const add = (message: string, severity: ValidationViolation['severity'] = 'error', ruleId = `field:${field.key}`) => violations.push({ ruleId, path, severity, message });
        if (field.constraints.required && (value === undefined || value === null || value === '')) add(`${field.label} is required`);
        if (value === undefined || value === null) continue;
        if (!matchesType(value, field.type)) { add(`${field.label} must be ${field.type}`); continue; }
        if (typeof value === 'string') {
            if (field.constraints.minLength !== undefined && value.length < field.constraints.minLength) add(`${field.label} is shorter than ${field.constraints.minLength}`);
            if (field.constraints.maxLength !== undefined && value.length > field.constraints.maxLength) add(`${field.label} is longer than ${field.constraints.maxLength}`);
            if (field.constraints.pattern && !new RegExp(field.constraints.pattern).test(value)) add(`${field.label} does not match the configured pattern`);
        }
        if (typeof value === 'number') {
            if (field.constraints.min !== undefined && value < field.constraints.min) add(`${field.label} is below ${field.constraints.min}`);
            if (field.constraints.max !== undefined && value > field.constraints.max) add(`${field.label} is above ${field.constraints.max}`);
        }
        if (Array.isArray(value) && field.constraints.minItems !== undefined && value.length < field.constraints.minItems) add(`${field.label} requires at least ${field.constraints.minItems} items`);
        if (field.constraints.enum && !field.constraints.enum.includes(value)) add(`${field.label} is not an allowed value`);
    }
    for (const rule of config.rules.filter((item) => item.enabled)) {
        const value = getPath(discipline.data, rule.field ?? 'content') ?? getPath(discipline, rule.field ?? 'content');
        const add = () => violations.push({ ruleId: rule.id, path: rule.field ?? 'content', severity: rule.severity, message: rule.message });
        if (rule.type === 'required' && (value === undefined || value === null || value === '')) add();
        if (rule.type === 'citationRequired' && discipline.sources.length === 0) add();
        if (rule.type === 'sourcePattern' && rule.pattern && discipline.sources.some((source) => !new RegExp(rule.pattern!).test(source))) add();
        if (rule.type === 'requiredDisclosure' && rule.pattern && !new RegExp(rule.pattern, 'i').test(String(value ?? ''))) add();
        if (rule.type === 'dataBackedWhenInputPresent' && discipline.dataBacked && !(rule.inputFields ?? []).some((path) => getPath(effectiveInput, path) != null)) add();
        if (rule.type === 'enum' && rule.enum && !rule.enum.includes(value)) add();
        if (rule.type === 'range' && typeof value === 'number' && ((rule.min !== undefined && value < rule.min) || (rule.max !== undefined && value > rule.max))) add();
        if (rule.type === 'length' && typeof value === 'string' && ((rule.min !== undefined && value.length < rule.min) || (rule.max !== undefined && value.length > rule.max))) add();
    }
    return violations;
}

export function syncLegacyFields(discipline: DisciplineDraft): void {
    const data = discipline.data ?? {};
    for (const [path, value] of Object.entries(data)) {
        if (!path.includes('.')) continue;
        setPath(data, path, value);
        delete data[path];
    }
    if (typeof data.summary === 'string') discipline.summary = data.summary;
    if (typeof data.content === 'string') discipline.content = data.content;
    if (Array.isArray(data.actionItems)) discipline.actionItems = data.actionItems.map(String);
    if (Array.isArray(data.sources)) discipline.sources = data.sources.map(String);
    if (typeof data.confidence === 'number') discipline.confidence = data.confidence;
    if (typeof data.dataBacked === 'boolean') discipline.dataBacked = data.dataBacked;
}

export function buildRuntimeSources(context: CaseContext, enrichment: unknown, independent: unknown, precedents: unknown): Record<string, unknown> {
    const precedentList = Array.isArray(precedents) ? precedents : [];
    const enrichmentRecord = enrichment && typeof enrichment === 'object' ? enrichment as Record<string, unknown> : {};
    return {
        ...context,
        caseContext: context,
        enrichment,
        derivedFacts: enrichmentRecord.derivedFacts ?? [],
        independent,
        precedents: precedentList,
        teamMembers: [context.team.leader, ...context.team.members].filter(Boolean),
        teamSize: [context.team.leader, ...context.team.members].filter(Boolean).length,
        precedentTeams: precedentList.map((item, index) => ({
            source: `precedents#${index + 1}`,
            members: item && typeof item === 'object' ? (item as Record<string, unknown>).team ?? [] : [],
        })),
    };
}
