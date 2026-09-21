/**
 * Các phép dò bằng chứng trên graph — mỗi hàm trả lời MỘT câu hỏi cụ thể.
 *
 * ── Vì sao là probe chứ không phải tám câu truy vấn viết tay ──
 * Bản phác đầu là mỗi bước D một câu SQL riêng. Nhìn kỹ thì tám câu đó chồng lấn
 * gần hết: D1, D3, D5, D7 đều bắt đầu bằng "case nào chạm cùng work center / họ
 * vật tư / từ khoá", và chỉ khác nhau ở chỗ **cân bao nhiêu** cho mỗi loại chạm
 * và **lọc hành động loại gì** sau đó. Viết tám bản chép của cùng một phép nối là
 * tám chỗ phải sửa khi mô hình đổi, và bảy chỗ sẽ bị quên.
 *
 * Nên tách thành: probe trả về bằng chứng THÔ (`case X chạm anchor qua Y`), còn
 * bước D quyết định cân nặng và ngưỡng. Trọng số trở thành dữ liệu — đúng quyết
 * định "Cypher trong code, admin chỉnh tham số" — và đường bằng chứng hiện ra
 * miễn phí, vì mỗi dòng probe CHÍNH LÀ một chặng của đường đó.
 *
 * ── Phân vai giữa Cypher và SQL ──
 * Phương ngữ openCypher của HANA không có hàm tổng hợp nào (xem `graphClient`).
 * Nên Cypher khớp mẫu và trả về từng cặp thô; SQL đếm và gom nhóm. Ranh giới đó
 * lộ rõ trong từng hàm dưới đây và là cố ý.
 */

import { EDGE, NODE, TABLE, CLOSED_STATUSES } from './model';
import { runGraphQuery } from './graphClient';
import { keywordPredicate, type GraphAnchor } from './anchor';

/** Một chặng bằng chứng: case nào, chạm anchor bằng cách gì, bao nhiêu lần. */
export interface EvidenceHit {
    notificationId: string;
    /** Khoá ổn định của loại bằng chứng — bước D tra trọng số theo cột này. */
    kind: EvidenceKind;
    /** Giá trị đã chạm: mã work center, tên họ vật tư, danh sách từ khoá chung. */
    detail: string;
    /** Số lần chạm. Chỉ > 1 với từ khoá — đó chính là thứ chữa R3(a). */
    count: number;
}

export type EvidenceKind =
    | 'workCenter'
    | 'material'
    | 'materialFamily'
    | 'defectCode'
    | 'keywords'
    | 'containment'
    | 'corrective'
    | 'preventive'
    /**
     * Không đến từ graph — đến từ tầng 2 (`precedent/reranker.ts`) đọc cả hai
     * đoạn văn. Nằm chung kiểu này để nó đi đúng một đường với mọi bằng chứng
     * khác: cùng chấm điểm, cùng vào đường bằng chứng, cùng hiện trên UI.
     */
    | 'rerank';

const CLOSED_LIST = CLOSED_STATUSES.map(() => '?').join(', ');

/**
 * Chỉ case đã đóng mới được làm tiền lệ, và case đang mở luôn bị loại.
 *
 * Cả hai là luật đúng/sai chứ không phải tuỳ chọn: case đang mở tự khớp tuyệt
 * đối với chính nó, và một case chưa đóng thì chưa có bài học nào để cho mượn.
 */
function closedOnlyJoin(alias: string, keyColumn: string): string {
    return `JOIN "${TABLE.historicalCases}" h ON h."NOTIFICATIONID" = ${alias}."${keyColumn}"`
        + ` AND h."SAPSTATUS" IN (${CLOSED_LIST})`;
}

/**
 * Case nào cùng chạm một đỉnh với anchor, qua một loại cạnh cho trước.
 *
 * Đây là hình chữ V — `(anchor value) ← case`, diễn đạt bằng mẫu ngăn dấu phẩy
 * vì HANA không nhận mũi tên ngược `<-[e]-`.
 */
async function touchesNode(
    anchor: GraphAnchor,
    kind: EvidenceKind,
    nodeLabel: string,
    edgeType: string,
    value: string | null,
): Promise<EvidenceHit[]> {
    if (!value) return [];

    const rows = await runGraphQuery<{ NID: string }>({
        cypher:
            `MATCH (c:${NODE.case})-[e:${edgeType}]->(n:${nodeLabel}) `
            + `WHERE n.BIZ_KEY = $value AND c.BIZ_KEY <> $self `
            + 'RETURN DISTINCT c.BIZ_KEY AS NID',
        params: { value, self: anchor.notificationId },
        wrap: (graph) =>
            `SELECT g."NID" AS "NID" FROM ${graph} ${closedOnlyJoin('g', 'NID')}`,
        wrapParams: CLOSED_STATUSES,
    });

    return rows.map((r) => ({ notificationId: r.NID, kind, detail: value, count: 1 }));
}

export const sameWorkCenter = (a: GraphAnchor) =>
    touchesNode(a, 'workCenter', NODE.workCenter, EDGE.occurredAt, a.workCenterId);

export const sameMaterial = (a: GraphAnchor) =>
    touchesNode(a, 'material', NODE.material, EDGE.onMaterial, a.materialId);

export const sameDefectCode = (a: GraphAnchor) =>
    touchesNode(a, 'defectCode', NODE.defectCode, EDGE.hasDefect, a.defectCode);

/**
 * Cùng HỌ vật tư — hai chặng: `Case → Material → MaterialFamily`.
 *
 * Không gộp được vào `touchesNode` vì nó đi qua hai cạnh, và HANA không nhận
 * chuỗi `(a)-[e1]->(b)-[e2]->(c)` trong một mẫu. Diễn đạt bằng hai mẫu ngăn dấu
 * phẩy nối nhau qua biến `f`.
 */
export async function sameMaterialFamily(anchor: GraphAnchor): Promise<EvidenceHit[]> {
    if (!anchor.materialFamily) return [];

    const rows = await runGraphQuery<{ NID: string }>({
        cypher:
            `MATCH (c:${NODE.case})-[e1:${EDGE.onMaterial}]->(m:${NODE.material}), `
            + `(m)-[e2:${EDGE.inFamily}]->(f:${NODE.materialFamily}) `
            + 'WHERE f.BIZ_KEY = $family AND c.BIZ_KEY <> $self '
            + 'RETURN DISTINCT c.BIZ_KEY AS NID',
        params: { family: anchor.materialFamily, self: anchor.notificationId },
        wrap: (graph) => `SELECT g."NID" AS "NID" FROM ${graph} ${closedOnlyJoin('g', 'NID')}`,
        wrapParams: CLOSED_STATUSES,
    });

    return rows.map((r) => ({
        notificationId: r.NID, kind: 'materialFamily', detail: anchor.materialFamily!, count: 1,
    }));
}

/**
 * Bao nhiêu TỪ KHOÁ chung, và là những từ nào.
 *
 * ── Đây là hàm chữa R3 ──
 * Engine cũ hỏi "có trùng từ nào không" và trả lời bằng có/không, nên
 * *"Flange edge burr above limit"* khớp *"Chatter marks … on milled flange"*
 * qua đúng một chữ `flange` và ăn trọn điểm — bằng với một case khớp thật sự.
 * Ở đây `COUNT(DISTINCT)` biến câu hỏi thành "trùng BAO NHIÊU từ", và trên chính
 * dữ liệu đó nó xếp `8D-10049030` (burr, edge, limit) trên `8D-10049010` (flange).
 *
 * Phép đếm nằm ở SQL vì openCypher của HANA không có hàm tổng hợp. `STRING_AGG`
 * giữ lại chính những từ đã khớp — không có nó thì con số 3 không giải thích được
 * cho ai cả, và cột đó là thứ đi thẳng vào đường bằng chứng người đọc nhìn thấy.
 */
export async function sharedKeywords(anchor: GraphAnchor): Promise<EvidenceHit[]> {
    const predicate = keywordPredicate(anchor.keywords);
    if (!predicate) return [];

    const rows = await runGraphQuery<{ NID: string; SHARED: number; TOKENS: string }>({
        cypher:
            `MATCH (c:${NODE.case})-[e:${EDGE.mentions}]->(k:${NODE.keyword}) `
            + `WHERE ${predicate.predicate} AND c.BIZ_KEY <> $self `
            + 'RETURN DISTINCT c.BIZ_KEY AS NID, k.BIZ_KEY AS TOKEN',
        params: { ...predicate.params, self: anchor.notificationId },
        wrap: (graph) =>
            'SELECT g."NID" AS "NID", COUNT(DISTINCT g."TOKEN") AS "SHARED", '
            + `STRING_AGG(g."TOKEN", ', ' ORDER BY g."TOKEN") AS "TOKENS" `
            + `FROM ${graph} ${closedOnlyJoin('g', 'NID')} `
            + 'GROUP BY g."NID"',
        wrapParams: CLOSED_STATUSES,
    });

    return rows.map((r) => ({
        notificationId: r.NID,
        kind: 'keywords',
        detail: r.TOKENS,
        count: Number(r.SHARED) || 0,
    }));
}

/**
 * Case nào đã được xử lý bằng một loại hành động, và bằng mã nhiệm vụ nào.
 *
 * D3 hỏi loại `Containment`, D5 hỏi `Corrective`, D7 hỏi `Preventive`. Ba bước,
 * một hàm, một tham số — vì câu hỏi của chúng khác nhau đúng ở chỗ đó.
 *
 * Đường đi: `Case → Action → TaskCode`, lại là hai cạnh nên lại là hai mẫu ngăn
 * dấu phẩy. `ACTION_TYPE` đọc từ THUỘC TÍNH CỦA CẠNH `RESOLVED_BY` chứ không từ
 * đỉnh `Action` — cùng một giá trị, nhưng lọc trên cạnh cắt nhánh sớm hơn một bậc.
 */
export async function resolvedByActionType(
    anchor: GraphAnchor,
    actionType: 'Containment' | 'Corrective' | 'Preventive',
    kind: EvidenceKind,
    candidates: readonly string[],
): Promise<EvidenceHit[]> {
    if (!candidates.length) return [];

    const rows = await runGraphQuery<{ NID: string; CODES: string; N: number }>({
        cypher:
            `MATCH (c:${NODE.case})-[e1:${EDGE.resolvedBy}]->(a:${NODE.action}), `
            + `(a)-[e2:${EDGE.codedAs}]->(t:${NODE.taskCode}) `
            + 'WHERE e1.ACTION_TYPE = $actionType AND c.BIZ_KEY <> $self '
            + 'RETURN DISTINCT c.BIZ_KEY AS NID, t.BIZ_KEY AS TASK_CODE',
        params: { actionType, self: anchor.notificationId },
        wrap: (graph) =>
            'SELECT g."NID" AS "NID", COUNT(DISTINCT g."TASK_CODE") AS "N", '
            + `STRING_AGG(g."TASK_CODE", ', ' ORDER BY g."TASK_CODE") AS "CODES" `
            + `FROM ${graph} `
            + `WHERE g."NID" IN (${candidates.map(() => '?').join(', ')}) `
            + 'GROUP BY g."NID"',
        wrapParams: candidates,
    });

    return rows.map((r) => ({
        notificationId: r.NID, kind, detail: r.CODES, count: Number(r.N) || 0,
    }));
}
