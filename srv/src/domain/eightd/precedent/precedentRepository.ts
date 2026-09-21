import cds from '@sap/cds';
import type { Criterion, ScorableCase } from './scoring';

const LOG = cds.log('precedent-repo');

export const HISTORICAL_CASES = 'cnma.proresolve.HistoricalCases';
export const HISTORICAL_TEAM = 'cnma.proresolve.HistoricalTeamMembers';
export const HISTORICAL_ACTIONS = 'cnma.proresolve.HistoricalActions';

/** Trạng thái SAP được coi là "đã đóng" — chỉ những case này mới làm tiền lệ được. */
const CLOSED_STATUSES = ['Completed', 'Closed'];

export interface CandidateRow extends ScorableCase {
    ID: string;
    notificationId: string;
    /** Payload đã làm phẳng, dạng chuỗi. `findPrecedents` parse thành `attributes`. */
    attributesJson: string | null;
    /** Đoạn văn đã ghép lúc nạp kho — tầng re-rank đưa nó cho model đọc. */
    searchText: string | null;
    origin: string | null;
    symptomShortText: string | null;
    sapStatus: string | null;
    completionDate: string | null;
    workCenterDesc: string | null;
    materialDesc: string | null;
    rootCauseCategory: string | null;
    quantityExtent: string | null;
    copqEur: number | null;
    fmeaId: string | null;
}

export interface TeamMemberRow {
    caseId: string;
    notificationId: string;
    partnerId: string;
    partnerName: string;
    functionTitle: string;
    partnerRole: string;
    email: string | null;
    phone: string | null;
}

export interface ActionRow {
    caseId: string;
    notificationId: string;
    lineNo: number;
    actionType: string;
    actionText: string;
    status: string;
}

const CANDIDATE_COLUMNS = [
    'ID', 'notificationId', 'origin', 'symptomShortText', 'sapStatus', 'completionDate',
    'quantityExtent', 'workCenterId', 'workCenterDesc', 'defectCode', 'defectText',
    'defectKeywords', 'materialId', 'materialDesc', 'materialFamily',
    'rootCauseCategory', 'copqEur', 'fmeaId',
    // Vector nặng (~30 KB mỗi dòng). Vẫn phải lấy vì cosine tính trong TS —
    // đây là cái giá của việc chạy được cả trên SQLite lẫn HANA.
    'embedding', 'embeddingModel', 'searchText',
    // Payload đã làm phẳng — nguồn của mọi tiêu chí trỏ vào đường dẫn SAP thay
    // vì một cột. Không lấy thì các tiêu chí đó lặng lẽ ăn 0 điểm.
    'attributesJson',
];

/**
 * Điểm tối đa một case có thể đạt mà KHÔNG trùng khoá nào — tức là phần bộ lọc
 * SQL không nhìn thấy được.
 *
 * Hai nguồn:
 *   trùng từ khoá  HANA có `CONTAINS`, SQLite không. Viết hai nhánh SQL cho một
 *                  bộ lọc là đổi tính đúng đắn lấy tốc độ ở sai chỗ.
 *   ngữ nghĩa      cosine không lọc được bằng `WHERE` ở bất kỳ DB nào. Và đây
 *                  CHÍNH LÀ lý do tiêu chí ngữ nghĩa tồn tại: tìm ra case mà cả
 *                  ba khoá đều khác. Lọc theo khoá trước sẽ loại đúng những case
 *                  nó sinh ra để tìm.
 *
 * Con số này ≥ ngưỡng ⇒ bộ lọc SQL không còn an toàn, phải quét toàn bộ.
 */
const SQL_FILTERABLE_COLUMNS = new Set([
    'workCenterId',
    'defectCode',
    'materialId',
    'materialFamily',
]);

/**
 * Điểm tối đa một case có thể đạt mà KHÔNG trùng khoá nào — tức là phần bộ lọc
 * SQL không nhìn thấy được.
 *
 * Ba nguồn:
 *   trùng từ khoá  HANA có `CONTAINS`, SQLite không.
 *   ngữ nghĩa      cosine không lọc được bằng `WHERE` ở bất kỳ DB nào.
 *   đường dẫn SAP  nằm trong `attributesJson`, không có cột riêng trong bảng.
 *
 * Con số này ≥ ngưỡng ⇒ bộ lọc SQL không còn an toàn, phải quét toàn bộ.
 */
function nonFilterableReach(criteria: readonly Criterion[]): number {
    return criteria
        .filter((c) => c.enabled)
        .reduce((sum, c) => {
            if ((c.matchType || 'exact') === 'cosine') return sum + (Number(c.weight) || 0);
            // Re-rank chấm bằng model ở tầng 2 — WHERE không nhìn thấy được, y
            // như cosine. Bỏ nhánh này thì bộ lọc SQL loại oan đúng những case
            // chỉ thắng nhờ re-rank.
            if ((c.matchType || 'exact') === 'rerank') return sum + (Number(c.weight) || 0);
            if (c.fallbackMatch === 'keyword') return sum + (Number(c.fallbackWeight) || 0);
            if (c.sourceField && !SQL_FILTERABLE_COLUMNS.has(c.sourceField)) return sum + (Number(c.weight) || 0);
            return sum;
        }, 0);
}

/**
 * Lấy tập ứng viên có khả năng ăn điểm — SQL chỉ LỌC, không chấm.
 *
 * ── Vì sao lọc trước ──
 * Đúng nguyên tắc "lọc chính xác TRƯỚC" trong `docs/8d-vector-search-design.md`.
 * Trên kho thật, câu OR dưới đây dùng index và cắt hàng trăm nghìn dòng xuống
 * vài chục; điểm tính trong TS trên tập đó.
 *
 * ── Vì sao có nhánh quét toàn bộ ──
 * Bộ lọc chỉ hợp lệ khi một case KHÔNG trùng khoá nào thì chắc chắn dưới ngưỡng.
 * Điều đó phụ thuộc cấu hình: admin nâng trọng số "trùng từ khoá" lên bằng hoặc
 * hơn ngưỡng là bộ lọc bắt đầu bỏ sót tiền lệ hợp lệ — âm thầm, không báo gì.
 * Nên kiểm chính điều kiện đó và quét toàn bộ khi nó không còn đúng.
 */
export async function fetchCandidates(
    current: ScorableCase,
    criteria: readonly Criterion[],
    opts: { closedOnly: boolean; minScore: number },
    cache?: Map<string, CandidateRow[]>,
): Promise<CandidateRow[]> {
    const db = await cds.connect.to('db');

    let q = SELECT.from(HISTORICAL_CASES).columns(...CANDIDATE_COLUMNS);

    // Case đang xử lý luôn tự khớp tuyệt đối — loại là luật đúng/sai, không phải tuỳ chọn.
    q = q.where({ notificationId: { '<>': current.notificationId } });
    if (opts.closedOnly) q = q.and({ sapStatus: { in: CLOSED_STATUSES } });

    const run = async (key: string, build: () => any): Promise<CandidateRow[]> => {
        const hit = cache?.get(key);
        if (hit) return hit;
        const rows = (await db.run(build())) as CandidateRow[];
        cache?.set(key, rows);
        return rows;
    };

    const reach = nonFilterableReach(criteria);
    if (reach >= opts.minScore) {
        // Trường hợp BÌNH THƯỜNG khi tiêu chí ngữ nghĩa đang bật, không phải sự cố.
        LOG.info(
            `Điểm đạt được không cần trùng khoá là ${reach} ≥ ngưỡng ${opts.minScore} `
            + '— quét toàn bộ kho thay vì lọc trước, để không bỏ sót case chỉ giống về ngữ nghĩa.',
        );
        return run(`all:${opts.closedOnly}`, () => q);
    }

    // Mỗi cột khớp-bằng của tiêu chí đang bật thành một vế OR. `materialFamily`
    // phải có mặt: trùng từ khoá (+2) cộng cùng họ vật tư (+1) là vừa đúng
    // ngưỡng 3, và vế đó chỉ vào được qua cột này.
    const orFields = new Set<string>();
    for (const c of criteria) {
        if (!c.enabled) continue;
        if (c.matchType !== 'keyword' && c.sourceField && SQL_FILTERABLE_COLUMNS.has(c.sourceField)) {
            orFields.add(c.sourceField);
        }
        if (c.fallbackMatch === 'family' && c.fallbackField && SQL_FILTERABLE_COLUMNS.has(c.fallbackField)) {
            orFields.add(c.fallbackField);
        }
    }

    const orTerms = [...orFields]
        .map((field) => ({ field, value: (current as unknown as Record<string, any>)[field] }))
        .filter((t) => t.value != null && String(t.value).trim() !== '');

    if (!orTerms.length) return [];

    const tokens: any[] = ['('];
    orTerms.forEach((t, i) => {
        if (i) tokens.push('or');
        tokens.push({ ref: [t.field] }, '=', { val: t.value });
    });
    tokens.push(')');

    q = q.and(tokens);

    const key = `or:${opts.closedOnly}:${orTerms.map((t) => `${t.field}=${t.value}`).sort().join('|')}`;
    return run(key, () => q);
}

/** Thành viên nhóm 8D của các case đã trúng. Rỗng khi `caseIds` rỗng. */
export async function fetchTeamMembers(caseIds: string[]): Promise<TeamMemberRow[]> {
    if (!caseIds.length) return [];
    const db = await cds.connect.to('db');

    const rows = await db.run(
        SELECT.from(HISTORICAL_TEAM)
            .columns(
                'historicalCase_ID as caseId',
                'partnerId', 'partnerName', 'functionTitle', 'partnerRole', 'email', 'phone',
            )
            .where({ historicalCase_ID: { in: caseIds } }),
    );

    return rows as TeamMemberRow[];
}

/** Hành động của các case đã trúng — D3/D5/D7 sẽ dùng. */
export async function fetchActions(caseIds: string[]): Promise<ActionRow[]> {
    if (!caseIds.length) return [];
    const db = await cds.connect.to('db');

    const rows = await db.run(
        SELECT.from(HISTORICAL_ACTIONS)
            .columns('historicalCase_ID as caseId', 'lineNo', 'actionType', 'actionText', 'status')
            .where({ historicalCase_ID: { in: caseIds } })
            .orderBy('lineNo'),
    );

    return rows as ActionRow[];
}

/** Số case đang có trong kho — dùng để phân biệt "chưa nạp kho" với "không có tiền lệ". */
export async function countLibrary(): Promise<number> {
    const db = await cds.connect.to('db');
    const rows = await db.run(SELECT.from(HISTORICAL_CASES).columns('ID'));
    return rows.length;
}
