/**
 * Điều phối pipeline 8D.
 *
 *   raw JSON
 *     → validateDataset   (code)  chặn sớm dữ liệu hỏng
 *     → mapCase           (code)  fact đã xác minh, 0% bịa
 *     → enrichContext     (AI)    số liệu suy ra + đánh giá mức độ + lỗ hổng dữ liệu
 *     → diagnoseIndep…    (AI)    ⭐ chẩn đoán MÙ — tự tìm root cause, không thấy đáp án
 *     → generateReport    (AI)    narrative D1-D8 + hai bản tóm tắt
 *     → postProcess       (code)  lưới an toàn cuối cùng
 *
 * Lỗi được ném lên tầng service, không nuốt ở đây — tầng trên cần biết để ghi
 * `errorMessage` và đặt status `Failed`. Một pipeline âm thầm trả về báo cáo
 * rỗng còn tệ hơn một pipeline báo lỗi.
 */

import cds from '@sap/cds';
import { complete, resolveModel } from '../../core/ai/llmClient';
import { ANALYZE_FALLBACK_MODEL } from '../../config/ai';
import { blockingIssues, qualityIssues, validateDataset } from './datasetValidator';
import { mapCase } from './caseMapper';
import {
    BUDGET,
    EIGHT_D_SCHEMA,
    ENRICHMENT_SCHEMA,
    SUMMARIES_SCHEMA,
    buildSingleDisciplineSchema,
    type ContextEnrichment,
} from './schemas';
import {
    ENRICHMENT_SYSTEM_PROMPT,
    buildEightDPrompt,
    buildEightDSystemPrompt,
    buildEnrichmentPrompt,
    buildSingleStepPrompt,
    buildSingleStepSystemPrompt,
    buildSummariesPrompt,
    type StepRanking,
} from './prompts';
import { getDisciplineGuide, getStepPromptRuntimeConfig } from './precedent/configRepository';
import {
    emptyPerStepPrecedents,
    type PerStepPrecedents,
} from './precedent/findPrecedents';
import { findPrecedents } from './graph/engine';
import { STEP_CODES } from './precedent/profileRepository';
import { planStepWaves } from './stepGraph';
import { callAndParse, isTruncated } from './jsonExtract';
import { postProcess } from './postProcess';
import {
    buildFlexibleResponseSchema,
    buildRuntimeSources,
    buildStepDataSchema,
    getPath,
    normalizeStepConfig,
    setPath,
    syncLegacyFields,
    validateFlexibleResult,
    type RuntimeStepConfig,
} from './runtimeConfig';
import { auditBlindEvidence, buildBlindEvidence } from './blindEvidence';
import {
    INDEPENDENT_SCHEMA,
    INDEPENDENT_SYSTEM_PROMPT,
    buildIndependentPrompt,
    compareWithRecorded,
    normalizeFinding,
    type IndependentAnalysis,
    type IndependentFinding,
} from './independentAnalysis';
import {
    DISCIPLINE_TITLES,
    PipelineError,
    type AnalyzeOutcome,
    type CaseContext,
    type DisciplineCode,
    type DisciplineDraft,
    type EightDResult,
} from './types';

export interface StepCompleteOutcome {
    discipline: DisciplineDraft;
    runtimeInfo?: {
        resultJson?: string;
        formSchemaJson?: string;
        validationJson?: string;
        configVersion?: string;
    };
    context: CaseContext;
    independent: IndependentAnalysis;
    precedents: PerStepPrecedents;
}

export type StepCompleteCallback = (outcome: StepCompleteOutcome) => Promise<void>;

const LOG = cds.log('eightd');

const ACTIVITY_PARSE = 'parseData';
const ACTIVITY_ANALYZE = 'analyzeDefect';
const ACTIVITY_STRUCTURE = 'analyzeDefectStructuredFields';
/** Chẩn đoán mù dùng activity riêng để admin chỉnh model/budget độc lập. */
const ACTIVITY_DIAGNOSE = 'reviewQuality';

/**
 * Kiểm "đủ ruột" cho output một bước — validate của `callAndParse`.
 *
 * Parse chỉ bắt được JSON hỏng; loại hỏng thật sự gặp với model nhỏ là JSON
 * HỢP LỆ nhưng khuyết — thiếu `rootCause.ishikawaBoard`, row 5-Why không có
 * `answer`. Schema đã khai các ràng buộc này, nhưng schema đi qua orchestration
 * không phải lúc nào cũng được thực thi tuyệt đối; đây là chốt kiểm phía mình.
 * Trả về mô tả chỗ thiếu ⇒ `callAndParse` gọi lại đúng một lần kèm chỉ dẫn đó.
 *
 * `data` trống hoàn toàn thì KHÔNG báo: đó là đường fallback envelope phẳng,
 * lượt `ACTIVITY_STRUCTURE` phía sau sẽ điền — retry ở đây chỉ phí một lời gọi.
 */
function missingRequiredData(config: RuntimeStepConfig | undefined, rawValue: any): string | undefined {
    const fields = config?.formSchema?.fields;
    if (!fields?.length) return undefined;
    const draft = rawValue?.disciplines?.[0] ?? rawValue;
    const data = draft?.data;
    if (!data || typeof data !== 'object' || !Object.keys(data).length) return undefined;

    const problems: string[] = [];
    for (const field of fields) {
        if (field.source && field.source !== 'ai_enrichment') continue;
        // Chịu cả hai kiểu khoá model hay trả: lồng theo path và khoá phẳng có dấu chấm.
        const value = getPath(data, field.key) ?? (data as Record<string, unknown>)[field.key];
        const empty = value === undefined || value === null || value === ''
            || (Array.isArray(value) && value.length === 0);
        if (field.constraints.required && empty) {
            problems.push(`data.${field.key} is missing or empty`);
            continue;
        }
        const itemRequired = field.items?.required;
        if (Array.isArray(value) && itemRequired?.length) {
            for (const [index, row] of value.entries()) {
                if (!row || typeof row !== 'object') continue;
                const absent = itemRequired.filter((key) => {
                    const item = (row as Record<string, unknown>)[key];
                    return item === undefined || item === null || item === '';
                });
                if (absent.length) problems.push(`data.${field.key}[${index + 1}] is missing ${absent.join(', ')}`);
            }
        }
    }
    return problems.length ? `${problems.slice(0, 8).join('; ')}.` : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bước AI 1 — làm giàu ngữ cảnh
// ─────────────────────────────────────────────────────────────────────────────

async function enrichContext(
    raw: unknown,
    context: CaseContext,
): Promise<{ enrichment: ContextEnrichment; tokens: number }> {
    let tokens = 0;

    const { value } = await callAndParse<ContextEnrichment>(ACTIVITY_PARSE, async (repairHint) => {
        const res = await complete(
            [
                { role: 'system', content: ENRICHMENT_SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: repairHint
                        ? `${buildEnrichmentPrompt(raw, context)}\n\n## CORRECTION\n${repairHint}`
                        : buildEnrichmentPrompt(raw, context),
                },
            ],
            {
                activity: ACTIVITY_PARSE,
                temperature: 0,
                max_tokens: BUDGET.parse.maxTokens,
                thinkingBudget: BUDGET.parse.thinkingBudget,
                responseMimeType: 'application/json',
                responseSchema: ENRICHMENT_SCHEMA as unknown as Record<string, unknown>,
            },
        );
        tokens += res.usage?.totalTokens ?? 0;
        return { content: res.content, finishReason: res.finishReason };
    });

    return { enrichment: value, tokens };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bước AI 2 — chẩn đoán mù
//
// Model chỉ thấy bằng chứng thô; chuỗi 5-Why, đáp án root cause, action khắc
// phục và FMEA đều bị cắt. Nó phải tự suy ra. Đây là bước duy nhất trong pipeline
// mà kết quả KHÔNG THỂ có được bằng cách chép lại input.
// ─────────────────────────────────────────────────────────────────────────────

async function diagnoseIndependently(
    context: CaseContext,
): Promise<{ analysis: IndependentAnalysis; tokens: number }> {
    let tokens = 0;

    const evidence = buildBlindEvidence(context);

    // Kiểm tra ngay tại runtime chứ không chỉ trong test: CaseContext sẽ còn
    // được thêm trường, và một trường mới vô tình mang theo kết luận sẽ âm thầm
    // biến bài kiểm tra độc lập thành trò hề.
    const leaks = auditBlindEvidence(evidence, context);
    if (leaks.length) LOG.warn(`Bằng chứng mù bị rò đáp án: ${leaks.join(' ')}`);

    const { value } = await callAndParse<IndependentFinding>(ACTIVITY_DIAGNOSE, async (repairHint) => {
        const res = await complete(
            [
                { role: 'system', content: INDEPENDENT_SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: repairHint
                        ? `${buildIndependentPrompt(evidence)}\n\n## CORRECTION\n${repairHint}`
                        : buildIndependentPrompt(evidence),
                },
            ],
            {
                activity: ACTIVITY_DIAGNOSE,
                // Đặt 0 để chẩn đoán tất định hết mức có thể. Với model Claude,
                // thinkingBudget 256 dưới ngưỡng 1024 của Anthropic nên llmClient
                // tự bỏ nó đi — nhờ vậy temperature 0 THẬT SỰ tới được model
                // thay vì bị CDK xoá (xem effectiveThinkingBudget trong
                // core/ai/llmClient.ts). Chỉ khi admin cấu hình budget >= 1024
                // thì thinking bật và temperature bị bỏ đúng luật Anthropic.
                temperature: 0,
                max_tokens: BUDGET.diagnose.maxTokens,
                thinkingBudget: BUDGET.diagnose.thinkingBudget,
                responseMimeType: 'application/json',
                responseSchema: INDEPENDENT_SCHEMA as unknown as Record<string, unknown>,
            },
        );
        tokens += res.usage?.totalTokens ?? 0;
        return { content: res.content, finishReason: res.finishReason };
    });

    const finding = normalizeFinding(value);
    const verdict = compareWithRecorded(finding, context);

    LOG.info(
        `Chẩn đoán độc lập: AI chọn ${verdict.aiCategory}, kỹ sư ghi ${verdict.recordedCategory} ` +
        `→ ${verdict.agrees ? 'TRÙNG' : 'LỆCH'} (confidence ${Math.round(finding.confidence * 100)}%)`,
    );

    return { analysis: { finding, verdict, leaks }, tokens };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bước AI 3 — sinh báo cáo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thứ hạng tiền lệ của từng bước D, tính trên danh sách hợp nhất đã đánh số.
 *
 * `PerStepPrecedents` giữ tám kết quả đầy đủ; prompt chỉ cần biết bước nào xếp
 * hạng mã case nào với điểm nào. Chuyển đổi ở đây để `prompts.ts` không phải biết
 * gì về profile.
 */
function toStepRankings(perStep: PerStepPrecedents): Record<string, StepRanking> {
    return Object.fromEntries(
        STEP_CODES.map((code) => {
            const result = perStep.byStep[code];
            return [code, {
                profileKey: result.profileKey,
                profileLabel: result.profileLabel,
                maxScore: result.maxScore,
                notificationIds: result.precedents.map((p) => p.notificationId),
                scores: Object.fromEntries(result.precedents.map((p) => [p.notificationId, p.score])),
            } satisfies StepRanking];
        }),
    );
}

async function generateReport(
    context: CaseContext,
    enrichment: ContextEnrichment,
    independent: IndependentAnalysis,
    perStep: PerStepPrecedents,
): Promise<{
    result: EightDResult;
    tokens: number;
    configs: Partial<Record<import('./types').DisciplineCode, RuntimeStepConfig>>;
    inputs: Partial<Record<import('./types').DisciplineCode, Record<string, unknown>>>;
    diagnostics: Partial<Record<import('./types').DisciplineCode, unknown[]>>;
    repairs: string[];
}> {
    let tokens = 0;

    // Hướng dẫn từng discipline admin chỉnh trên UI. Bảng rỗng ⇒ dùng hằng số
    // trong `prompts.ts`, tức là prompt y như cũ.
    const configurableCodes = ['D1', 'D2', 'D3', 'D4'] as const;
    const configs = Object.fromEntries(await Promise.all(configurableCodes.map(async (code) => [code, await getStepPromptRuntimeConfig(code)] as const)));
    const effectiveConfigs = Object.fromEntries(configurableCodes.flatMap((code) => {
        const config = configs[code];
        if (!config) return [];
        try {
            normalizeStepConfig(code, config);
            return [[code, config]];
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!message.startsWith('Data Schema and Form Editor fields must match.')) throw error;
            // A prior release persisted the new Form Editor beside the old Data Schema.
            // Trust the visible form contract until startup migration repairs the row.
            return [[code, { ...config, inputSchemaJson: '' }]];
        }
    })) as typeof configs;
    const normalizedConfigs = Object.fromEntries(configurableCodes.flatMap((code) => {
        const config = effectiveConfigs[code];
        return config ? [[code, normalizeStepConfig(code, config)]] : [];
    })) as Partial<Record<import('./types').DisciplineCode, RuntimeStepConfig>>;
    // Nguồn dữ liệu runtime tính THEO TỪNG BƯỚC: `precedents` và `precedentTeams`
    // của D1 là kết quả profile của D1, không phải danh sách hợp nhất. Dùng chung
    // một bộ cho cả tám bước sẽ vô hiệu hoá toàn bộ tính năng này ở đúng chỗ nó
    // được đọc — luật `dataBackedWhenInputPresent` của D1 nhìn vào `precedentTeams`.
    const stepSources = Object.fromEntries(
        STEP_CODES.map((code) => [
            code,
            buildRuntimeSources(context, enrichment, independent, perStep.byStep[code].precedents),
        ]),
    ) as Record<string, Record<string, unknown>>;
    // Bước cấu hình được nhưng không có trong `STEP_CODES` thì rơi về danh sách
    // hợp nhất — không bao giờ để một bước không có nguồn nào.
    const unionSources = buildRuntimeSources(context, enrichment, independent, perStep.union);
    const resolved = Object.fromEntries(Object.keys(normalizedConfigs).map((code) => [code, { input: stepSources[code] ?? unionSources, diagnostics: [] }]));
    const stepRankings = toStepRankings(perStep);
    const configuredConstraints = Object.fromEntries(configurableCodes.flatMap((code) => {
        const json = effectiveConfigs[code]?.constraintsJson; if (!json) return [];
        try { return (JSON.parse(json) as { enabled?: boolean }).enabled === false ? [] : [[code, json]]; } catch { return []; }
    }));
    const systemPrompt = buildEightDSystemPrompt(
        await getDisciplineGuide(),
        configuredConstraints,
    );
    const inputSchemas = Object.fromEntries(configurableCodes.flatMap((code) => effectiveConfigs[code]?.inputSchemaJson ? [[code, effectiveConfigs[code]!.inputSchemaJson]] : []));
    const formSchemas = Object.fromEntries(configurableCodes.flatMap((code) => effectiveConfigs[code]?.formSchemaJson ? [[code, effectiveConfigs[code]!.formSchemaJson]] : []));

    // Prompt dựng ở ba chỗ (lần đầu, lần sửa, lần sửa theo lỗi cấu hình) và cả ba
    // phải giống hệt nhau. Ba lời gọi rời nhau đã từng lệch tham số một lần.
    const renderPrompt = () => buildEightDPrompt(
        context, enrichment, independent, perStep.union, inputSchemas, formSchemas, stepRankings,
    );

    const responseSchema = buildFlexibleResponseSchema(normalizedConfigs);
    const { value } = await callAndParse<EightDResult>(ACTIVITY_ANALYZE, async (repairHint) => {
        const res = await complete(
            [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: repairHint
                        ? `${renderPrompt()}\n\n## CORRECTION\n${repairHint}`
                        : renderPrompt(),
                },
            ],
            {
                activity: ACTIVITY_ANALYZE,
                temperature: 0.2,
                max_tokens: BUDGET.analyze.maxTokens,
                thinkingBudget: BUDGET.analyze.thinkingBudget,
                responseMimeType: 'application/json',
                responseSchema,
            },
        );
        tokens += res.usage?.totalTokens ?? 0;
        return { content: res.content, finishReason: res.finishReason };
    });

    const configuredFieldContracts = Object.entries(normalizedConfigs).flatMap(([code, config]) =>
        config?.formSchema?.fields.map((field) => ({ code, path: field.key, type: field.type, label: field.label, required: Boolean(field.constraints.required), items: field.items, properties: field.properties })) ?? [],
    );
    if (configuredFieldContracts.length) {
        const structuredSchema = {
            type: 'object',
            properties: {
                fields: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            code: { type: 'string', enum: configurableCodes },
                            path: { type: 'string' },
                            valueJson: { type: 'string' },
                        },
                        required: ['code', 'path', 'valueJson'],
                    },
                },
            },
            required: ['fields'],
        };
        const structured = await callAndParse<{ fields: Array<{ code: string; path: string; valueJson: string }> }>(ACTIVITY_STRUCTURE, async (repairHint) => {
            const res = await complete([
                {
                    role: 'system',
                    content: 'Convert a grounded 8D narrative into configured form fields. Return one entry for every contract field. valueJson must be a JSON-encoded value of the requested type. Use only the supplied verified context and narrative. When evidence is incomplete, write an explicit recommendation or gap; never invent a person, measurement, date, identifier, or completed action.',
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        contracts: configuredFieldContracts,
                        // Bước điền form gửi hợp đồng của CẢ D1–D4 trong một lời
                        // gọi, nên nó phải thấy danh sách hợp nhất: giới hạn ở
                        // tiền lệ của một bước sẽ làm ba bước còn lại mất nguồn.
                        verifiedContext: unionSources,
                        report: value.disciplines.filter((discipline) => configurableCodes.includes(discipline.code as typeof configurableCodes[number])),
                        correction: repairHint || undefined,
                    }),
                },
            ], {
                // PHẢI là ACTIVITY_STRUCTURE, không phải ACTIVITY_ANALYZE. Khai
                // nhầm ở đây thì bước điền form âm thầm chạy model của bước viết
                // báo cáo, và mọi cấu hình model riêng cho nó không bao giờ có
                // hiệu lực — đúng lỗi cũ, đo được ~90s cho một thao tác ánh xạ.
                activity: ACTIVITY_STRUCTURE,
                temperature: 0,
                max_tokens: BUDGET.structure.maxTokens,
                thinkingBudget: BUDGET.structure.thinkingBudget,
                responseMimeType: 'application/json',
                responseSchema: structuredSchema,
            });
            tokens += res.usage?.totalTokens ?? 0;
            return { content: res.content, finishReason: res.finishReason };
        });
        const allowedPaths = new Map(configuredFieldContracts.map((field) => [`${field.code}:${field.path}`, field]));
        for (const field of structured.value.fields ?? []) {
            if (!allowedPaths.has(`${field.code}:${field.path}`)) continue;
            const discipline = value.disciplines.find((item) => item.code === field.code);
            if (!discipline) continue;
            try {
                setPath(discipline.data ??= {}, field.path, JSON.parse(field.valueJson));
            } catch {
                LOG.warn(`Structured AI field ${field.code}.${field.path} returned invalid valueJson.`);
            }
        }
    }

    for (const discipline of value.disciplines ?? []) syncLegacyFields(discipline);
    const errors = (value.disciplines ?? []).flatMap((discipline) => {
        const config = normalizedConfigs[discipline.code];
        return config
            ? validateFlexibleResult(discipline, config, resolved[discipline.code]?.input ?? {})
                .filter((item) => item.severity === 'error')
                .map((item) => ({ code: discipline.code, ...item }))
            : [];
    });
    if (errors.length) {
        // KHÔNG gọi lại model để "sửa" các lỗi này — lượt gọi đó không sửa được gì.
        //
        // Mọi vi phạm ở đây đều đọc từ `discipline.data` (xem `validateFlexibleResult`).
        // Bản cũ chụp lại `data` đang lỗi, gọi model 32K token bảo nó "return the
        // complete corrected report", rồi ngay sau đó GHI ĐÈ `data` bằng đúng bản
        // đã chụp — nên vi phạm còn nguyên theo đúng cấu trúc code, chỉ phần lời
        // văn là bị viết lại. Bắt buộc phải ghi đè như vậy vì schema của lượt sửa
        // để `data` mở (né giới hạn serving-state của Gemini), nên kết quả trả về
        // có thể rỗng và sẽ xoá mất output đã cấu trúc hoá ở bước trước.
        //
        // Đo thực tế: lượt gọi này tốn ~85s trong tổng 317s — 27% thời gian cho
        // một thao tác vô hiệu. `postProcess` phía sau mới là chỗ thật sự chữa
        // được, và phần còn lại đi thẳng vào `validationJson` cho UI hiển thị.
        LOG.warn(`Cấu hình còn ${errors.length} vi phạm — chuyển cho postProcess và báo lên UI: ${errors.map((e) => `${e.code}.${e.path}`).join(', ')}`);
    }
    return {
        result: value,
        tokens,
        configs: normalizedConfigs,
        inputs: Object.fromEntries(Object.entries(resolved).map(([code, item]) => [code, item.input])),
        diagnostics: Object.fromEntries(Object.entries(resolved).map(([code, item]) => [code, item.diagnostics])),
        repairs: [],
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Progressive Step Generator — sinh & emit từng step D1..D8
// ─────────────────────────────────────────────────────────────────────────────

async function generateReportProgressive(
    context: CaseContext,
    enrichment: ContextEnrichment,
    independent: IndependentAnalysis,
    perStep: PerStepPrecedents,
    onStepComplete?: StepCompleteCallback,
    initialCompleted?: Map<string, DisciplineDraft>,
    targetStepCodes: readonly DisciplineCode[] = STEP_CODES,
): Promise<{
    result: EightDResult;
    tokens: number;
    configs: Partial<Record<import('./types').DisciplineCode, RuntimeStepConfig>>;
    inputs: Partial<Record<import('./types').DisciplineCode, Record<string, unknown>>>;
    diagnostics: Partial<Record<import('./types').DisciplineCode, unknown[]>>;
    repairs: string[];
}> {
    let tokens = 0;
    const repairs: string[] = [];

    // Cả tám bước, không phải D1–D4.
    const configurableCodes = STEP_CODES;
    const configs = Object.fromEntries(await Promise.all(configurableCodes.map(async (code) => [code, await getStepPromptRuntimeConfig(code)] as const)));
    const effectiveConfigs = Object.fromEntries(configurableCodes.flatMap((code) => {
        const config = configs[code];
        if (!config) return [];
        try {
            normalizeStepConfig(code, config);
            return [[code, config]];
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!message.startsWith('Data Schema and Form Editor fields must match.')) throw error;
            return [[code, { ...config, inputSchemaJson: '' }]];
        }
    })) as typeof configs;

    const normalizedConfigs = Object.fromEntries(configurableCodes.flatMap((code) => {
        const config = effectiveConfigs[code];
        return config ? [[code, normalizeStepConfig(code, config)]] : [];
    })) as Partial<Record<import('./types').DisciplineCode, RuntimeStepConfig>>;

    const stepSources = Object.fromEntries(
        STEP_CODES.map((code) => [
            code,
            buildRuntimeSources(context, enrichment, independent, perStep.byStep[code].precedents),
        ]),
    ) as Record<string, Record<string, unknown>>;
    const unionSources = buildRuntimeSources(context, enrichment, independent, perStep.union);
    const resolved = Object.fromEntries(Object.keys(normalizedConfigs).map((code) => [code, { input: stepSources[code] ?? unionSources, diagnostics: [] }]));
    const stepRankings = toStepRankings(perStep);

    const disciplineGuides = await getDisciplineGuide();
    /** Bước đã sinh xong, tra theo mã — thứ tự D1..D8 dựng lại ở cuối. */
    const completed = new Map<string, DisciplineDraft>(initialCompleted ? initialCompleted.entries() : []);

    /**
     * Xếp hàng các lượt ghi DB.
     *
     * `onStepComplete` ghi trên transaction dùng chung của job nền, mà một
     * transaction chỉ giữ một connection. Các bước trong cùng một đợt chạy song
     * song, nên gọi thẳng là hai lệnh ghi chồng lên nhau trên đúng connection
     * đó — đúng loại lỗi mà phần đầu `eightDRepository.ts` cảnh báo.
     *
     * Xếp hàng lại thì phần đắt (gọi model) vẫn song song, chỉ vài chục
     * mili-giây ghi là tuần tự. Đây cũng là thứ khiến cờ `savedContext` bên
     * `eightDService` an toàn: không có hai callback nào chạy chồng nhau.
     */
    let writeQueue: Promise<unknown> = Promise.resolve();
    const emitStep = (outcome: StepCompleteOutcome): Promise<void> => {
        const write = writeQueue.then(() => onStepComplete?.(outcome));
        // Nuốt lỗi ở BẢN SAO dùng để nối hàng đợi, không phải ở `write`: bước
        // gọi vẫn nhận lỗi và làm hỏng cả lượt phân tích như mong muốn, nhưng
        // hàng đợi không chết theo.
        writeQueue = write.catch(() => undefined);
        return write.then(() => undefined);
    };

    /**
     * Sinh đúng một bước.
     *
     * `precedingDisciplines` được chụp tại thời điểm bắt đầu đợt chứ không đọc
     * `completed` trực tiếp: các bước trong cùng một đợt chạy song song, đọc
     * trực tiếp sẽ khiến prompt phụ thuộc vào bước nào về đích trước — cùng một
     * input có thể ra hai báo cáo khác nhau.
     */
    const runStep = async (
        code: (typeof STEP_CODES)[number],
        precedingDisciplines: DisciplineDraft[],
    ): Promise<DisciplineDraft> => {
        const stepGuide = disciplineGuides[code];
        const stepConstraintJson = effectiveConfigs[code as keyof typeof effectiveConfigs]?.constraintsJson;
        let stepConstraintText = '';
        if (stepConstraintJson) {
            try {
                if ((JSON.parse(stepConstraintJson) as { enabled?: boolean }).enabled !== false) {
                    stepConstraintText = stepConstraintJson;
                }
            } catch { }
        }

        const systemPrompt = buildSingleStepSystemPrompt(code, stepGuide, stepConstraintText);
        const inputSchemaJson = effectiveConfigs[code as keyof typeof effectiveConfigs]?.inputSchemaJson;
        const formSchemaJson = effectiveConfigs[code as keyof typeof effectiveConfigs]?.formSchemaJson;

        const renderPrompt = () => buildSingleStepPrompt(
            code,
            context,
            enrichment,
            independent,
            perStep.union,
            stepRankings[code],
            precedingDisciplines,
            inputSchemaJson,
            formSchemaJson,
        );

        const stepConfig = normalizedConfigs[code as keyof typeof normalizedConfigs];
        // Ràng buộc `data` theo đúng Form Editor: enum, minItems, kiểu phần tử
        // mảng. Model nhỏ đọc prompt rồi vẫn trả sai enum; schema thì không cãi
        // được. Cũng nhờ vậy lượt `ACTIVITY_STRUCTURE` bên dưới hầu như không
        // phải chạy.
        const dataSchema = buildStepDataSchema(stepConfig);

        // Đường lui: nếu AI Core từ chối schema lồng nhau thì gọi lại bằng
        // envelope phẳng thay vì để cả báo cáo chết. Chỉ thử lại đúng một lần và
        // chỉ khi lượt đầu dùng schema chặt — lỗi thật vẫn nổi lên bình thường.
        let strictSchemaRejected = false;

        // Nhãn kèm mã bước: `analyzeDefect` là tên activity dùng chung cho cả tám
        // bước lẫn lượt viết tóm tắt, nên lỗi chỉ ghi activity thì không biết
        // bước nào hỏng.
        const stepCall = (modelOverride?: string) => async (repairHint?: string) => {
            const callWith = async (
                schema: Record<string, unknown> | undefined,
                temperature = 0.2,
                extraHint?: string,
            ) => complete(
                [
                    { role: 'system', content: systemPrompt },
                    {
                        role: 'user',
                        content: [
                            renderPrompt(),
                            repairHint ? `\n\n## CORRECTION\n${repairHint}` : '',
                            extraHint ? `\n\n## CORRECTION\n${extraHint}` : '',
                        ].join(''),
                    },
                ],
                {
                    activity: ACTIVITY_ANALYZE,
                    // Lượt leo thang ép model mạnh hơn cho ĐÚNG lời gọi này;
                    // resolveModel theo activity vẫn quyết mọi lượt bình thường.
                    ...(modelOverride ? { model: modelOverride } : {}),
                    temperature,
                    max_tokens: BUDGET.stepAnalyze.maxTokens,
                    thinkingBudget: BUDGET.stepAnalyze.thinkingBudget,
                    responseMimeType: 'application/json',
                    responseSchema: buildSingleDisciplineSchema(schema),
                },
            );

            const useStrict = Boolean(dataSchema) && !strictSchemaRejected;
            let res;
            try {
                res = await callWith(useStrict ? dataSchema : undefined);
            } catch (error: any) {
                if (!useStrict) throw error;
                strictSchemaRejected = true;
                LOG.warn(
                    `${code}: AI Core từ chối schema dựng từ Form Editor, gọi lại bằng envelope phẳng. ` +
                    `Các ràng buộc enum/minItems của bước này sẽ chỉ còn được kiểm ở backend. ` +
                    `Nguyên nhân: ${error?.message ?? error}`,
                );
                res = await callWith(undefined);
            }

            // ── Thoát vòng lặp thoái hoá ──
            // Gemini 2.5 (nhất là flash) khi bị ép schema ở temperature thấp có
            // thể rơi vào vòng lặp: sinh đi sinh lại cùng một cụm cho tới khi
            // dùng SẠCH max_tokens (`finishReason=length`, produced == trần).
            // Google khuyến nghị chạy dòng 2.5 ở temperature mặc định 1.0 —
            // phân phối hẹp của 0.2 khiến model kẹt trong vòng lặp không thoát
            // nổi. Claude/Haiku không dính vì không dùng constrained decoding
            // serving-side kiểu đó — khớp đúng quan sát "Haiku trở lên thì
            // không sao, riêng flash là bị".
            //
            // Gọi lại NGUYÊN VẸN một lần với temperature 1.0: lấy mẫu khác đi
            // thường đủ để thoát. Vẫn cắt thì `assertNotTruncated` ném lỗi như
            // thường — không giấu vấn đề bằng retry vô hạn.
            if (isTruncated(res.finishReason)) {
                tokens += res.usage?.totalTokens ?? 0;
                LOG.warn(
                    `${code}: model dùng sạch ${BUDGET.stepAnalyze.maxTokens} token ở temperature 0.2 ` +
                    `(dấu hiệu vòng lặp thoái hoá của Gemini khi ép schema). ` +
                    `Gọi lại một lần ở temperature 0.7 kèm chỉ dẫn chống lặp.`,
                );
                // 0.7 chứ không phải 1.0: phá vòng lặp chỉ cần phân phối rộng
                // hơn hẳn 0.2, không cần ngẫu nhiên tối đa. 1.0 cũng thoát được
                // nhưng đổi lấy văn phong lan man — tức chữa lỗi này bằng cách
                // tạo ra lỗi khác.
                //
                // Chỉ dẫn kèm theo mới là phần nhắm đúng bệnh: nói thẳng rằng
                // lần trước đã lặp và bị cắt. Nhiệt độ chỉ mở đường thoát; câu
                // này mới cho model biết phải thoát đi đâu.
                res = await callWith(
                    useStrict && !strictSchemaRejected ? dataSchema : undefined,
                    0.7,
                    'Your previous attempt repeated the same phrases until it ran out of budget and was cut off. '
                    + 'Write each field ONCE, briefly. Do not restate anything you have already written. '
                    + 'A short complete answer is required; a long one will be rejected.',
                );
            }

            tokens += res.usage?.totalTokens ?? 0;
            return {
                content: res.content,
                finishReason: res.finishReason,
                limits: {
                    maxTokens: BUDGET.stepAnalyze.maxTokens,
                    thinkingBudget: BUDGET.stepAnalyze.thinkingBudget,
                    model: (res as any).model,
                    produced: (res.usage as any)?.completionTokens ?? res.usage?.totalTokens,
                },
            };
        };

        let parsedStep = await callAndParse<any>(
            `${code}/${ACTIVITY_ANALYZE}`,
            stepCall(),
            (value) => missingRequiredData(stepConfig, value),
        );

        // ── Thang leo model ──
        // Haiku + retry-có-chỉ-dẫn vẫn khuyết trường bắt buộc thì gọi đúng MỘT
        // lượt trên model mạnh hơn và lấy bản đủ hơn. Đường vui (đa số lượt chạy)
        // không tốn gì; đường hỏng đổi vài giây lấy một bước trọn vẹn. Leo thang
        // chết vì bất cứ lý do gì thì giữ kết quả sẵn có — cơ chế cứu không được
        // phép trở thành lý do hỏng.
        const unresolved = missingRequiredData(stepConfig, parsedStep.value);
        if (unresolved && ANALYZE_FALLBACK_MODEL) {
            const currentModel = await resolveModel(ACTIVITY_ANALYZE);
            if (currentModel !== ANALYZE_FALLBACK_MODEL) {
                LOG.warn(
                    `${code}: sau retry vẫn thiếu trường bắt buộc (${unresolved}) — `
                    + `leo thang một lượt lên ${ANALYZE_FALLBACK_MODEL}.`,
                );
                try {
                    const escalated = await callAndParse<any>(
                        `${code}/${ACTIVITY_ANALYZE}@fallback`,
                        stepCall(ANALYZE_FALLBACK_MODEL),
                    );
                    const escalatedIssue = missingRequiredData(stepConfig, escalated.value);
                    if (!escalatedIssue || escalatedIssue.length < unresolved.length) parsedStep = escalated;
                } catch (error: any) {
                    LOG.warn(`${code}: leo thang thất bại (${error?.message ?? error}); giữ kết quả sẵn có.`);
                }
            }
        }
        const rawStepValue = parsedStep.value;

        let discipline: DisciplineDraft = rawStepValue.disciplines ? rawStepValue.disciplines[0] : rawStepValue;
        if (!discipline || discipline.code !== code) {
            discipline = {
                code,
                sequence: STEP_CODES.indexOf(code) + 1,
                title: DISCIPLINE_TITLES[code],
                summary: rawStepValue.summary ?? 'Generated discipline.',
                content: rawStepValue.content ?? '',
                actionItems: Array.isArray(rawStepValue.actionItems) ? rawStepValue.actionItems : [],
                sources: Array.isArray(rawStepValue.sources) ? rawStepValue.sources : [],
                confidence: typeof rawStepValue.confidence === 'number' ? rawStepValue.confidence : 0.8,
                dataBacked: typeof rawStepValue.dataBacked === 'boolean' ? rawStepValue.dataBacked : true,
                data: rawStepValue.data ?? {},
            };
        }

        // Form field contract extraction if configured & not already populated by step prompt
        const stepFormSchema = effectiveConfigs[code as keyof typeof effectiveConfigs]?.formSchemaJson;
        const hasPopulatedData = discipline.data && typeof discipline.data === 'object' && Object.keys(discipline.data).length > 0;
        if (stepFormSchema && !hasPopulatedData) {
            try {
                const schema = JSON.parse(stepFormSchema);
                const configuredFields = (schema.fields ?? []).map((f: any) => ({
                    code,
                    path: f.binding?.trim() || f.key,
                    type: f.dataType,
                    label: f.label,
                    required: Boolean(f.constraints?.required),
                    items: f.items,
                    properties: f.properties,
                })).filter((f: any) => f.path);

                if (configuredFields.length) {
                    const structuredSchema = {
                        type: 'object',
                        properties: {
                            fields: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        code: { type: 'string', enum: [code] },
                                        path: { type: 'string' },
                                        valueJson: { type: 'string' },
                                    },
                                    required: ['code', 'path', 'valueJson'],
                                },
                            },
                        },
                        required: ['fields'],
                    };

                    const structured = await callAndParse<{ fields: Array<{ code: string; path: string; valueJson: string }> }>(ACTIVITY_STRUCTURE, async (repairHint) => {
                        const res = await complete([
                            {
                                role: 'system',
                                content: 'Convert a grounded 8D narrative into configured form fields. Return one entry for every contract field. valueJson must be a JSON-encoded value of the requested type. Use only the supplied verified context and narrative. When evidence is incomplete, write an explicit recommendation or gap; never invent a person, measurement, date, identifier, or completed action.',
                            },
                            {
                                role: 'user',
                                content: JSON.stringify({
                                    contracts: configuredFields,
                                    verifiedContext: stepSources[code] ?? unionSources,
                                    report: [discipline],
                                    correction: repairHint || undefined,
                                }),
                            },
                        ], {
                            activity: ACTIVITY_STRUCTURE,
                            temperature: 0,
                            max_tokens: BUDGET.structure.maxTokens,
                            thinkingBudget: BUDGET.structure.thinkingBudget,
                            responseMimeType: 'application/json',
                            responseSchema: structuredSchema,
                        });
                        tokens += res.usage?.totalTokens ?? 0;
                        return { content: res.content, finishReason: res.finishReason };
                    });

                    const allowedPaths = new Map(configuredFields.map((f: any) => [f.path, f]));
                    for (const field of structured.value.fields ?? []) {
                        if (!allowedPaths.has(field.path)) continue;
                        try {
                            setPath(discipline.data ??= {}, field.path, JSON.parse(field.valueJson));
                        } catch {
                            LOG.warn(`Structured AI field ${code}.${field.path} returned invalid valueJson.`);
                        }
                    }
                }
            } catch { }
        }

        syncLegacyFields(discipline);

        // Run postProcess for this discipline
        const singlePost = postProcess(
            { internalSummary: '', customerSummary: null, disciplines: [discipline] },
            context,
            enrichment,
            independent,
            perStep.union,
            stepConstraintText ? { [code]: stepConstraintText } : {},
            // Giới hạn đúng bước này. Thiếu tham số đây là `postProcess` trả về
            // cả tám ô và `[0]` luôn là D1 — mọi bước D2..D8 sẽ ghi đè lên D1
            // bằng placeholder, và báo cáo cuối cùng chỉ còn một dòng.
            [code],
            precedingDisciplines,
        );
        discipline = singlePost.result.disciplines.find((d) => d.code === code) ?? discipline;
        if (singlePost.repairs.length) repairs.push(...singlePost.repairs);

        let stepRuntimeInfo;
        if (stepConfig?.formSchema) {
            const violations = validateFlexibleResult(discipline, stepConfig, resolved[code]?.input ?? {});
            stepRuntimeInfo = {
                resultJson: JSON.stringify(discipline.data ?? {}),
                formSchemaJson: JSON.stringify(stepConfig.formSchema),
                validationJson: JSON.stringify({ version: 1, violations, inputDiagnostics: resolved[code]?.diagnostics ?? [], repairs: singlePost.repairs }),
                configVersion: stepConfig.configVersion,
            };
        }

        // Bất biến rẻ tiền, giá trị cao: `savePartialDiscipline` ghi theo
        // `discipline.code`, nên một bước trả về sai mã sẽ lặng lẽ ghi đè lên
        // bước khác — báo cáo mất dòng mà không có lỗi nào. Đúng lỗi đã xảy ra.
        if (discipline.code !== code) {
            throw new PipelineError(
                `Bước ${code} dựng ra discipline mang mã ${discipline.code}.`,
                502,
            );
        }

        completed.set(code, discipline);

        // Ghi xuống DB ngay khi bước xong — đây là toàn bộ mục đích của chế độ
        // progressive: người dùng mở được D1 trong lúc D5 còn đang chạy.
        await emitStep({
            discipline,
            runtimeInfo: stepRuntimeInfo,
            context,
            independent,
            precedents: perStep,
        });

        return discipline;
    };

    // Chạy theo đợt: bước trong cùng đợt không phụ thuộc nhau nên gọi song song.
    // Đây là chỗ đổi 8 lượt gọi nối đuôi thành 5 đợt — xem `stepGraph.ts`.
    const orderedCompleted = (): DisciplineDraft[] =>
        STEP_CODES.flatMap((code) => {
            const discipline = completed.get(code);
            return discipline ? [discipline] : [];
        });

    const waves = planStepWaves(targetStepCodes);
    for (const [index, wave] of waves.entries()) {
        const preceding = orderedCompleted();
        const startedAt = Date.now();
        const settled = await Promise.allSettled(wave.map((code) => runStep(code, preceding)));
        LOG.info(
            `Đợt ${index + 1}/${waves.length} [${wave.join(', ')}] xong sau ` +
            `${Math.round((Date.now() - startedAt) / 1000)}s`,
        );

        // Một bước hỏng không được kéo theo bảy bước kia: bảy bước còn lại đã
        // nằm trong DB và dùng được. Nhưng cũng không im lặng nuốt lỗi — tầng
        // service cần biết để đặt status `Failed` kèm nguyên nhân thật.
        const failure = settled.find((outcome) => outcome.status === 'rejected');
        if (failure) throw (failure as PromiseRejectedResult).reason;
    }

    const previousDisciplines = orderedCompleted();

    // Generate plant & customer summaries
    const summariesPrompt = buildSummariesPrompt(context, enrichment, previousDisciplines);
    const { value: summaries } = await callAndParse<{ internalSummary: string; customerSummary: string | null }>(`summaries/${ACTIVITY_ANALYZE}`, async (repairHint) => {
        const res = await complete(
            [
                { role: 'system', content: 'You write the internal plant summary and outward customer summary for an 8D report.' },
                {
                    role: 'user',
                    content: repairHint ? `${summariesPrompt}\n\n## CORRECTION\n${repairHint}` : summariesPrompt,
                },
            ],
            {
                activity: ACTIVITY_ANALYZE,
                temperature: 0.2,
                max_tokens: BUDGET.summaries.maxTokens,
                thinkingBudget: BUDGET.summaries.thinkingBudget,
                responseMimeType: 'application/json',
                responseSchema: SUMMARIES_SCHEMA,
            },
        );
        tokens += res.usage?.totalTokens ?? 0;
        return { content: res.content, finishReason: res.finishReason };
    });

    const result: EightDResult = {
        internalSummary: summaries.internalSummary ?? '',
        customerSummary: context.isCustomerFacing ? summaries.customerSummary : null,
        disciplines: previousDisciplines,
    };

    return {
        result,
        tokens,
        configs: normalizedConfigs,
        inputs: Object.fromEntries(Object.entries(resolved).map(([c, item]) => [c, item.input])),
        diagnostics: Object.fromEntries(Object.entries(resolved).map(([c, item]) => [c, item.diagnostics])),
        repairs,
    };
}

async function enrichFromDatabase(context: CaseContext): Promise<void> {
    try {
        if (!cds.db) return;

        // 1. Fallback truy vấn lịch sử kiểm tra lô (InspectionLots) cho Is / Is-Not
        if (!context.historicalInspectionLots || context.historicalInspectionLots.length === 0) {
            const materialId = context.product.materialId?.trim();
            if (materialId) {
                const rows = await cds.run(
                    SELECT.from('cnma.proresolve.InspectionLots')
                        .where`lower(materialId) = ${materialId.toLowerCase()}`
                        .orderBy('lotDate desc'),
                ).catch((err: any) => {
                    LOG.warn(`[InspectionLots query] Không thể truy vấn bảng: ${err.message}`);
                    return [];
                });

                if (Array.isArray(rows) && rows.length > 0) {
                    context.historicalInspectionLots = rows.map((r: any) => ({
                        lotId: String(r.lotId ?? ''),
                        materialId: String(r.materialId ?? ''),
                        characteristic: String(r.characteristic ?? ''),
                        equipment: r.equipment ? String(r.equipment) : null,
                        measuredValue: r.measuredValue ? String(r.measuredValue) : null,
                        conforming: Boolean(r.conforming),
                        lotDate: r.lotDate ? String(r.lotDate) : null,
                        plant: r.plant ? String(r.plant) : null,
                    }));
                    LOG.info(`[InspectionLots] Đã tải ${rows.length} lô kiểm tra lịch sử cho vật tư ${materialId}.`);
                }
            }
        }

        // 2. Fallback truy vấn sổ đăng ký FMEA (FmeaRegister) cho D7
        if (!context.fmea && (context.product.workCenterId || context.product.materialId)) {
            const query = SELECT.one.from('cnma.proresolve.FmeaRegister');
            const wcId = context.product.workCenterId?.trim();
            const matId = context.product.materialId?.trim();
            if (wcId && matId) {
                query.where`workCenterId = ${wcId} or materialId = ${matId}`;
            } else if (wcId) {
                query.where`workCenterId = ${wcId}`;
            } else if (matId) {
                query.where`materialId = ${matId}`;
            }
            const row = await cds.run(query).catch((err: any) => {
                LOG.warn(`[FmeaRegister query] Không thể truy vấn bảng: ${err.message}`);
                return null;
            });
            if (row) {
                context.fmea = {
                    fmeaId: String(row.fmeaId ?? ''),
                    description: String(row.description ?? ''),
                    workCenterId: row.workCenterId ? String(row.workCenterId) : null,
                    materialId: row.materialId ? String(row.materialId) : null,
                };
                LOG.info(`[FmeaRegister] Đã gán FMEA ${context.fmea.fmeaId} cho phân xưởng ${context.product.workCenterId}.`);
            }
        }
    } catch (e: any) {
        LOG.warn(`[enrichFromDatabase] Bổ trợ dữ liệu từ DB thất bại: ${e.message}`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chạy trọn pipeline trên một payload Golden Dataset.
 *
 * @throws {PipelineError} 400 khi payload hỏng, 502 khi model trả về thứ không dùng được
 */
export async function analyze(
    rawJson: string,
    onStepComplete?: StepCompleteCallback,
): Promise<AnalyzeOutcome> {
    const started = Date.now();

    let raw: unknown;
    try {
        raw = JSON.parse(rawJson);
    } catch (e: any) {
        throw new PipelineError(`Payload không phải JSON hợp lệ: ${e.message}`, 400);
    }

    // ── Chặn sớm ──
    const issues = validateDataset(raw);
    const blocking = blockingIssues(issues);
    if (blocking.length) {
        throw new PipelineError(
            `Dataset vi phạm ${blocking.length} ràng buộc toàn vẹn.`,
            400,
            blocking.map((i) => `[${i.constraintId}] ${i.message}`),
        );
    }
    const warnings = qualityIssues(issues);
    if (warnings.length) {
        LOG.info(`Dataset có ${warnings.length} vấn đề chất lượng — chuyển cho model làm ngữ cảnh.`);
    }

    // ── Facts ──
    const context = mapCase(raw);
    for (const w of warnings) context.gaps.push(`${w.constraintId}: ${w.message}`);

    // Bổ trợ dữ liệu từ CDS database (lịch sử kiểm tra lô InspectionLots cho D2 & FmeaRegister cho D7)
    await enrichFromDatabase(context);

    LOG.info(
        `Case ${context.notificationId} (${context.origin}) — ` +
        `${context.fiveWhy.length} bước 5-Why, ${context.gaps.length} lỗ hổng dữ liệu`,
    );

    // ── AI ──
    const phase = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
        const t = Date.now();
        try { return await fn(); } finally { LOG.info(`[phase] ${name}: ${Date.now() - t}ms`); }
    };

    const [
        { enrichment, tokens: parseTokens },
        { analysis: independent, tokens: diagnoseTokens },
        perStep,
    ] = await Promise.all([
        phase('parse', () => enrichContext(raw, context)),
        phase('diagnose', () => diagnoseIndependently(context)),
        phase('precedents', () => findPrecedents(context, raw)).catch((e: any) => {
            LOG.warn(`Tìm tiền lệ thất bại, viết báo cáo không có tiền lệ: ${e.message}`);
            return emptyPerStepPrecedents();
        }),
    ]);
    const precedents = perStep.union;

    const {
        result,
        tokens: analyzeTokens,
        configs: runtimeConfigs,
        inputs: runtimeInputs,
        diagnostics: inputDiagnostics,
        repairs,
    } = onStepComplete
        ? await phase('analyze', () => generateReportProgressive(context, enrichment, independent, perStep, onStepComplete))
        : await phase('analyze', () => generateReport(context, enrichment, independent, perStep));

    const [parseModel, analyzeModel] = await Promise.all([
        resolveModel(ACTIVITY_PARSE),
        resolveModel(ACTIVITY_ANALYZE),
    ]);

    const runtime = Object.fromEntries(result.disciplines.flatMap((discipline) => {
        const config = runtimeConfigs[discipline.code];
        if (!config?.formSchema) return [];
        const violations = validateFlexibleResult(discipline, config, runtimeInputs[discipline.code] ?? {});
        return [[discipline.code, {
            resultJson: JSON.stringify(discipline.data ?? {}),
            formSchemaJson: JSON.stringify(config.formSchema),
            validationJson: JSON.stringify({ version: 1, violations, inputDiagnostics: inputDiagnostics[discipline.code] ?? [], repairs }),
            configVersion: config.configVersion,
        }]];
    }));

    return {
        context,
        result,
        independent,
        models: { parse: parseModel, analyze: analyzeModel },
        precedents: perStep,
        tokensUsed: parseTokens + diagnoseTokens + analyzeTokens,
        durationMs: Date.now() - started,
        repairs,
        runtime,
    };
}

/**
 * Phân tích lại các bước downstream (D5..D8) dựa trên các bước trước đó (D1..D4) đã có và đã sửa.
 */
export async function analyzeDownstreamReport(
    raw: unknown,
    existingDisciplines: Array<{ code: string; title?: string; summary?: string; content?: string; actionItems?: string; sources?: string; confidence?: number; dataBacked?: boolean; resultJson?: string }>,
    fromStep: DisciplineCode = 'D5',
    onStepComplete?: StepCompleteCallback,
): Promise<AnalyzeOutcome> {
    const started = Date.now();
    const fromIndex = STEP_CODES.indexOf(fromStep);
    const downstreamCodes: readonly DisciplineCode[] = fromIndex >= 0 ? STEP_CODES.slice(fromIndex) : (['D5', 'D6', 'D7', 'D8'] as const);
    const priorCodes: readonly DisciplineCode[] = fromIndex >= 0 ? STEP_CODES.slice(0, fromIndex) : (['D1', 'D2', 'D3', 'D4'] as const);

    const initialCompleted = new Map<string, DisciplineDraft>();
    for (const row of existingDisciplines) {
        if ((priorCodes as readonly string[]).includes(row.code)) {
            const code = row.code as DisciplineCode;
            let data = {};
            try { data = JSON.parse(row.resultJson || '{}'); } catch { }
            initialCompleted.set(code, {
                code,
                sequence: STEP_CODES.indexOf(code) + 1,
                title: row.title ?? DISCIPLINE_TITLES[code] ?? '',
                summary: row.summary ?? '',
                content: row.content ?? '',
                actionItems: typeof row.actionItems === 'string' ? JSON.parse(row.actionItems || '[]') : (Array.isArray(row.actionItems) ? row.actionItems : []),
                sources: typeof row.sources === 'string' ? JSON.parse(row.sources || '[]') : (Array.isArray(row.sources) ? row.sources : []),
                confidence: typeof row.confidence === 'number' ? row.confidence : 0.8,
                dataBacked: typeof row.dataBacked === 'boolean' ? row.dataBacked : true,
                data,
            });
        }
    }

    const context = mapCase(raw);

    // Cùng một bổ trợ như `analyze`. Thiếu dòng này thì mọi lần chạy lại downstream
    // âm thầm mất lịch sử kiểm tra lô của D2 và liên kết FMEA của D7 — báo cáo chạy
    // lại nghèo dữ liệu hơn báo cáo chạy lần đầu, mà không có cảnh báo nào.
    await enrichFromDatabase(context);

    const [
        { enrichment, tokens: parseTokens },
        { analysis: independent, tokens: diagnoseTokens },
        perStep,
    ] = await Promise.all([
        enrichContext(raw, context),
        diagnoseIndependently(context),
        // `findPrecedents` chọn engine: graph hay chấm điểm. Mặc định là chấm
        // điểm, nên tới khi có người bật `GraphRetrievalSettings.engine = 'graph'`
        // thì đây vẫn là đúng lời gọi cũ đi qua thêm một lớp mỏng.
        findPrecedents(context, raw).catch(() => emptyPerStepPrecedents()),
    ]);

    const {
        result,
        tokens: analyzeTokens,
        configs: runtimeConfigs,
        inputs: runtimeInputs,
        diagnostics: inputDiagnostics,
        repairs,
    } = await generateReportProgressive(
        context,
        enrichment,
        independent,
        perStep,
        onStepComplete,
        initialCompleted,
        downstreamCodes,
    );

    const [parseModel, analyzeModel] = await Promise.all([
        resolveModel(ACTIVITY_PARSE),
        resolveModel(ACTIVITY_ANALYZE),
    ]);

    const runtime = Object.fromEntries(result.disciplines.flatMap((discipline) => {
        const config = runtimeConfigs[discipline.code];
        if (!config?.formSchema) return [];
        const violations = validateFlexibleResult(discipline, config, runtimeInputs[discipline.code] ?? {});
        return [[discipline.code, {
            resultJson: JSON.stringify(discipline.data ?? {}),
            formSchemaJson: JSON.stringify(config.formSchema),
            validationJson: JSON.stringify({ version: 1, violations, inputDiagnostics: inputDiagnostics[discipline.code] ?? [], repairs }),
            configVersion: config.configVersion,
        }]];
    }));

    return {
        context,
        result,
        independent,
        models: { parse: parseModel, analyze: analyzeModel },
        precedents: perStep,
        tokensUsed: parseTokens + diagnoseTokens + analyzeTokens,
        durationMs: Date.now() - started,
        repairs,
        runtime,
    };
}
