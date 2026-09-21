/**
 * Case đã chấm điểm (chỉ có mã) → `Precedent` đầy đủ.
 *
 * ── Vì sao là một bước riêng ──
 * Cypher cố ý chỉ trả về KHOÁ. Toàn bộ nội dung — mô tả, ngày, chi phí, nhóm,
 * hành động — vẫn nằm ở bảng quan hệ, vì graph mang cấu trúc còn bảng mang nội
 * dung. File này là chỗ hai nửa gặp nhau, và là chỗ duy nhất.
 *
 * ── Vì sao giữ nguyên hình dạng `Precedent` ──
 * `eightDAnalyzer`, `prompts`, `postProcess`, `buildRuntimeSources` và UI đều đọc
 * hình dạng đó. Đổi động cơ mà không đổi hợp đồng nghĩa là quay về engine cũ chỉ
 * tốn một cờ cấu hình, chứ không phải một lần revert.
 *
 * `score` giờ mang nghĩa "số bằng chứng có trọng số" chứ không còn là "điểm trên
 * thang 16", và `breakdown` mang các loại đường đi thay vì các tiêu chí. UI không
 * phải sửa vì nó vốn chỉ in ra hai thứ đó.
 */

import cds from '@sap/cds';
import { TABLE } from './model';
import { explainEvidence, type ScoredCase } from './stepProfiles';
import type { Precedent } from '../precedent/findPrecedents';
import type { CriterionHit } from '../precedent/scoring';

interface CaseRow {
    NOTIFICATIONID: string;
    SYMPTOMSHORTTEXT: string | null;
    SAPSTATUS: string | null;
    COMPLETIONDATE: string | null;
    QUANTITYEXTENT: string | null;
    WORKCENTERID: string | null;
    WORKCENTERDESC: string | null;
    DEFECTCODE: string | null;
    DEFECTTEXT: string | null;
    MATERIALID: string | null;
    MATERIALDESC: string | null;
    ROOTCAUSECATEGORY: string | null;
    COPQEUR: number | null;
    FMEAID: string | null;
}

interface TeamRow {
    NOTIFICATIONID: string;
    PARTNERID: string; PARTNERNAME: string | null; FUNCTIONTITLE: string | null;
    PARTNERROLE: string | null; EMAIL: string | null; PHONE: string | null;
}

interface ActionRow {
    NOTIFICATIONID: string;
    LINENO: number | null; ACTIONTYPE: string | null; ACTIONTEXT: string | null;
    STATUS: string | null; TASKCODE: string | null; TASKCODEGROUP: string | null;
    TASKPROCESSOR: string | null; TIMEEFFORT: number | null; PLANNEDENDDATE: string | null;
}

/** `ScoredCase.evidence` → `breakdown`, để UI cũ hiện được mà không phải sửa. */
function toBreakdown(scored: ScoredCase): CriterionHit[] {
    return scored.evidence.map((e) => ({
        criterionKey: e.kind,
        label: e.kind === 'keywords' ? `${e.count} từ khoá chung` : e.kind,
        level: 'exact' as const,
        matchedOn: e.detail,
        points: e.points,
        // Bằng chứng graph không có trần cố định — nó có bao nhiêu đường thì ăn
        // bấy nhiêu. Báo `maxPoints` bằng `points` để UI hiện "3/3" thay vì bịa
        // ra một mẫu số không tồn tại.
        maxPoints: e.points,
    }));
}

function group<T extends { NOTIFICATIONID: string }>(rows: T[]): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const row of rows) {
        const list = map.get(row.NOTIFICATIONID) ?? [];
        list.push(row);
        map.set(row.NOTIFICATIONID, list);
    }
    return map;
}

/**
 * Nạp nội dung cho các case đã chấm, giữ nguyên thứ tự đã sắp.
 *
 * Ba câu truy vấn cho cả danh sách, không phải ba câu cho mỗi case: tám bước gọi
 * hàm này tám lần, và N+1 ở đây nhân lên rất nhanh.
 */
export async function hydratePrecedents(scored: readonly ScoredCase[]): Promise<Precedent[]> {
    if (!scored.length) return [];

    const db = await cds.connect.to('db');
    const ids = scored.map((s) => s.notificationId);
    const holes = ids.map(() => '?').join(', ');

    const [cases, team, actions] = await Promise.all([
        db.run(
            `SELECT "NOTIFICATIONID", "SYMPTOMSHORTTEXT", "SAPSTATUS",
                    TO_VARCHAR("COMPLETIONDATE", 'YYYY-MM-DD') AS "COMPLETIONDATE",
                    "QUANTITYEXTENT", "WORKCENTERID", "WORKCENTERDESC", "DEFECTCODE",
                    "DEFECTTEXT", "MATERIALID", "MATERIALDESC", "ROOTCAUSECATEGORY",
                    "COPQEUR", "FMEAID"
             FROM "${TABLE.historicalCases}" WHERE "NOTIFICATIONID" IN (${holes})`,
            ids,
        ) as Promise<CaseRow[]>,
        db.run(
            `SELECT h."NOTIFICATIONID", t."PARTNERID", t."PARTNERNAME", t."FUNCTIONTITLE",
                    t."PARTNERROLE", t."EMAIL", t."PHONE"
             FROM "${TABLE.historicalTeam}" t
             JOIN "${TABLE.historicalCases}" h ON h."ID" = t."HISTORICALCASE_ID"
             WHERE h."NOTIFICATIONID" IN (${holes})`,
            ids,
        ) as Promise<TeamRow[]>,
        db.run(
            `SELECT h."NOTIFICATIONID", a."LINENO", a."ACTIONTYPE", a."ACTIONTEXT", a."STATUS",
                    a."TASKCODE", a."TASKCODEGROUP", a."TASKPROCESSOR", a."TIMEEFFORT",
                    TO_VARCHAR(a."PLANNEDENDDATE", 'YYYY-MM-DD') AS "PLANNEDENDDATE"
             FROM "${TABLE.historicalActions}" a
             JOIN "${TABLE.historicalCases}" h ON h."ID" = a."HISTORICALCASE_ID"
             WHERE h."NOTIFICATIONID" IN (${holes})
             ORDER BY a."LINENO"`,
            ids,
        ) as Promise<ActionRow[]>,
    ]);

    const caseById = new Map(cases.map((c) => [c.NOTIFICATIONID, c]));
    const teamById = group(team);
    const actionsById = group(actions);

    // `flatMap` chứ không `map`: một case đã chấm mà không còn trong kho là dữ
    // liệu đã đổi giữa lúc truy vấn và lúc nạp. Bỏ nó đi đúng hơn là trả về một
    // `Precedent` toàn null mà model sẽ trích dẫn như thể nó có thật.
    return scored.flatMap((s) => {
        const row = caseById.get(s.notificationId);
        if (!row) return [];

        return [{
            notificationId: row.NOTIFICATIONID,
            score: s.score,
            maxScore: s.score,
            breakdown: toBreakdown(s),
            explanation: explainEvidence(s),

            symptomShortText: row.SYMPTOMSHORTTEXT,
            sapStatus: row.SAPSTATUS,
            completionDate: row.COMPLETIONDATE,
            quantityExtent: row.QUANTITYEXTENT,
            workCenterId: row.WORKCENTERID,
            workCenterDesc: row.WORKCENTERDESC,
            defectCode: row.DEFECTCODE,
            defectText: row.DEFECTTEXT,
            materialId: row.MATERIALID,
            materialDesc: row.MATERIALDESC,
            rootCauseCategory: row.ROOTCAUSECATEGORY,
            copqEur: row.COPQEUR === null ? null : Number(row.COPQEUR),
            fmeaId: row.FMEAID,

            team: (teamById.get(row.NOTIFICATIONID) ?? []).map((t) => ({
                partnerId: t.PARTNERID,
                partnerName: t.PARTNERNAME,
                functionTitle: t.FUNCTIONTITLE,
                partnerRole: t.PARTNERROLE,
                email: t.EMAIL,
                phone: t.PHONE,
            })),
            actions: (actionsById.get(row.NOTIFICATIONID) ?? []).map((a) => ({
                lineNo: a.LINENO,
                actionType: a.ACTIONTYPE,
                actionText: a.ACTIONTEXT,
                status: a.STATUS,
                taskCode: a.TASKCODE,
                taskCodeGroup: a.TASKCODEGROUP,
                taskProcessor: a.TASKPROCESSOR,
                timeEffort: a.TIMEEFFORT === null ? null : Number(a.TIMEEFFORT),
                plannedEndDate: a.PLANNEDENDDATE,
            })),
        } as Precedent];
    });
}
