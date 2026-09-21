/**
 * Từ vựng của graph — nhãn đỉnh, loại cạnh, tiền tố khoá.
 *
 * ── Vì sao một file hằng số riêng ──
 * Cùng một chuỗi `'Case8D'` xuất hiện ở ba nơi độc lập: định nghĩa view trong
 * `db/src/*.hdbview`, câu Cypher trong `queries/`, và test. Gõ lại ở mỗi nơi thì
 * gõ sai một chỗ không hỏng build, không hỏng deploy, và không ném lỗi — câu
 * truy vấn chỉ đơn giản trả về 0 dòng, đúng như khi thật sự không có tiền lệ.
 * Đó là kiểu sai đắt nhất trong file này, nên nó bị chặn bằng cách chỉ có MỘT
 * nơi khai.
 *
 * File này KHÔNG import gì từ CAP. Nó là dữ liệu thuần, để test đọc được mà
 * không cần dựng DB.
 */

/** Tên graph workspace, khai trong `db/src/GW_8D.hdbgraphworkspace`. */
export const WORKSPACE = 'GW_8D';

/**
 * Nhãn đỉnh.
 *
 * ── Vì sao `Case8D` chứ không `Case`, `JobFunction` chứ không `Function` ──
 * `CASE` là từ khoá của openCypher (`CASE … WHEN … END`). `MATCH (c:Case)` không
 * parse được, và thông báo lỗi — *"expecting identifier near Case"* — không hề
 * gợi ý rằng vấn đề là từ khoá. Đã mất một vòng deploy để tìm ra. `Function`
 * chưa gây lỗi nhưng nằm sát danh sách từ khoá của mọi phương ngữ SQL/Cypher,
 * nên đổi luôn thay vì chờ nó nổ.
 */
export const NODE = {
    case: 'Case8D',
    openDefect: 'OpenDefect',
    workCenter: 'WorkCenter',
    defectCode: 'DefectCode',
    material: 'Material',
    materialFamily: 'MaterialFamily',
    keyword: 'Keyword',
    person: 'Person',
    jobFunction: 'JobFunction',
    action: 'Action',
    taskCode: 'TaskCode',
    rootCause: 'RootCause',
    fmea: 'Fmea',
    inspectionLot: 'InspectionLot',
} as const;

/** Loại cạnh. Mỗi loại nối ĐÚNG một cặp nhãn — HANA bắt khai cả hai đầu. */
export const EDGE = {
    occurredAt: 'OCCURRED_AT',
    hasDefect: 'HAS_DEFECT',
    onMaterial: 'ON_MATERIAL',
    inFamily: 'IN_FAMILY',
    mentions: 'MENTIONS',
    staffedBy: 'STAFFED_BY',
    actsAs: 'ACTS_AS',
    resolvedBy: 'RESOLVED_BY',
    codedAs: 'CODED_AS',
    causedBy: 'CAUSED_BY',
    referencesFmea: 'REFERENCES_FMEA',
    coversWorkCenter: 'COVERS_WORKCENTER',
    coversMaterial: 'COVERS_MATERIAL',
    lotOfMaterial: 'LOT_OF_MATERIAL',
    lotAt: 'LOT_AT',
    defectAt: 'DEFECT_AT',
    defectOnMaterial: 'DEFECT_ON_MATERIAL',
    defectHasCode: 'DEFECT_HAS_CODE',
} as const;

/**
 * Bảng quan hệ mà kết quả Cypher join ngược về.
 *
 * Cypher chỉ trả KHOÁ. Toàn bộ nội dung — mô tả, ngày, chi phí, payload — vẫn
 * nằm ở bảng thật, và đó là chủ ý: graph mang cấu trúc, bảng mang nội dung.
 */
export const TABLE = {
    historicalCases: 'CNMA_PRORESOLVE_HISTORICALCASES',
    historicalTeam: 'CNMA_PRORESOLVE_HISTORICALTEAMMEMBERS',
    historicalActions: 'CNMA_PRORESOLVE_HISTORICALACTIONS',
} as const;

/** Trạng thái SAP được coi là đã đóng — chỉ case đóng mới được làm tiền lệ. */
export const CLOSED_STATUSES = ['Closed', 'Completed'] as const;

export type NodeLabel = (typeof NODE)[keyof typeof NODE];
export type EdgeType = (typeof EDGE)[keyof typeof EDGE];
