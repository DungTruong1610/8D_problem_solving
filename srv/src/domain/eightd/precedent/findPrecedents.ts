/**
 * Tìm case tiền lệ cho một case đang mở — 100% code, KHÔNG gọi AI.
 *
 *   profile  →  lọc SQL  →  chấm điểm (hàm thuần)  →  cắt ngưỡng  →  top-N
 *
 * ── Vì sao không còn "một máy tương đồng dùng chung" ──
 * Bản đầu chạy đúng một bộ trọng số cho cả tám bước, với lý do: hai định nghĩa
 * tương đồng khác nhau cho cùng một hồ sơ là cách chắc chắn nhất để hai bước mâu
 * thuẫn nhau. Lý do đó vẫn đúng — nhưng nó nói về việc hai bước KẾT LUẬN khác
 * nhau, không phải việc hai bước TÌM khác nhau.
 *
 * D1 hỏi "ai đã làm loại lỗi này", D4 hỏi "lỗi này hỏng theo cơ chế nào". Hai câu
 * đó xếp hạng kho theo hai thứ tự khác nhau, và ép chúng dùng chung một thứ tự
 * là ép cả hai nhận một thoả hiệp không tối ưu cho bên nào.
 *
 * Cái phải giữ nguyên là TRÍCH DẪN: `precedents#N` trỏ vào đúng một case ở mọi
 * bước. Xem `findPrecedentsByStep` — đó là chỗ danh sách hợp nhất được đánh số.
 */

import cds from '@sap/cds';
import {
    getProfile,
    getProfileConfig,
    STEP_CODES,
    type RetrievalProfile,
    type StepCode,
} from './profileRepository';
import {
    explainScore,
    scoreCase,
    tokenizeDefectText,
    type CriterionHit,
    type ScorableCase,
} from './scoring';
import { flattenPayload, parseAttributes } from './sourceFields';
import {
    countLibrary,
    fetchActions,
    fetchCandidates,
    fetchTeamMembers,
    type ActionRow,
    type CandidateRow,
    type TeamMemberRow,
} from './precedentRepository';
import { buildQueryText } from './searchText';
import { embed, currentEmbeddingModel } from '../../../core/ai/llmClient';
import { applyRerank, frameFromInstruction, rerankCandidates } from './reranker';
import type { CaseContext } from '../types';

const LOG = cds.log('precedent');

export interface Precedent {
    notificationId: string;
    score: number;
    maxScore: number;
    breakdown: CriterionHit[];
    /** Một dòng người đọc hiểu: `"7/11 — Work center WC-MILL-07, Material MAT-10247"`. */
    explanation: string;

    symptomShortText: string | null;
    sapStatus: string | null;
    completionDate: string | null;
    quantityExtent: string | null;
    workCenterId: string | null;
    workCenterDesc: string | null;
    defectCode: string | null;
    defectText: string | null;
    materialId: string | null;
    materialDesc: string | null;
    rootCauseCategory: string | null;
    copqEur: number | null;
    fmeaId: string | null;

    team: Array<Omit<TeamMemberRow, 'caseId' | 'notificationId'>>;
    actions: Array<Omit<ActionRow, 'caseId' | 'notificationId'>>;
}

export interface PrecedentResult {
    precedents: Precedent[];
    /**
     * Vì sao không có tiền lệ. Null khi có.
     *
     * Bắt buộc phải phân biệt được "kho chưa nạp" với "đã tìm nhưng không đủ
     * điểm" — nhìn ngoài UI hai thứ giống hệt nhau, mà cách xử lý hoàn toàn khác.
     */
    reason: string | null;
    maxScore: number;
    settings: { minScore: number; topN: number; closedOnly: boolean };
    libraryCount: number;
    candidatesScored: number;
    /**
     * Tiêu chí ngữ nghĩa có thực sự tham gia lần chấm này không.
     *
     * `false` khi nó bị tắt, hoặc khi nhúng case đang mở thất bại. Phân biệt hai
     * chuyện đó với "đã so nhưng không đủ gần" là cần thiết: nhìn kết quả thì
     * giống nhau, mà nguyên nhân hoàn toàn khác.
     */
    semanticUsed: boolean;
    /** Profile đã chạy — để UI và log nói được kết quả này đến từ cấu hình nào. */
    profileKey: string;
    profileLabel: string;
}

/**
 * `CaseContext` → dạng chấm điểm được. Từ khoá tách ngay tại đây.
 *
 * @param raw payload SAP gốc, để tiêu chí trỏ vào đường dẫn payload có dữ liệu
 *            mà so. Thiếu nó thì những tiêu chí đó ăn 0 điểm — nên nơi nào có
 *            `raw` trong tay thì phải truyền vào.
 */
export function toScorable(context: CaseContext, raw?: unknown): ScorableCase {
    return {
        notificationId: context.notificationId,
        workCenterId: context.product.workCenterId || null,
        defectCode: context.product.defectCode || null,
        defectText: context.product.defectText || null,
        // Tách bằng CHÍNH hàm đã dùng lúc nạp kho — hai cách tách khác nhau ở hai
        // đầu là lỗi âm thầm: không bao giờ khớp mà cũng không bao giờ báo lỗi.
        defectKeywords: tokenizeDefectText(context.product.defectText),
        materialId: context.product.materialId || null,
        materialFamily: context.product.materialGroup || null,
        // Làm phẳng bằng CHÍNH hàm đã dùng lúc nạp kho, vì lý do y hệt trên.
        attributes: raw === undefined ? null : flattenPayload(raw),
    };
}

/** Dòng kho → dạng chấm điểm được, với payload đã parse sẵn một lần. */
function toCandidate(row: CandidateRow): CandidateRow {
    return { ...row, attributes: parseAttributes(row.attributesJson) };
}

/**
 * Nhúng case đang mở để có vector đem đi so.
 *
 * Ghép đoạn văn bằng CÙNG hàm đã dùng lúc nạp kho — khác công thức ở hai đầu thì
 * hai vector nằm ở hai phân bố khác nhau và cosine mất ý nghĩa.
 *
 * Hỏng thì trả `null` chứ không ném: mất tiêu chí ngữ nghĩa vẫn còn các tiêu chí
 * theo luật. Đổi cả tính năng tìm tiền lệ lấy một sự cố tạm thời của AI Core là
 * cái giá quá đắt.
 */
async function embedQuery(
    context: CaseContext,
): Promise<{ embedding: number[]; embeddingModel: string } | null> {
    try {
        const embedding = await embed(buildQueryText(context));
        if (!Array.isArray(embedding) || !embedding.length) return null;
        return { embedding, embeddingModel: currentEmbeddingModel() };
    } catch (e: any) {
        LOG.warn(
            `Không nhúng được case ${context.notificationId} (${e.message}) — `
            + 'bỏ tiêu chí ngữ nghĩa, vẫn chấm theo các tiêu chí còn lại.',
        );
        return null;
    }
}

/** Profile này có cần vector không. */
function needsEmbedding(profile: RetrievalProfile): boolean {
    return profile.criteria.some((c) => c.enabled && (c.matchType || 'exact') === 'cosine');
}

/**
 * Chấm kho theo MỘT profile. Không gọi embedding, không đếm kho — người gọi lo.
 *
 * Tách ra để tám bước dùng chung đúng một lần nhúng và một bộ ứng viên: gọi lại
 * `findPrecedents` tám lần sẽ tốn tám lời gọi AI cho cùng một đoạn văn.
 */
async function scoreWithProfile(
    current: ScorableCase,
    profile: RetrievalProfile,
    libraryCount: number,
    semanticAvailable: boolean,
    cache: Map<string, CandidateRow[]>,
    /** Văn bản query cho tầng re-rank — null khi người gọi không có context. */
    rerankQueryText: string | null = null,
): Promise<PrecedentResult> {
    const settings = {
        minScore: profile.minScore,
        topN: profile.topN,
        closedOnly: profile.closedOnly,
    };
    const maxScore = profile.criteria
        .filter((c) => c.enabled)
        .reduce((sum, c) => sum + (Number(c.weight) || 0), 0);

    const base = {
        maxScore,
        settings,
        libraryCount,
        semanticUsed: semanticAvailable && needsEmbedding(profile),
        profileKey: profile.profileKey,
        profileLabel: profile.label,
    };

    if (libraryCount === 0) {
        return {
            ...base,
            precedents: [],
            candidatesScored: 0,
            reason:
                'The case library is empty — no historical cases have been loaded yet. '
                + 'Run the library seed before expecting precedent-based suggestions.',
        };
    }

    const candidates = (await fetchCandidates(current, profile.criteria, settings, cache))
        .map(toCandidate);

    const byRank = (
        a: { row: CandidateRow; result: ReturnType<typeof scoreCase> },
        b: { row: CandidateRow; result: ReturnType<typeof scoreCase> },
    ) =>
        b.result.score - a.result.score
        // Điểm bằng nhau thì lấy case đóng gần đây nhất: bài học mới phản ánh
        // đúng dây chuyền hiện tại hơn. Chốt bằng mã case để kết quả tất định.
        || String(b.row.completionDate ?? '').localeCompare(String(a.row.completionDate ?? ''))
        || a.row.notificationId.localeCompare(b.row.notificationId);

    let ranked = candidates.map((row) => ({ row, result: scoreCase(current, row, profile.criteria) }));

    // ── Tầng 2: re-rank (chỉ khi profile bật tiêu chí `rerank`) ──────────────
    // Pool giữ những case CÓ KHẢ NĂNG đạt ngưỡng sau re-rank (điểm tầng 1 +
    // trọng số re-rank ≥ minScore) — lọc thẳng theo minScore ở đây sẽ loại oan
    // đúng những case tầng 2 sinh ra để cứu. Ngưỡng thật áp SAU khi có điểm cuối.
    const rerankCriterion = profile.criteria.find(
        (c) => c.enabled && (c.matchType || 'exact') === 'rerank',
    );
    if (rerankCriterion) {
        const rerankWeight = Number(rerankCriterion.weight) || 0;
        const poolSize = Math.min(20, Math.max(settings.topN * 4, 12));
        const pool = ranked
            .filter((x) => x.result.score + rerankWeight >= settings.minScore)
            .sort(byRank)
            .slice(0, poolSize);

        let verdicts: Awaited<ReturnType<typeof rerankCandidates>> | null = null;
        if (rerankQueryText && pool.length) {
            try {
                verdicts = await rerankCandidates(
                    // Engine chấm điểm chỉ có MỘT chuỗi instruction (`description`
                    // của tiêu chí), nên nó được bọc thành khung đầy đủ ở đây. Cả
                    // hai engine vì thế đi qua cùng một đường vào tầng 2.
                    frameFromInstruction(rerankCriterion.description ?? ''),
                    rerankQueryText,
                    pool.map(({ row }) => ({
                        notificationId: row.notificationId,
                        symptomShortText: row.symptomShortText,
                        searchText: row.searchText,
                    })),
                );
            } catch (e: any) {
                // Re-rank hỏng thì xếp hạng tầng 1 vẫn đứng — cùng triết lý với
                // embedding hỏng: không đổi cả tính năng lấy một sự cố tạm thời.
                LOG.warn(`Re-rank hỏng (${e.message}) — giữ xếp hạng tầng 1.`);
            }
        }
        applyRerank(
            pool.map(({ row, result }) => ({ notificationId: row.notificationId, result })),
            rerankCriterion,
            verdicts,
        );
        ranked = pool;
    }

    const scored = ranked
        .filter((x) => x.result.score >= settings.minScore)
        .sort(byRank)
        .slice(0, settings.topN);

    if (!scored.length) {
        return {
            ...base,
            precedents: [],
            candidatesScored: candidates.length,
            reason:
                `No past case scores at least ${settings.minScore} of ${maxScore} against this one `
                + `(${candidates.length} candidate${candidates.length === 1 ? '' : 's'} examined, `
                + `profile "${profile.label}"). No precedent will be shown rather than a weak guess.`,
        };
    }

    const caseIds = scored.map((x) => x.row.ID);
    const [team, actions] = await Promise.all([fetchTeamMembers(caseIds), fetchActions(caseIds)]);

    const teamByCase = new Map<string, TeamMemberRow[]>();
    for (const m of team) {
        const list = teamByCase.get(m.caseId) ?? [];
        list.push(m);
        teamByCase.set(m.caseId, list);
    }
    const actionsByCase = new Map<string, ActionRow[]>();
    for (const a of actions) {
        const list = actionsByCase.get(a.caseId) ?? [];
        list.push(a);
        actionsByCase.set(a.caseId, list);
    }

    const precedents: Precedent[] = scored.map(({ row, result }) => ({
        notificationId: row.notificationId,
        score: result.score,
        maxScore: result.maxScore,
        breakdown: result.breakdown,
        explanation: explainScore(result),

        symptomShortText: row.symptomShortText,
        sapStatus: row.sapStatus,
        completionDate: row.completionDate,
        quantityExtent: row.quantityExtent,
        workCenterId: row.workCenterId ?? null,
        workCenterDesc: row.workCenterDesc,
        defectCode: row.defectCode ?? null,
        defectText: row.defectText ?? null,
        materialId: row.materialId ?? null,
        materialDesc: row.materialDesc,
        rootCauseCategory: row.rootCauseCategory,
        copqEur: row.copqEur,
        fmeaId: row.fmeaId,

        team: (teamByCase.get(row.ID) ?? []).map(({ caseId, notificationId, ...rest }) => rest),
        actions: (actionsByCase.get(row.ID) ?? []).map(({ caseId, notificationId, ...rest }) => rest),
    }));

    return { ...base, precedents, candidatesScored: candidates.length, reason: null };
}

/**
 * Top-N case tiền lệ theo MỘT profile, sắp theo điểm giảm dần.
 *
 * Dưới ngưỡng ⇒ trả mảng rỗng kèm `reason`, KHÔNG bao giờ trả đại mấy case điểm
 * cao nhất. Requirement nói thẳng: *"Below a score of 3, do not surface a
 * precedent — say so explicitly instead of guessing."*
 */
export async function findPrecedents(
    context: CaseContext,
    opts: { raw?: unknown; profileKey?: string } = {},
): Promise<PrecedentResult> {
    const profile = await getProfile(opts.profileKey);
    const current = toScorable(context, opts.raw);

    // Chỉ gọi embedding khi thật sự có tiêu chí ngữ nghĩa đang bật — tắt nó đi
    // thì không tốn một lời gọi AI nào.
    let semanticAvailable = false;
    if (needsEmbedding(profile)) {
        const q = await embedQuery(context);
        if (q) {
            current.embedding = q.embedding;
            current.embeddingModel = q.embeddingModel;
            semanticAvailable = true;
        }
    }

    const libraryCount = await countLibrary();
    const result = await scoreWithProfile(
        current, profile, libraryCount, semanticAvailable, new Map(), buildQueryText(context),
    );

    LOG.info(
        result.precedents.length
            ? `Case ${context.notificationId} · ${profile.label}: `
              + result.precedents.map((p) => `${p.notificationId} ${p.score}/${p.maxScore}`).join(', ')
            : `Case ${context.notificationId} · ${profile.label}: không có tiền lệ — ${result.reason}`,
    );
    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tìm theo từng bước D
// ─────────────────────────────────────────────────────────────────────────────

export interface PerStepPrecedents {
    /**
     * Danh sách hợp nhất của mọi bước, khử trùng lặp và ĐÁNH SỐ MỘT LẦN.
     *
     * ── Vì sao phải hợp nhất thay vì mỗi bước một danh sách riêng ──
     * Trích dẫn `precedents#2` xuất hiện trong prompt, trong luật ràng buộc
     * (`^(team\.|precedents#)`), trong `postProcess`, và trong phần nguồn hiện
     * trên UI. Nếu mỗi bước đánh số theo danh sách của riêng nó thì `precedents#2`
     * ở D1 và ở D4 là hai case khác nhau — một trích dẫn mơ hồ đi qua được mọi
     * lớp kiểm tra hiện có mà không lớp nào bắt được.
     *
     * Nên thứ tự KHÁC nhau giữa các bước được diễn đạt bằng cách khác: mỗi bước
     * nói rõ nó xếp hạng những số nào, theo thứ tự nào, với điểm nào.
     */
    union: Precedent[];
    /** Bước D → kết quả của profile mà bước đó dùng. Luôn đủ tám khoá. */
    byStep: Record<StepCode, PrecedentResult>;
    /** Profile nào phục vụ bước nào — cho log và cho UI. */
    profileByStep: Record<StepCode, string>;
}

/**
 * Hợp nhất tiền lệ của tám bước thành MỘT danh sách đánh số — HÀM THUẦN.
 *
 * ── Vì sao tách hẳn ra ──
 * Cùng lý do với `scoreCase`: đây là chỗ dễ sai nhất và cũng là chỗ cái sai khó
 * thấy nhất. Một case bị đếm hai lần, hay `precedents#1` không phải case mạnh
 * nhất, đều cho ra một prompt trông hoàn toàn bình thường. Hàm thuần thì test
 * được bằng hai object thường, không cần DB.
 *
 * Giữ bản có điểm CAO NHẤT trong các bước đã chấm case đó: cùng một case được
 * hai profile chấm hai điểm khác nhau, và số đi vào danh sách chung phải là số
 * cao nhất — nó trả lời câu "case này giống tới mức nào theo cách đo tốt nhất
 * mà ta có".
 */
export function mergeStepPrecedents(
    byStep: Record<StepCode, PrecedentResult>,
): Precedent[] {
    const best = new Map<string, Precedent>();
    for (const code of STEP_CODES) {
        for (const p of byStep[code]?.precedents ?? []) {
            const seen = best.get(p.notificationId);
            if (!seen || p.score > seen.score) best.set(p.notificationId, p);
        }
    }
    // Sắp theo điểm giảm dần để `precedents#1` là case mạnh nhất trên toàn cục —
    // model đọc danh sách từ trên xuống, và thứ tự đó phải có nghĩa. Chốt bằng mã
    // case để kết quả tất định khi điểm bằng nhau.
    return [...best.values()].sort(
        (a, b) => b.score - a.score || a.notificationId.localeCompare(b.notificationId),
    );
}

/**
 * Kết quả rỗng đủ hình dạng cho cả tám bước.
 *
 * Dùng khi tìm tiền lệ hỏng. Trả về đúng cấu trúc thay vì `null` để người gọi
 * không phải rải kiểm tra null khắp nơi — một chỗ quên là một `TypeError` giữa
 * lượt phân tích, đắt hơn nhiều so với việc viết báo cáo không có tiền lệ.
 */
export function emptyPerStepPrecedents(reason = 'Precedent search failed.'): PerStepPrecedents {
    const blank: PrecedentResult = {
        precedents: [],
        reason,
        maxScore: 0,
        settings: { minScore: 0, topN: 0, closedOnly: true },
        libraryCount: 0,
        candidatesScored: 0,
        semanticUsed: false,
        profileKey: 'default',
        profileLabel: 'Default',
    };
    return {
        union: [],
        byStep: Object.fromEntries(STEP_CODES.map((code) => [code, blank])) as Record<StepCode, PrecedentResult>,
        profileByStep: Object.fromEntries(STEP_CODES.map((code) => [code, 'default'])) as Record<StepCode, string>,
    };
}

/**
 * Chạy tìm tiền lệ cho cả tám bước, mỗi bước theo profile của nó.
 *
 * Ba thứ được chia sẻ để chi phí không nhân lên theo số bước:
 *   nhúng câu truy vấn   một lần cho cả tám bước — cùng một case, cùng một đoạn văn
 *   đếm kho              một lần
 *   tập ứng viên         cache theo hình dạng câu lọc, xem `fetchCandidates`
 *
 * Chấm điểm thì KHÔNG chia sẻ được: đó chính là thứ khác nhau giữa các profile.
 * Nó là hàm thuần trên vài chục dòng nên chạy lại theo từng profile là rẻ.
 */
export async function findPrecedentsByStep(
    context: CaseContext,
    raw?: unknown,
): Promise<PerStepPrecedents> {
    const { profiles, bindings } = await getProfileConfig();
    const byKey = new Map(profiles.map((p) => [p.profileKey, p]));
    const current = toScorable(context, raw);

    const usedKeys = [...new Set(STEP_CODES.map((code) => bindings[code]))];
    const usedProfiles = usedKeys.map((key) => byKey.get(key)).filter(Boolean) as RetrievalProfile[];

    let semanticAvailable = false;
    if (usedProfiles.some(needsEmbedding)) {
        const q = await embedQuery(context);
        if (q) {
            current.embedding = q.embedding;
            current.embeddingModel = q.embeddingModel;
            semanticAvailable = true;
        }
    }

    const libraryCount = await countLibrary();
    const cache = new Map<string, CandidateRow[]>();

    // Tuần tự chứ không `Promise.all`: driver SQLite của CAP chỉ có MỘT connection
    // mỗi tenant, nên chạy song song không nhanh hơn — nó chỉ làm các câu truy vấn
    // xếp hàng bên trong transaction của nhau, và làm cache mất tác dụng vì hai
    // lượt cùng miss trước khi lượt nào kịp ghi.
    const queryText = buildQueryText(context);
    const resultByKey = new Map<string, PrecedentResult>();
    for (const profile of usedProfiles) {
        resultByKey.set(
            profile.profileKey,
            await scoreWithProfile(current, profile, libraryCount, semanticAvailable, cache, queryText),
        );
    }

    const byStep = Object.fromEntries(
        STEP_CODES.map((code) => {
            const key = bindings[code];
            const result = resultByKey.get(key);
            return [code, result ?? resultByKey.get(usedKeys[0])!];
        }),
    ) as Record<StepCode, PrecedentResult>;

    const union = mergeStepPrecedents(byStep);

    const profileByStep = Object.fromEntries(
        STEP_CODES.map((code) => [code, bindings[code]]),
    ) as Record<StepCode, string>;

    LOG.info(
        `Case ${context.notificationId}: ${union.length} tiền lệ hợp nhất từ `
        + `${usedProfiles.length} profile (${usedKeys.join(', ')}) — `
        + STEP_CODES.map((code) => `${code}→${bindings[code]}:${byStep[code].precedents.length}`).join(' '),
    );

    return { union, byStep, profileByStep };
}
