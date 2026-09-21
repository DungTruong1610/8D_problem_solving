/**
 * Đọc công tắc engine từ DB, có cache và có đường lùi an toàn.
 *
 * ── Vì sao mặc định là `scoring` chứ không `graph` ──
 * Ngày đầu tiên sau khi deploy, hành vi phải giống hệt hôm trước. Một tính năng
 * tự bật lên là một tính năng không ai kịp đối chiếu — và ở đây "đối chiếu" có
 * nghĩa cụ thể: chạy `npm run shadow:graph` rồi đọc bảng so sánh.
 *
 * Cùng lý do đó, MỌI đường lỗi ở file này đều trả về `scoring`: bảng chưa deploy,
 * dòng chưa seed, DB không đọc được. Rơi về engine đang chạy tốt là đúng; ném lỗi
 * hoặc âm thầm bật engine mới thì không.
 */

import cds from '@sap/cds';
import {
    DEFAULT_STEP_PROFILES,
    STEP_CODES,
    normalizeStepParams,
    type GraphStepProfile,
    type StepCode,
} from './stepProfiles';

const LOG = cds.log('graph');

export const GRAPH_SETTINGS = 'cnma.proresolve.GraphRetrievalSettings';

export type RetrievalEngine = 'scoring' | 'graph';

export interface GraphSettings {
    engine: RetrievalEngine;
    maxKeywords: number;
    fallbackEnabled: boolean;
}

export const DEFAULT_SETTINGS: GraphSettings = Object.freeze({
    engine: 'graph',
    maxKeywords: 30,
    fallbackEnabled: true,
});

/**
 * Cache 30 giây — cùng con số và cùng lý do với `configRepository`.
 *
 * Một lượt phân tích đọc cấu hình nhiều lần; đọc DB mỗi lần là khứ hồi thừa cho
 * một giá trị đổi vài lần một tháng. 30 giây đủ ngắn để admin bấm lưu rồi thử
 * ngay mà không phải khởi động lại.
 */
const TTL_MS = 30_000;
let cached: { value: GraphSettings; at: number } | null = null;

export function resetGraphSettingsCache(): void {
    cached = null;
}

/** Chuẩn hoá một dòng DB thành cấu hình dùng được. Hàm thuần — test không cần DB. */
export function normalizeSettings(row: unknown): GraphSettings {
    const r = (row ?? {}) as Record<string, unknown>;
    const engine = String(r.engine ?? '').toLowerCase();
    const maxKeywords = Number(r.maxKeywords);

    return {
        // Mặc định là `graph`. Chỉ khi khai rõ 'scoring' mới rơi về engine cũ.
        engine: engine === 'scoring' ? 'scoring' : 'graph',
        maxKeywords: Number.isFinite(maxKeywords) && maxKeywords > 0
            ? Math.floor(maxKeywords)
            : DEFAULT_SETTINGS.maxKeywords,
        fallbackEnabled: r.fallbackEnabled !== false,
    };
}

export async function getGraphSettings(): Promise<GraphSettings> {
    if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

    let value = DEFAULT_SETTINGS;
    try {
        const db = await cds.connect.to('db');
        const rows = (await db.run(SELECT.from(GRAPH_SETTINGS))) as unknown[];
        if (rows.length) value = normalizeSettings(rows[0]);
    } catch (e: any) {
        LOG.warn(`Không đọc được GraphRetrievalSettings (${e.message}) — dùng engine graph.`);
    }

    cached = { value, at: Date.now() };
    return value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Trọng số từng bước
// ─────────────────────────────────────────────────────────────────────────────

export const GRAPH_STEP_PARAMS = 'cnma.proresolve.GraphStepParams';

let cachedProfiles: { value: Record<StepCode, GraphStepProfile>; at: number } | null = null;

export function resetStepProfilesCache(): void {
    cachedProfiles = null;
}

/**
 * Trọng số đang có hiệu lực cho cả tám bước.
 *
 * Thiếu dòng, dòng bị tắt, hoặc dòng vi phạm bất biến ⇒ bước đó dùng
 * `DEFAULT_STEP_PROFILES`. Nghĩa là deploy bảng này KHÔNG đổi hành vi cho tới khi
 * có người thật sự sửa một con số — cùng thái độ mà `StepPrompts` đã đặt ra.
 *
 * Dòng bị từ chối được LOG Ở MỨC WARN kèm lý do. Im lặng rơi về mặc định là cách
 * chắc chắn nhất để admin tin rằng cấu hình của mình đang chạy trong khi không.
 */
export async function getStepProfiles(): Promise<Record<StepCode, GraphStepProfile>> {
    if (cachedProfiles && Date.now() - cachedProfiles.at < TTL_MS) return cachedProfiles.value;

    const value = { ...DEFAULT_STEP_PROFILES };
    try {
        const db = await cds.connect.to('db');
        const rows = (await db.run(SELECT.from(GRAPH_STEP_PARAMS))) as Array<Record<string, unknown>>;
        const byCode = new Map(rows.map((r) => [String(r.stepCode), r]));

        for (const code of STEP_CODES) {
            const { profile, violation } = normalizeStepParams(code, byCode.get(code));
            if (violation) LOG.warn(`GraphStepParams bị từ chối — ${violation}`);
            value[code] = profile;
        }
    } catch (e: any) {
        LOG.warn(`Không đọc được GraphStepParams (${e.message}) — dùng trọng số mặc định.`);
    }

    cachedProfiles = { value, at: Date.now() };
    return value;
}

/** Một bước, kèm phán quyết của `normalizeStepParams` về dòng đã lưu. */
export interface StepDiagnostic {
    stepCode: StepCode;
    /** false = dòng đã lưu bị từ chối, hoặc bị tắt, hoặc chưa có. */
    accepted: boolean;
    /** Lý do từ chối, nguyên văn từ `normalizeStepParams`. Null khi không bị từ chối. */
    violation: string | null;
    /** Có dòng trong bảng hay không. */
    hasRow: boolean;
    /** Cột `enabled` của dòng. Null khi chưa có dòng. */
    enabled: boolean | null;
    /** Profile ĐANG CHẠY cho bước này. */
    effective: GraphStepProfile;
}

/**
 * Trọng số đang chạy kèm lý do từ chối — thứ màn hình cấu hình phải hiện.
 *
 * ── Vì sao không dùng lại `getStepProfiles` ──
 * Hàm đó nuốt `violation` vào một dòng log rồi trả về profile đã rơi về mặc
 * định. Nhìn kết quả của nó thì "admin gõ đúng bằng mặc định" và "admin gõ sai
 * nên bị từ chối" trông giống hệt nhau, mà đó lại chính là hai trường hợp màn
 * hình cần phân biệt. Nên ở đây gọi thẳng `normalizeStepParams` và giữ cả hai
 * nửa của kết quả.
 *
 * KHÔNG đọc cache: admin vừa bấm lưu là muốn thấy phán quyết cho dòng vừa lưu,
 * không phải cho dòng của ba mươi giây trước.
 */
export async function inspectStepProfiles(): Promise<StepDiagnostic[]> {
    const db = await cds.connect.to('db');
    const rows = (await db.run(SELECT.from(GRAPH_STEP_PARAMS))) as Array<Record<string, unknown>>;
    const byCode = new Map(rows.map((r) => [String(r.stepCode), r]));

    return STEP_CODES.map((stepCode) => {
        const row = byCode.get(stepCode);
        const { profile, violation } = normalizeStepParams(stepCode, row);
        const enabled = row ? row.enabled !== false : null;
        return {
            stepCode,
            // Bị tắt không phải là lỗi — đó là cách nói "dùng mặc định cho bước
            // này", nên nó cũng không được hiện như một dòng bị từ chối.
            accepted: Boolean(row) && enabled === true && !violation,
            violation: violation ?? null,
            hasRow: Boolean(row),
            enabled,
            effective: profile,
        };
    });
}

/**
 * Bù những bước chưa có dòng cấu hình, seed từ `DEFAULT_STEP_PROFILES`.
 *
 * Bù theo TỪNG BƯỚC chứ không phải "chỉ khi bảng rỗng" — cùng lý do
 * `profileRepository` đã ghi: thêm một bước mới rồi deploy phải tới được môi
 * trường đã chạy, chứ không im lặng bỏ qua vì bảng đã có dòng.
 *
 * Seed đúng bằng con số đang chạy, nên nó KHÔNG đổi hành vi — nó chỉ làm cho
 * những con số đó nhìn thấy và sửa được trên màn hình, thay vì nằm trong code.
 */
export async function seedGraphStepParams(): Promise<void> {
    try {
        const db = await cds.connect.to('db');
        const existing = (await db.run(
            SELECT.from(GRAPH_STEP_PARAMS).columns('stepCode'),
        )) as Array<{ stepCode: string }>;
        const have = new Set(existing.map((r) => String(r.stepCode)));
        const missing = STEP_CODES.filter((code) => !have.has(code));
        if (!missing.length) return;

        await db.run(INSERT.into(GRAPH_STEP_PARAMS).entries(
            missing.map((code, i) => {
                const p = DEFAULT_STEP_PROFILES[code];
                return {
                    stepCode: code,
                    label: p.label,
                    question: p.question,
                    wWorkCenter: p.weights.workCenter ?? null,
                    wMaterial: p.weights.material ?? null,
                    wMaterialFamily: p.weights.materialFamily ?? null,
                    wDefectCode: p.weights.defectCode ?? null,
                    wKeywords: p.weights.keywords ?? null,
                    wContainment: p.weights.containment ?? null,
                    wCorrective: p.weights.corrective ?? null,
                    wPreventive: p.weights.preventive ?? null,
                    keywordCap: p.keywordCap,
                    minScore: p.minScore,
                    topN: p.topN,
                    actionType: p.actionType ?? null,
                    // Seed câu hỏi và sàn kể cả khi trọng số là 0 (= tắt): bật
                    // re-rank cho một bước phải là sửa MỘT con số, không phải nhớ
                    // lại cả một đoạn instruction.
                    wRerank: p.rerank?.weight || null,
                    rerankFloor: p.rerank?.floor ?? null,
                    rerankQueryFrame: p.rerank?.queryFrame ?? null,
                    rerankCandidateFrame: p.rerank?.candidateFrame ?? null,
                    rerankRubric: p.rerank?.rubric ?? null,
                    enabled: true,
                    sortOrder: (STEP_CODES.indexOf(code) + 1) * 10 + i * 0,
                };
            }),
        ));
        resetStepProfilesCache();
        LOG.info(`Đã seed trọng số graph cho ${missing.length} bước: ${missing.join(', ')}`);
    } catch (e: any) {
        LOG.error(`Seed GraphStepParams thất bại (app vẫn chạy với mặc định): ${e.message}`);
    }
}
