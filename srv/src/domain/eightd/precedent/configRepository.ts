import cds from '@sap/cds';
import {
    DEFAULT_CRITERIA,
    DEFAULT_RETRIEVAL_SETTINGS,
    DEFAULT_STEP_PROMPTS,
} from './defaults';

const LOG = cds.log('precedent-config');

export const CRITERIA = 'cnma.proresolve.SimilarityCriteria';
export const SETTINGS = 'cnma.proresolve.RetrievalSettings';
export const STEP_PROMPTS = 'cnma.proresolve.StepPrompts';

export const GLOBAL_SETTINGS_ID = 'GLOBAL';

export interface RetrievalSettings {
    minScore: number;
    topN: number;
    closedOnly: boolean;
}

/**
 * Xoá cache cấu hình prompt.
 *
 * Giữ tên cũ vì nhiều nơi gọi nó sau mỗi lượt ghi. Cache trọng số chấm điểm giờ
 * nằm ở `profileRepository.clearProfileCache()` — hai vòng đời khác nhau, và gộp
 * chúng lại nghĩa là sửa một prompt cũng bắt nạp lại toàn bộ profile.
 */
export function clearRetrievalConfigCache(): void {
    // Prompt đọc thẳng DB mỗi lần (`getStepPromptRuntimeConfig`), nên ở đây chưa
    // có gì để xoá. Hàm vẫn tồn tại như một điểm móc: thêm cache cho prompt mà
    // quên đường xoá là lỗi "admin lưu xong vẫn thấy giá trị cũ" kinh điển.
}

/**
 * Hướng dẫn từng discipline lấy từ bảng `StepPrompts`.
 *
 * Bước bị tắt hoặc để trống thì KHÔNG có mặt trong kết quả — người gọi rơi về
 * `DEFAULT_DISCIPLINE_GUIDE` trong `prompts.ts`. Nhờ vậy một bảng rỗng cho ra
 * đúng prompt như trước khi có tính năng này.
 *
 * Đọc lỗi ⇒ trả object rỗng, KHÔNG ném: một bảng cấu hình hỏng không được phép
 * làm chết cả pipeline phân tích.
 */
export async function getDisciplineGuide(): Promise<Record<string, string>> {
    try {
        const db = await cds.connect.to('db');
        const rows = await db.run(SELECT.from(STEP_PROMPTS).columns('stepCode', 'systemPrompt', 'combinedPrompt', 'enabled'));
        const out: Record<string, string> = {};
        for (const r of rows as any[]) {
            if (r.enabled === false) continue;
            const text = String(r.combinedPrompt ?? r.systemPrompt ?? '').trim();
            if (text) out[String(r.stepCode)] = text;
        }
        return out;
    } catch (e: any) {
        LOG.warn(`Không đọc được hướng dẫn từng bước, dùng mặc định trong code: ${e.message}`);
        return {};
    }
}

export interface StepPromptRuntimeConfig {
    inputSchemaJson: string;
    combinedPrompt: string;
    formSchemaJson: string;
    constraintsJson: string;
}

export async function getStepPromptRuntimeConfig(stepCode: string): Promise<StepPromptRuntimeConfig | null> {
    try {
        const db = await cds.connect.to('db');
        const row = await db.run(SELECT.one.from(STEP_PROMPTS).where({ stepCode }));
        if (!row || row.enabled === false) return null;
        return {
            inputSchemaJson: String(row.inputSchemaJson ?? ''),
            combinedPrompt: String(row.combinedPrompt ?? row.systemPrompt ?? ''),
            formSchemaJson: String(row.formSchemaJson ?? ''),
            constraintsJson: String(row.constraintsJson ?? ''),
        };
    } catch (e: any) {
        LOG.warn(`Khong doc duoc cau hinh runtime ${stepCode}: ${e.message}`);
        return null;
    }
}

/** Prompt của một bước D, hoặc `null` khi chưa cấu hình / đã tắt. */
export async function getStepPrompt(
    stepCode: string,
): Promise<{ systemPrompt: string; userTemplate: string } | null> {
    try {
        const db = await cds.connect.to('db');
        const row = await db.run(SELECT.one.from(STEP_PROMPTS).where({ stepCode }));
        if (!row || row.enabled === false) return null;

        const systemPrompt = String(row.systemPrompt ?? '').trim();
        const userTemplate = String(row.userTemplate ?? '').trim();
        // Trống = "chưa cấu hình" ⇒ người gọi dùng hằng số trong prompts.ts.
        if (!systemPrompt && !userTemplate) return null;

        return { systemPrompt, userTemplate };
    } catch (e: any) {
        LOG.warn(`Không đọc được prompt bước ${stepCode}, dùng mặc định: ${e.message}`);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Nạp mặc định vào ba bảng cấu hình — CHỈ khi bảng còn rỗng.
 *
 * ── Vai trò của `SimilarityCriteria` và `RetrievalSettings` sau khi có profile ──
 * Hai bảng này KHÔNG còn được đọc lúc chạy. `seedRetrievalProfiles()` đọc chúng
 * đúng một lần để dựng profile `default`, nhờ vậy trọng số admin đã chỉnh trên
 * bản trước đi thẳng sang bộ mới thay vì bị kéo về mặc định của code.
 *
 * Vẫn seed chúng vì hai lý do: DB mới có sẵn nguồn để profile `default` sinh ra,
 * và bản ghi cũ còn nguyên nếu cần quay về. Xem `profileRepository.ts`.
 *
 * Idempotent: chạy mỗi lần khởi động, lần thứ hai trở đi không làm gì. Đây là lý
 * do không dùng CSV trong `db/data/`: CSV bị HDI ghi đè mỗi lần deploy, còn cách
 * này giữ nguyên phần admin đã chỉnh.
 *
 * Không bao giờ ném lỗi lên trên — app phải khởi động được kể cả khi seed hỏng,
 * vì `getRetrievalConfig()` đã có đường rơi về mặc định trong code.
 */
export async function seedRetrievalConfig(): Promise<void> {
    try {
        const db = await cds.connect.to('db');

        // Bù theo TỪNG KHOÁ, không phải "chỉ khi bảng rỗng".
        //
        // Bản đầu chỉ seed khi bảng rỗng. Hệ quả: thêm một tiêu chí mới vào
        // `defaults.ts` rồi deploy thì nó KHÔNG BAO GIỜ tới được môi trường đã
        // chạy, vì bảng đã có mấy dòng cũ nên điều kiện không đúng nữa. Tính năng
        // im lặng không hoạt động và không có gì báo — đúng như tiêu chí ngữ
        // nghĩa đã vắng mặt trên HANA sau khi thêm.
        //
        // Chỉ THÊM khoá còn thiếu; trọng số admin đã chỉnh trên khoá cũ giữ nguyên.
        const existingCriteria = await db.run(SELECT.from(CRITERIA).columns('criterionKey'));
        const haveKeys = new Set(existingCriteria.map((r: any) => String(r.criterionKey)));
        const missingCriteria = DEFAULT_CRITERIA.filter((c) => !haveKeys.has(c.criterionKey));
        if (missingCriteria.length) {
            await db.run(
                INSERT.into(CRITERIA).entries(
                    missingCriteria.map((c) => ({
                        criterionKey: c.criterionKey,
                        label: c.label,
                        description: c.description,
                        sourceTable: c.sourceTable,
                        sourceField: c.sourceField,
                        matchType: c.matchType,
                        weight: c.weight,
                        fallbackField: c.fallbackField,
                        fallbackMatch: c.fallbackMatch,
                        fallbackWeight: c.fallbackWeight,
                        minSimilarity: c.minSimilarity ?? null,
                        enabled: c.enabled,
                        sortOrder: c.sortOrder,
                    })),
                ),
            );
            LOG.info(`Đã thêm ${missingCriteria.length} tiêu chí chấm điểm: ${missingCriteria.map((c) => c.criterionKey).join(", ")}`);
        }

        const existingSettings = await db.run(
            SELECT.one.from(SETTINGS).where({ ID: GLOBAL_SETTINGS_ID }),
        );
        if (!existingSettings) {
            await db.run(INSERT.into(SETTINGS).entries({ ...DEFAULT_RETRIEVAL_SETTINGS }));
            LOG.info(
                `Đã seed ngưỡng truy hồi: minScore=${DEFAULT_RETRIEVAL_SETTINGS.minScore} `
                + `topN=${DEFAULT_RETRIEVAL_SETTINGS.topN}`,
            );
        }

        const existingPrompts = await db.run(SELECT.from(STEP_PROMPTS).columns('stepCode'));
        const have = new Set(existingPrompts.map((r: any) => r.stepCode));
        const missing = DEFAULT_STEP_PROMPTS.filter((p) => !have.has(p.stepCode));
        if (missing.length) {
            await db.run(
                INSERT.into(STEP_PROMPTS).entries(
                    missing.map((p) => ({
                        stepCode: p.stepCode,
                        label: p.label,
                        description: p.description,
                        systemPrompt: p.systemPrompt,
                        userTemplate: null,
                        inputSchemaJson: p.inputSchemaJson ?? null,
                        combinedPrompt: p.combinedPrompt ?? p.systemPrompt,
                        formSchemaJson: p.formSchemaJson ?? null,
                        constraintsJson: p.constraintsJson ?? null,
                        enabled: true,
                        version: 1,
                    })),
                ),
            );
            LOG.info(`Đã seed ${missing.length} dòng prompt bước D`);
        }

        for (const configuredDefault of DEFAULT_STEP_PROMPTS) {
            const current = await db.run(SELECT.one.from(STEP_PROMPTS).where({ stepCode: configuredDefault.stepCode }));
            const patch: Record<string, string | number> = {};
            for (const field of ['inputSchemaJson', 'combinedPrompt', 'formSchemaJson', 'constraintsJson'] as const) {
                if (!String(current?.[field] ?? '').trim() && configuredDefault[field]) patch[field] = configuredDefault[field];
            }
            // Upgrade only the original narrative-only defaults. Admin-authored structured
            // schemas are preserved; resetStep remains the explicit way to replace them.
            try {
                const parsedCurrent = JSON.parse(String(current?.formSchemaJson ?? '{}')) as { fields?: Array<{ key?: string; widget?: string }> };
                const currentFields = parsedCurrent.fields?.map((field) => field.key).filter(Boolean) ?? [];
                const defaultFields = (JSON.parse(String(configuredDefault.formSchemaJson ?? '{}')) as { fields?: Array<{ key?: string }> }).fields?.map((field) => field.key).filter(Boolean) ?? [];
                const legacyFields = new Set(['summary', 'content', 'actionItems', 'sources', 'confidence', 'dataBacked']);
                const isLegacyDefault = currentFields.length > 0 && currentFields.every((key) => legacyFields.has(String(key)));
                if (isLegacyDefault) {
                    for (const field of ['inputSchemaJson', 'combinedPrompt', 'formSchemaJson', 'constraintsJson'] as const) {
                        if (configuredDefault[field]) patch[field] = configuredDefault[field];
                    }
                    patch.version = Math.max(2, Number(current?.version ?? 1) + 1);
                }
                // Upgrade D3 if it has legacy widget 'table' on containment.actions
                const isD3OldTable = configuredDefault.stepCode === 'D3' && (parsedCurrent.fields ?? []).some((f) => f.key === 'containment.actions' && f.widget === 'table');
                // Upgrade D4 if it has legacy widget 'table' on fiveWhy or missing ishikawaBoard
                const isD4OldTable = configuredDefault.stepCode === 'D4' && (
                    (parsedCurrent.fields ?? []).some((f) => f.key === 'rootCause.fiveWhy' && f.widget === 'table')
                    || !(parsedCurrent.fields ?? []).some((f) => f.key === 'rootCause.ishikawaBoard')
                );
                // Upgrade D5..D8 if missing or empty formSchemaJson
                const isD5to8MissingForm = ['D5', 'D6', 'D7', 'D8'].includes(configuredDefault.stepCode) && (!current?.formSchemaJson || !String(current.formSchemaJson).trim());

                if (isD3OldTable || isD4OldTable || isD5to8MissingForm) {
                    for (const field of ['inputSchemaJson', 'formSchemaJson', 'combinedPrompt', 'constraintsJson'] as const) {
                        if (configuredDefault[field]) patch[field] = configuredDefault[field];
                    }
                    patch.version = Math.max(7, Number(current?.version ?? 1) + 1);
                }

                const usesStructuredDefaultForm = currentFields.length > 0
                    && currentFields.length === defaultFields.length
                    && currentFields.every((key, index) => key === defaultFields[index]);
                if (usesStructuredDefaultForm && configuredDefault.inputSchemaJson
                    && String(current?.inputSchemaJson ?? '') !== configuredDefault.inputSchemaJson) {
                    // Repairs the intermediate release where Form Editor was upgraded
                    // before Data Schema changed from input selection to output contract.
                    patch.inputSchemaJson = configuredDefault.inputSchemaJson;
                    patch.version = Math.max(3, Number(current?.version ?? 1) + 1);
                }
                if (usesStructuredDefaultForm && Number(current?.version ?? 1) <= 3) {
                    // v4 marks AI-generated output fields and consolidates each step
                    // into one readable section.
                    for (const field of ['inputSchemaJson', 'formSchemaJson', 'combinedPrompt', 'constraintsJson'] as const) {
                        if (configuredDefault[field]) patch[field] = configuredDefault[field];
                    }
                    patch.version = 4;
                }
                if (usesStructuredDefaultForm && Number(current?.version ?? 1) <= 5) {
                    // v6 siet do co dong D4: prompt ngan gon, truc dien, khong lan man disclaimer
                    for (const field of ['inputSchemaJson', 'formSchemaJson', 'combinedPrompt', 'constraintsJson'] as const) {
                        if (configuredDefault[field]) patch[field] = configuredDefault[field];
                    }
                    patch.version = 6;
                }
                const previousD1Fields = ['team.objective', 'team.roster', 'team.skillCoverage', 'team.readinessStatus', 'team.gaps', 'team.assignmentRationale', 'sources'];
                const usesPreviousD1Default = configuredDefault.stepCode === 'D1'
                    && currentFields.length === previousD1Fields.length
                    && currentFields.every((key, index) => key === previousD1Fields[index]);
                if (usesPreviousD1Default && Number(current?.version ?? 1) <= 4) {
                    for (const field of ['inputSchemaJson', 'formSchemaJson', 'combinedPrompt', 'constraintsJson'] as const) {
                        if (configuredDefault[field]) patch[field] = configuredDefault[field];
                    }
                    patch.version = 5;
                }
            } catch { /* Invalid custom JSON is left untouched for the editor to repair. */ }
            if (Object.keys(patch).length) await db.run(UPDATE(STEP_PROMPTS).set(patch).where({ stepCode: configuredDefault.stepCode }));
        }

        // Bù nội dung cho dòng đã tồn tại nhưng còn rỗng.
        //
        // Bảng được tạo ở bản trước với `systemPrompt = null`. Chỉ thêm dòng
        // thiếu là không đủ: tám dòng cũ vẫn rỗng, UI vẫn trống, và không có gì
        // báo — đúng cái vòng lặp đã xảy ra với kho case và với tiêu chí chấm điểm.
        const blank = (await db.run(
            SELECT.from(STEP_PROMPTS).columns('stepCode', 'systemPrompt'),
        )).filter((r: any) => !String(r.systemPrompt ?? '').trim());
        if (blank.length) {
            for (const row of blank as any[]) {
                const def = DEFAULT_STEP_PROMPTS.find((p) => p.stepCode === row.stepCode);
                if (!def) continue;
                await db.run(
                    UPDATE(STEP_PROMPTS).set({ systemPrompt: def.systemPrompt }).where({ stepCode: row.stepCode }),
                );
            }
            LOG.info(`Đã bù nội dung cho ${blank.length} dòng prompt còn rỗng`);
        }

        clearRetrievalConfigCache();
    } catch (e: any) {
        LOG.error(`Seed cấu hình truy hồi thất bại (app vẫn chạy với mặc định): ${e.message}`);
    }
}
