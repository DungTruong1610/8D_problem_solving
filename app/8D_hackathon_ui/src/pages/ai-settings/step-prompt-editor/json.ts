export function parseConfig<T>(value: string, fallback: T): { value: T; error: string | null } {
    if (!value.trim()) return { value: fallback, error: null };
    try { return { value: JSON.parse(value) as T, error: null }; }
    catch (error) { return { value: fallback, error: error instanceof Error ? error.message : 'Invalid JSON' }; }
}

export function stringifyConfig(value: unknown): string {
    return JSON.stringify(value, null, 2);
}

export function normalizeFormSchema(value: import('./types').FormSchemaConfig, stepCode?: string): import('./types').FormSchemaConfig {
    const legacyKeys = new Set(value.fields.map((field) => field.key));
    if (stepCode === 'D1' && legacyKeys.has('leaderName') && legacyKeys.has('skillMixRationale') && legacyKeys.has('teamSources')) {
        return {
            fields: [
                { key: 'content', label: 'D1 team recommendation', widget: 'textarea', width: '100%', constraints: { required: true, minLength: 20, maxLength: 1000 } },
                { key: 'sources', label: 'Evidence sources', widget: 'tag-selector', width: '100%', constraints: { pattern: '^(team\\.|precedents#)' } },
                { key: 'confidence', label: 'Confidence', widget: 'input', width: '50%', constraints: { min: 0, max: 100 } },
                { key: 'dataBacked', label: 'Data backed', widget: 'checkbox', width: '50%', constraints: {} },
            ],
            groups: [{ id: 'team', label: 'Team assignment', fieldKeys: ['content', 'sources', 'confidence', 'dataBacked'], width: '100', columns: 2, order: 10 }],
        };
    }
    const keyMap = new Map(value.fields.map((field) => [field.key, field.binding?.trim() || field.key]));
    return {
        ...value,
        fields: value.fields.map(({ binding, ...field }) => ({ ...field, key: binding?.trim() || field.key })),
        groups: value.groups?.map((group) => ({ ...group, fieldKeys: group.fieldKeys.map((key) => keyMap.get(key) ?? key) })),
    };
}

