/**
 * Module thuần tính toán danh sách các trường thông tin AI cần xác nhận (Confirm)
 * cho từng bước 8D và kiểm tra trạng thái xác nhận.
 *
 * ── Nguyên tắc ──
 * Không import cds, không chạm DB. Đảm bảo logic tính toán thống nhất giữa backend
 * (chặn duyệt khi chưa confirm đủ) và frontend (hiển thị nút confirm, disable Complete).
 */

export interface SchemaField {
    key: string;
    label?: string;
    widget?: string;
    visible?: boolean;
    binding?: string;
}

export interface SchemaGroup {
    id: string;
    label?: string;
    fieldKeys: string[];
    order?: number;
}

export interface FormSchemaSnapshot {
    fields: SchemaField[];
    groups?: SchemaGroup[];
}

/** Các widget không hiển thị nội dung trích xuất của AI từ resultJson. */
export const NON_CONFIRMABLE_WIDGETS = new Set([
    'closure-gate',         // Đọc trạng thái duyệt của các siblings
    'complaint-reference',   // Đọc trực tiếp từ CaseContext (master data SAP)
]);

/**
 * Kiểm tra xem một trường có bị loại trừ khỏi layout hiển thị của bước D đó hay không.
 * Đồng bộ chính xác với logic `isExcludedField` trên giao diện.
 */
export function isExcludedDisciplineField(code: string, key: string, label?: string): boolean {
    const l = (label || '').toLowerCase();
    if (code === 'D3') {
        if (
            key === 'containment.gaps'
            || key === 'sources'
            || key === 'containment.objective'
            || key === 'objective'
            || l.includes('containment objective')
            || l.includes('objective')
        ) return true;
    }
    if (code === 'D4' && (key === 'rootCause.evidenceGaps' || key === 'sources')) return true;
    if (code === 'D5') {
        if (
            key === 'sources'
            || key === 'corrective.objective'
            || key === 'objective'
            || key === 'corrective.rootCauseCoverage'
            || key === 'corrective.coverageAssessment'
            || key === 'corrective.uncoveredCauses'
            || key === 'corrective.uncoveredRootCauseElements'
            || key === 'rootCauseCoverage'
            || key === 'coverageAssessment'
            || key === 'uncoveredCauses'
            || key === 'uncoveredRootCauseElements'
            || key === 'howEachActionRemovesTheCause'
        ) return true;
        if (
            l.includes('corrective objective')
            || l.includes('objective')
            || l.includes('removes the cause')
            || l.includes('removes cause')
            || l.includes('not yet covered')
            || l.includes('uncovered cause')
            || l.includes('root cause coverage')
            || l.includes('coverage assessment')
            || l.includes('evidence and traceability')
            || l.includes('source records')
            || l.includes('evidence sources')
        ) return true;
    }
    if (code === 'D6') {
        if (
            key === 'sources'
            || key === 'verification.evidenceStatus'
            || key === 'verification.status'
            || key === 'evidenceStatus'
            || key === 'verification.whatIsStillUnproven'
            || key === 'verification.unproven'
            || key === 'verification.gaps'
            || key === 'verification.unprovenGaps'
            || key === 'whatIsStillUnproven'
            || key === 'unproven'
        ) return true;
        if (
            l.includes('evidence status')
            || l.includes('unproven')
            || l.includes('evidence and traceability')
            || l.includes('source records')
            || l.includes('evidence sources')
        ) return true;
    }
    if (code === 'D7') {
        if (
            key === 'sources'
            || key === 'preventive.objective'
            || key === 'objective'
            || key === 'preventive.systemicScope'
            || key === 'preventive.whereElseThisApplies'
            || key === 'preventive.whereElse'
            || key === 'systemicScope'
            || key === 'whereElseThisApplies'
            || key === 'whereElse'
            || key === 'preventive.gaps'
            || key === 'preventive.openGaps'
            || key === 'preventive.preventiveGaps'
            || key === 'preventive.openPreventiveGaps'
            || key === 'openPreventiveGaps'
            || key === 'preventiveGaps'
            || key === 'openGaps'
            || key === 'gaps'
        ) return true;
        if (
            l.includes('preventive objective')
            || l.includes('objective')
            || l.includes('where else')
            || l.includes('systemic scope')
            || l.includes('preventive gap')
            || l.includes('open gap')
            || l.includes('open preventive')
            || l.includes('evidence and traceability')
            || l.includes('source records')
            || l.includes('evidence sources')
        ) return true;
    }
    if (code === 'D8') {
        if (
            key === 'sources'
            || key === 'closure.openItems'
            || key === 'closure.stillOpenAtClosure'
            || key === 'closure.openGaps'
            || key === 'closure.gaps'
            || key === 'openItems'
            || key === 'stillOpenAtClosure'
            || key === 'stillOpen'
        ) return true;
        if (
            l.includes('still open')
            || l.includes('open items')
            || l.includes('evidence and traceability')
            || l.includes('source records')
            || l.includes('evidence sources')
        ) return true;
    }
    return false;
}

/**
 * Trích xuất danh sách tất cả các fieldKey của AI cần được confirm trong bước D.
 *
 * @param formSchemaJson Chuỗi JSON snapshot schema của form
 * @param code Mã bước ('D1' .. 'D8')
 */
export function getRequiredConfirmFields(formSchemaJson: string | null | undefined, code: string): string[] {
    if (!formSchemaJson) return [];
    let schema: FormSchemaSnapshot | null = null;
    try {
        const parsed = JSON.parse(formSchemaJson);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.fields)) {
            schema = parsed as FormSchemaSnapshot;
        }
    } catch {
        return [];
    }
    if (!schema) return [];

    const fieldMap = new Map<string, SchemaField>();
    for (const f of schema.fields ?? []) {
        const key = String(f.binding?.trim() || f.key || '').trim();
        if (key) {
            fieldMap.set(key, { ...f, key });
        }
    }

    const groups = [...(schema.groups ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const result: string[] = [];
    const seen = new Set<string>();

    for (const group of groups) {
        for (const key of group.fieldKeys ?? []) {
            const field = fieldMap.get(key);
            if (!field) continue;
            if (field.visible === false) continue;
            if (NON_CONFIRMABLE_WIDGETS.has(String(field.widget ?? ''))) continue;
            if (isExcludedDisciplineField(code, key, field.label)) continue;
            if (!seen.has(key)) {
                seen.add(key);
                result.push(key);
            }
        }
    }

    return result;
}

/**
 * Đọc mảng các fieldKey đã confirm từ chuỗi JSON lưu trong CSDL.
 */
export function parseConfirmedFields(json: string | null | undefined): string[] {
    if (!json) return [];
    try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed)
            ? parsed.map(String).map((s) => s.trim()).filter(Boolean)
            : [];
    } catch {
        return [];
    }
}

/**
 * Đánh giá trạng thái xác nhận các trường AI của bước D.
 */
export function checkFieldConfirmation(
    requiredKeys: readonly string[],
    confirmedKeys: readonly string[],
): { allConfirmed: boolean; missingKeys: string[]; confirmedCount: number; totalRequired: number } {
    const confirmedSet = new Set(confirmedKeys);
    const missingKeys = requiredKeys.filter((k) => !confirmedSet.has(k));
    const totalRequired = requiredKeys.length;
    const confirmedCount = totalRequired - missingKeys.length;

    return {
        allConfirmed: missingKeys.length === 0,
        missingKeys,
        confirmedCount,
        totalRequired,
    };
}
