/**
 * `responseSchema` cho hai bước AI — ép model trả đúng hình dạng.
 *
 * Probe đã xác nhận AI Core tôn trọng schema này, kể cả `minItems`/`maxItems`
 * (xem `scripts/probe-ai.ts`). Nhờ vậy không cần parser chịu lỗi phức tạp; chỉ
 * cần một lớp phòng thủ mỏng trong `jsonExtract.ts`.
 *
 * ── Lưu ý về phương ngữ schema ──
 * Đây là schema kiểu OpenAPI mà Gemini chấp nhận, KHÔNG phải JSON Schema đầy
 * đủ. Cụ thể: dùng `nullable: true` chứ không phải `type: ['string','null']`,
 * và không có `additionalProperties` hay `patternProperties`. Vì thế mọi map
 * tự do đều phải mô hình hoá thành mảng cặp khoá-giá trị.
 */

import { DISCIPLINE_CODES } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Bước 1 — làm giàu ngữ cảnh (KHÔNG phải sinh lại CaseContext)
// ─────────────────────────────────────────────────────────────────────────────

export const SEVERITY_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const;
export type Severity = (typeof SEVERITY_LEVELS)[number];

export interface ContextEnrichment {
    /** Trường có trong dataset thô mà mapper không nhận ra. */
    unmapped: Array<{ path: string; value: string }>;
    /** Sự thật suy ra được bằng số học từ fact đã có, ví dụ 'burr là 3.2× giới hạn'. */
    derivedFacts: string[];
    /** Mâu thuẫn hoặc thiếu sót model nhận thấy trong dữ liệu. */
    dataQualityNotes: string[];
    severity: Severity;
    severityRationale: string;
}

export const ENRICHMENT_SCHEMA = {
    type: 'object',
    properties: {
        unmapped: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'Dotted path in the raw dataset' },
                    value: { type: 'string', description: 'Value rendered as text' },
                },
                required: ['path', 'value'],
            },
        },
        derivedFacts: {
            type: 'array',
            items: { type: 'string' },
            description: 'Arithmetic or comparative facts derived strictly from values already present',
        },
        dataQualityNotes: {
            type: 'array',
            items: { type: 'string' },
        },
        severity: { type: 'string', enum: [...SEVERITY_LEVELS] },
        severityRationale: { type: 'string' },
    },
    required: ['unmapped', 'derivedFacts', 'dataQualityNotes', 'severity', 'severityRationale'],
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Bước 2 — báo cáo 8D (gộp hoặc từng discipline)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ── Vì sao mọi mảng và mọi chuỗi dài ở đây đều phải có trần ──
 *
 * Đây là cái VỎ của discipline, dùng cho cả lượt gọi gộp lẫn lượt gọi từng bước.
 * `buildStepDataSchema` chỉ chặn các mảng bên trong `data`; nếu vỏ để hở thì
 * ràng buộc kia vô nghĩa — model chỉ cần lặp ở `sources` hoặc `actionItems` là
 * chạy tới hết ngân sách.
 *
 * Đã xảy ra thật: một lượt gọi `max_tokens=32000` sinh ra đúng 32.000 token rồi
 * chết vì `finishReason=length`. Dùng sạch trần không phải là thiếu chỗ — đó là
 * sinh loạn, và nâng trần lên 64k chỉ đổi lấy 64.000 token rác.
 *
 * `minItems`/`maxItems` đã được `scripts/probe-ai.ts` xác nhận là AI Core tôn
 * trọng, nên đó là chốt chặn đáng tin. `maxLength` thì CHƯA được probe kiểm —
 * để đó vì vô hại nếu bị bỏ qua, nhưng đừng coi nó là hàng rào duy nhất; giới
 * hạn độ dài văn xuôi vẫn phải nói trong prompt (xem mục STYLE).
 */
export const DISCIPLINE_ITEM_PROPERTIES = {
    code: { type: 'string', enum: [...DISCIPLINE_CODES] },
    sequence: { type: 'integer' },
    title: { type: 'string', maxLength: 120 },
    summary: {
        type: 'string',
        maxLength: 320,
        description: 'ONE sentence: the single thing a reader learns from this step.',
    },
    // Trần ở đây là LƯỚI AN TOÀN chống sinh loạn, không phải mục tiêu độ dài.
    // Đặt nó quá sát là ép cắt giữa câu; đặt quá rộng là mời model viết cho đầy
    // (đã xảy ra ở mốc 6.000). Đủ rộng để một câu trả lời viết tốt không bao giờ
    // chạm tới — còn việc nói đúng trọng tâm là do mục STYLE lo.
    content: {
        type: 'string',
        maxLength: 1_600,
        description: 'Markdown bullets. Only what the reader needs to act — see the STYLE rules.',
    },
    actionItems: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 220 } },
    sources: {
        type: 'array',
        maxItems: 15,
        items: { type: 'string', maxLength: 120 },
        description:
            "CaseContext paths this discipline rests on, e.g. 'actions.containment#1', " +
            "'ishikawa.Machine', 'fiveWhy#2', 'inspections#1'",
    },
    confidence: { type: 'number' },
    dataBacked: { type: 'boolean' },
    data: { type: 'object' },
} as const;

export const DISCIPLINE_REQUIRED_FIELDS = [
    'code', 'sequence', 'title', 'summary', 'content',
    'actionItems', 'sources', 'confidence', 'dataBacked',
] as const;

export const EIGHT_D_SCHEMA = {
    type: 'object',
    properties: {
        internalSummary: {
            type: 'string',
            description:
                'Candid summary for the plant. Equipment, batch and people may be named.',
        },
        customerSummary: {
            type: 'string',
            nullable: true,
            description:
                'Outward-facing summary. Only for Q1 customer complaints; null for Q3 internal defects.',
        },
        disciplines: {
            type: 'array',
            minItems: 8,
            maxItems: 8,
            items: {
                type: 'object',
                properties: DISCIPLINE_ITEM_PROPERTIES,
                required: DISCIPLINE_REQUIRED_FIELDS,
            },
        },
    },
    required: ['internalSummary', 'customerSummary', 'disciplines'],
} as const;

export const SINGLE_DISCIPLINE_SCHEMA = {
    type: 'object',
    properties: DISCIPLINE_ITEM_PROPERTIES,
    required: DISCIPLINE_REQUIRED_FIELDS,
} as const;

/**
 * Schema cho một discipline khi sinh riêng từng bước.
 *
 * Truyền `dataSchema` (dựng từ Form Editor bằng `buildStepDataSchema`) thì
 * `data` vừa thành BẮT BUỘC vừa được mô tả đầy đủ — enum, minItems, kiểu của
 * từng phần tử mảng. Đây là khác biệt lớn nhất với model nhỏ: prompt chỉ khuyên,
 * còn response schema ràng buộc lúc sinh token.
 *
 * Bắt buộc `data` cũng cắt luôn một vòng gọi: `data` trống sẽ kéo theo một lượt
 * `analyzeDefectStructuredFields` để điền bù, nhân với tám bước là tám lượt phụ.
 *
 * Bỏ trống `dataSchema` thì quay về envelope phẳng như cũ.
 */
export function buildSingleDisciplineSchema(dataSchema?: Record<string, unknown>): Record<string, unknown> {
    if (!dataSchema) {
        return {
            type: 'object',
            properties: DISCIPLINE_ITEM_PROPERTIES,
            required: [...DISCIPLINE_REQUIRED_FIELDS],
        };
    }
    return {
        type: 'object',
        properties: { ...DISCIPLINE_ITEM_PROPERTIES, data: dataSchema },
        required: [...DISCIPLINE_REQUIRED_FIELDS, 'data'],
    };
}

export const SUMMARIES_SCHEMA = {
    type: 'object',
    properties: {
        internalSummary: {
            type: 'string',
            description:
                'Candid summary for the plant. Equipment, batch and people may be named.',
        },
        customerSummary: {
            type: 'string',
            nullable: true,
            description:
                'Outward-facing summary. Only for Q1 customer complaints; null for Q3 internal defects.',
        },
    },
    required: ['internalSummary', 'customerSummary'],
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Ngân sách token
// ─────────────────────────────────────────────────────────────────────────────

export const BUDGET = {
    parse: { maxTokens: 16_000, thinkingBudget: 256 },
    diagnose: { maxTokens: 32_000, thinkingBudget: 256 },
    analyze: { maxTokens: 100_000, thinkingBudget: 0 },
    stepAnalyze: { maxTokens: 64_000, thinkingBudget: 0 },
    summaries: { maxTokens: 16_000, thinkingBudget: 256 },
    structure: { maxTokens: 16_000, thinkingBudget: 0 },
    // Re-rank listwise: output chỉ là mảng {id, score, reason ngắn} cho ≤20 ứng
    // viên. 256 dưới ngưỡng 1024 của Anthropic nên thinking tắt và temperature 0
    // thật sự tới model — cùng lý do với `diagnose`.
    rerank: { maxTokens: 4_000, thinkingBudget: 256 },
} as const;
