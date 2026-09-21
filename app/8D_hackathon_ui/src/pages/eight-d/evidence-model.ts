import {
    parseFinding,
    parseList,
    parseStoredPrecedents,
    type Discipline8D,
    type Report8D,
} from '@/services/eightd-service';
import { resolveEvidencePath } from '../../../../../shared/evidence-path';

/**
 * Chỉ mục bằng chứng của một case — gom `sources` của cả tám discipline lại.
 *
 * ── Gốc để giải đường dẫn KHÔNG phải chỉ là CaseContext ──
 * `buildSourceVocabulary` ở backend giải trên BỐN nhánh:
 *
 *     { ...caseContext, enrichment, independent, precedents }
 *
 * Bỏ ba nhánh sau đi thì mọi trích dẫn `precedents#1`, `independent.finding…`
 * đều báo "không tồn tại" — trong khi `postProcess` đã LỌC BỎ mọi đường dẫn
 * không giải được trước khi lưu. Nói cách khác: path còn nằm trong `sources`
 * thì chắc chắn giải được, và một màn hình báo lỗi ở đó đang tự tố cáo resolver
 * của chính nó chứ không tố cáo dữ liệu.
 *
 * ── Vì sao gom theo PATH chứ không theo discipline ──
 * Cùng một bản ghi thường được nhiều bước trích. Liệt kê lại ở mỗi bước thì
 * người đọc đếm nhầm số bằng chứng thật có, và không nhìn ra hai kết luận đang
 * tựa vào CÙNG một dữ kiện — thứ đáng ngờ nhất trong một báo cáo 8D.
 */

/** Ba trạng thái, không phải hai: giải được, không có sẵn, và hỏng thật. */
export type FactState = 'resolved' | 'unavailable' | 'broken';

export interface EvidenceFact {
    /** Đường dẫn nguyên văn, ví dụ `inspections#1`. Đây là khoá. */
    path: string;
    state: FactState;
    /** Chỉ có nghĩa khi `state === 'resolved'`. */
    value?: unknown;
    /** Câu giải thích khi không hiện được giá trị. */
    reason?: string;
    /** Mã các discipline đã trích dẫn đường dẫn này, theo thứ tự D1…D8. */
    citedBy: string[];
}

export interface EvidenceGroup {
    code: string;
    title: string;
    /** false = không có dữ liệu nguồn, AI suy ra. */
    dataBacked: boolean;
    confidence: number;
    facts: EvidenceFact[];
}

export interface EvidenceIndex {
    groups: EvidenceGroup[];
    /** Đã khử trùng theo `path`, giữ thứ tự xuất hiện đầu tiên. */
    facts: EvidenceFact[];
    resolvedCount: number;
    /** Lỗi đọc snapshot. Khác rỗng nghĩa là MỌI fact đều không giải được. */
    parseError: string | null;
}

function parseJson(raw: unknown): { value: unknown; error: string | null } {
    if (raw == null) return { value: null, error: null };
    if (typeof raw === 'object') return { value: raw, error: null };
    try {
        return { value: JSON.parse(String(raw)), error: null };
    } catch (e) {
        return { value: null, error: (e as Error)?.message ?? 'not valid JSON' };
    }
}

/**
 * Dựng lại đúng gốc mà backend đã dùng để duyệt `sources`.
 *
 * `enrichment` KHÔNG được lưu cùng report — nó là output trung gian của bước làm
 * giàu bối cảnh và biến mất sau khi phân tích xong. Nên trích dẫn vào nhánh đó
 * không phải trích dẫn sai; nó chỉ không xem lại được. Hai chuyện đó phải hiện
 * khác nhau, nếu không người đọc sẽ tưởng AI bịa.
 */
function buildRoot(report: Report8D): { root: Record<string, unknown>; error: string | null } {
    const ctx = parseJson(report.caseContext);
    if (ctx.error) return { root: {}, error: ctx.error };

    const stored = parseStoredPrecedents(report.precedentsJson);
    const finding = parseFinding(report.aiFinding);

    return {
        root: {
            ...(ctx.value && typeof ctx.value === 'object' ? (ctx.value as Record<string, unknown>) : {}),
            precedents: stored?.precedents ?? [],
            independent: finding ?? null,
        },
        error: null,
    };
}

export function buildEvidenceIndex(
    disciplines: Discipline8D[],
    report: Report8D,
): EvidenceIndex {
    const { root, error } = buildRoot(report);

    // Map giữ thứ tự chèn, nên fact xuất hiện theo trình tự D1→D8 — trùng với
    // trình tự người đọc đi qua báo cáo.
    const byPath = new Map<string, EvidenceFact>();
    const ordered = [...disciplines].sort((a, b) => a.sequence - b.sequence);

    const groups: EvidenceGroup[] = ordered.map((discipline) => {
        const facts: EvidenceFact[] = [];

        for (const path of parseList(discipline.sources)) {
            let fact = byPath.get(path);
            if (!fact) {
                fact = resolveFact(path, root, error);
                byPath.set(path, fact);
            }
            if (!fact.citedBy.includes(discipline.code)) fact.citedBy.push(discipline.code);
            if (!facts.includes(fact)) facts.push(fact);
        }

        return {
            code: discipline.code,
            title: discipline.title,
            dataBacked: discipline.dataBacked,
            confidence: discipline.confidence,
            facts,
        };
    });

    const facts = [...byPath.values()];

    return {
        groups,
        facts,
        resolvedCount: facts.filter((f) => f.state === 'resolved').length,
        parseError: error,
    };
}

function resolveFact(
    path: string,
    root: Record<string, unknown>,
    snapshotError: string | null,
): EvidenceFact {
    if (snapshotError) {
        return {
            path,
            state: 'broken',
            reason: `The case snapshot could not be read (${snapshotError}).`,
            citedBy: [],
        };
    }

    if (path.startsWith('enrichment')) {
        return {
            path,
            state: 'unavailable',
            reason: 'Worked out during analysis and not kept with the report, so it cannot be shown here.',
            citedBy: [],
        };
    }

    const resolved = resolveEvidencePath(root, path);
    if (resolved.found) {
        return { path, state: 'resolved', value: resolved.value, citedBy: [] };
    }

    return { path, state: 'broken', reason: resolved.reason, citedBy: [] };
}
