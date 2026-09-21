/**
 * Kiểm tra chất lượng dữ liệu của một Golden Dataset.
 *
 * ── Đổi vai trò: từ CỔNG CHẶN sang BÁO CÁO CHẤT LƯỢNG ──
 * Bản đầu coi cả 13 ràng buộc trong `integrity.constraints` là điều kiện bắt
 * buộc. Chạy thử trên bộ `mock-data/dirty/` — mô phỏng dữ liệu SAP QM thật —
 * thì cả 12 case đều bị chặn:
 *
 *     ISHIKAWA-6-ROWS       19 lần
 *     TEAM-SIZE-MATCH        7
 *     ACTION-TYPE-COVERAGE   7
 *     FIVE-WHY-RANGE         6
 *     PK-UNIQUE              2
 *     TEAM-ONE-LEADER        2
 *
 * Nhìn kỹ thì hầu hết không phải lỗi dữ liệu. "Đúng 6 dòng Ishikawa" là quy ước
 * của bộ Golden Dataset, không phải quy luật của SAP: kỹ sư chỉ ghi lại nhánh
 * nào họ thực sự đi kiểm tra. `team_size` là ô gõ tay nên gần như không bao giờ
 * khớp. Case đang mở thì đương nhiên chưa đủ ba loại action.
 *
 * Từ chối phân tích những case đó là từ chối đúng những case cần giúp nhất.
 *
 * Nên bây giờ chỉ CHẶN khi payload không phải một case (thiếu `data`, không có
 * dòng notifications, nhiều case trong một file). Mọi thứ khác thành **cảnh báo
 * chất lượng** — chúng chảy vào `CaseContext.gaps` và được gửi thẳng cho model,
 * để nó biết chỗ nào dữ liệu mỏng mà hạ độ tự tin cho đúng.
 *
 * Bản TypeScript này soi gương `validate_clean()` trong `mock-data/generate.py`.
 * Khác biệt có chủ đích: bên Python vẫn chặn tất cả, vì nó gác cho bộ `clean/`.
 */

import {
    ISHIKAWA_CATEGORIES,
    ORIGIN_CUSTOMER,
    originAllowsInspectionLot,
} from './types';
import { extractDeepCase } from './caseMapper';

export interface ValidationIssue {
    constraintId: string;
    message: string;
    /** true = chặn pipeline. Chỉ dành cho "đây không phải một case". */
    blocking: boolean;
}

const CLOSED_STATUSES = new Set(['Completed', 'Closed']);

/** Chuỗi 'N/A - ...' là giá trị có chủ đích, không phải thiếu dữ liệu. */
const NA_PATTERN = /^N\/A\b/i;

export function isDeliberateNA(value: unknown): boolean {
    return typeof value === 'string' && NA_PATTERN.test(value.trim());
}

/**
 * Cờ nguyên nhân gốc, chấp nhận các cách đánh dấu mà người dùng thật hay gõ.
 *
 * Golden Dataset quy định 'Y', nhưng dữ liệu thật có 'x', 'X', 'ja', '✓'…
 * Hiểu hẹp chỉ mỗi 'Y' thì mất luôn nguyên nhân gốc của những case đó.
 */
export function isRootCauseFlag(value: unknown): boolean {
    const s = String(value ?? '').trim().toLowerCase();
    return s === 'y' || s === 'x' || s === 'ja' || s === 'yes' || s === '✓';
}

type Row = Record<string, any>;

function rows(data: Row, key: string): Row[] {
    const v = data?.[key];
    return Array.isArray(v) ? v : [];
}

/**
 * @param raw Dataset đã JSON.parse
 * @returns Danh sách vấn đề. `blocking` chỉ true khi payload không dùng được.
 */
export function validateDataset(raw: any): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const fatal = (constraintId: string, message: string) =>
        issues.push({ constraintId, message, blocking: true });
    const quality = (constraintId: string, message: string) =>
        issues.push({ constraintId, message, blocking: false });

    // ── Chặn: không phải một case ────────────────────────────────────────────
    if (!raw || typeof raw !== 'object') {
        fatal('SHAPE', 'Payload không phải object JSON.');
        return issues;
    }

    const data = extractDeepCase(raw);
    if (!data || typeof data !== 'object') {
        fatal('SHAPE', 'Payload không đúng cấu trúc case 8D (Deep Structure JSON hoặc Golden Dataset).');
        return issues;
    }

    const notifications = rows(data, 'notifications');
    if (notifications.length === 0) {
        fatal('SHAPE', 'Không tìm thấy thông tin case notification — không xác định được case.');
        return issues;
    }
    if (notifications.length > 1) {
        fatal('SHAPE', `Cần đúng 1 case mỗi file, đang có ${notifications.length}.`);
        return issues;
    }

    const note = notifications[0];
    const nid = note.notification_id;
    if (!nid) {
        fatal('SHAPE', 'Case notification thiếu notification_id — không có khoá định danh.');
        return issues;
    }

    const origin = note.origin;

    // ── Từ đây trở xuống: cảnh báo chất lượng, KHÔNG chặn ────────────────────

    // PK trùng — thường do nhập hai lần, model vẫn đọc được.
    const pkSpec: Array<[string, string[]]> = [
        ['inspections', ['notification_id', 'characteristic']],
        ['causes_ishikawa', ['notification_id', 'category']],
        ['actions', ['notification_id', 'line_no']],
        ['five_why_chain', ['notification_id', 'step_no']],
        ['team_assignments', ['notification_id', 'partner_id']],
    ];
    for (const [entity, keys] of pkSpec) {
        const list = rows(data, entity);
        const seen = list.map((r) => keys.map((k) => r[k]).join('||'));
        if (new Set(seen).size !== seen.length) {
            quality('PK-UNIQUE', `${entity}: có dòng trùng lặp (${keys.join(' + ')}).`);
        }
    }

    // FK — so sánh sau khi trim, vì ID hay dính khoảng trắng khi qua Excel.
    const norm = (v: unknown) => String(v ?? '').trim().toUpperCase();
    const fkSpec: Array<[string, string, string]> = [
        ['material_id', 'materials', 'material_id'],
        ['batch_id', 'batches', 'batch_id'],
        ['defect_code', 'defect_catalog', 'defect_code'],
        ['work_center_id', 'work_centers', 'work_center_id'],
    ];
    for (const [field, target, targetKey] of fkSpec) {
        const pool = new Set(rows(data, target).map((r) => norm(r[targetKey])));
        if (note[field] != null && !pool.has(norm(note[field]))) {
            quality('FK-EXISTS', `notifications.${field} = '${note[field]}' không có trong ${target}.`);
        }
    }

    const batch = rows(data, 'batches').find((b) => norm(b.batch_id) === norm(note.batch_id));
    if (batch && norm(batch.material_id) !== norm(note.material_id)) {
        quality(
            'BATCH-MATERIAL-MATCH',
            `batch ${batch.batch_id} thuộc material ${batch.material_id} nhưng notification ghi ${note.material_id}.`,
        );
    }

    // Ishikawa — thiếu nhánh là chuyện bình thường ngoài đời, không phải lỗi.
    const ishikawa = rows(data, 'causes_ishikawa');
    if (ishikawa.length === 0) {
        quality('ISHIKAWA-COVERAGE', 'Không có dòng điều tra Ishikawa nào — D4 không có bằng chứng để dựa.');
    } else {
        const cats = ishikawa.map((r) => r.category);
        const missing = ISHIKAWA_CATEGORIES.filter((c) => !cats.includes(c));
        if (missing.length) {
            quality(
                'ISHIKAWA-COVERAGE',
                `Chỉ ${cats.length}/6 nhánh Ishikawa được điều tra. Chưa có: ${missing.join(', ')}.`,
            );
        }
    }
    const roots = ishikawa.filter((r) => isRootCauseFlag(r.is_root_cause));
    if (roots.length === 0) {
        quality('ROOT-CAUSE-FLAG', 'Không nhánh nào được đánh dấu là nguyên nhân gốc.');
    } else if (roots.length > 1) {
        quality(
            'ROOT-CAUSE-FLAG',
            `${roots.length} nhánh cùng được đánh dấu nguyên nhân gốc: ${roots.map((r) => r.category).join(', ')}.`,
        );
    }

    // 5-Why — chuỗi cụt hoặc rỗng rất hay gặp.
    const fiveWhy = [...rows(data, 'five_why_chain')].sort((a, b) => a.step_no - b.step_no);
    if (fiveWhy.length === 0) {
        quality('FIVE-WHY-DEPTH', 'Không có chuỗi 5-Why — D4 không có lập luận nhân quả nào được ghi lại.');
    } else if (fiveWhy.length < 2) {
        quality('FIVE-WHY-DEPTH', `Chuỗi 5-Why chỉ có ${fiveWhy.length} bước — quá nông để đến nguyên nhân hệ thống.`);
    }
    if (fiveWhy.length && !fiveWhy.some((r) => String(r.question ?? '').toLowerCase().includes('(root cause)'))) {
        quality('ROOT-CAUSE-CONSISTENCY', "Không bước 5-Why nào được đánh dấu '(root cause)'.");
    }

    // Team
    const team = rows(data, 'team_assignments');
    if (team.length === 0) {
        quality('TEAM-MISSING', 'Không có thành viên nhóm 8D nào — D1 không có dữ liệu.');
    }
    const leaders = team.filter((r) => r.partner_role === '8D Team Leader');
    if (team.length && leaders.length !== 1) {
        quality('TEAM-ONE-LEADER', `Cần đúng 1 trưởng nhóm, đang có ${leaders.length}.`);
    }
    if (typeof note.team_size === 'number' && team.length && note.team_size !== team.length) {
        quality('TEAM-SIZE-MATCH', `team_size ghi ${note.team_size} nhưng có ${team.length} thành viên.`);
    }

    // Lô kiểm tra trên case Q1 — mắt xích không thể tồn tại.
    // Mapper đã bỏ nó rồi; ở đây chỉ để dataset biết mình có vấn đề, vì validator
    // chạy trên FILE nguồn chứ không phải trên context đã dọn.
    if (!originAllowsInspectionLot(origin) && note.inspection_lot_id) {
        quality(
            'Q1-NO-INSPECTION-LOT',
            `Case khiếu nại khách hàng (Q1) nhưng có inspection_lot_id '${note.inspection_lot_id}'.`,
        );
    }

    // Khách hàng
    // Luật này thuộc về MỌI nguồn gốc không hướng khách hàng, không riêng Q3:
    // case Q2 (nhà cung cấp) cũng không có khiếu nại khách hàng nào.
    const cref = rows(data, 'customer_reference')[0];
    if (cref && origin !== ORIGIN_CUSTOMER) {
        for (const f of ['complaint_reference', 'customer_plant_contact', 'sla_response_due']) {
            const v = cref[f];
            if (v != null && String(v).trim() !== '' && !isDeliberateNA(v)) {
                quality('Q1-ONLY-CUSTOMER-FIELDS', `Case không hướng khách hàng (${origin || 'không rõ nguồn gốc'}) nhưng customer_reference.${f} có dữ liệu: '${v}'.`);
            }
        }
    } else if (cref && origin === ORIGIN_CUSTOMER) {
        const ref = cref.complaint_reference;
        if (ref == null || String(ref).trim() === '' || isDeliberateNA(ref)) {
            quality('Q1-ONLY-CUSTOMER-FIELDS', 'Case khách hàng (Q1) nhưng không có mã khiếu nại.');
        }
    }

    // Action — case đang mở chưa đủ ba loại là bình thường.
    const actionRows = rows(data, 'actions');
    const actionTypes = new Set(actionRows.map((r) => String(r.action_type ?? '').trim()).filter(Boolean));
    if (actionRows.length && actionTypes.size === 0) {
        quality('ACTION-TYPE-MISSING', `${actionRows.length} action nhưng không có action_type nào được phân loại.`);
    }
    if (CLOSED_STATUSES.has(note.status)) {
        const missing = ['Containment', 'Corrective', 'Preventive'].filter((t) => !actionTypes.has(t));
        if (missing.length) {
            quality('ACTION-TYPE-COVERAGE', `Case ${note.status} nhưng thiếu action: ${missing.join(', ')}.`);
        }
    }

    // Ngày hoàn thành
    const closed = CLOSED_STATUSES.has(note.status);
    if (note.completion_date != null && !closed) {
        quality('COMPLETION-DATE-STATUS', `Có completion_date nhưng status = '${note.status}'.`);
    }
    if (note.completion_date == null && closed) {
        quality('COMPLETION-DATE-STATUS', `status = '${note.status}' nhưng thiếu completion_date.`);
    }

    if (rows(data, 'spc_process_data').length > 0) {
        quality('SPC-NOT-PER-CASE', 'spc_process_data có dữ liệu — sheet này là placeholder chưa chốt schema.');
    }

    return issues.map((i) => ({ ...i, message: `${nid}: ${i.message}` }));
}

/** Chỉ những vấn đề khiến payload không dùng được. */
export function blockingIssues(issues: ValidationIssue[]): ValidationIssue[] {
    return issues.filter((i) => i.blocking);
}

/** Cảnh báo chất lượng — đưa vào `CaseContext.gaps` để model biết dữ liệu mỏng ở đâu. */
export function qualityIssues(issues: ValidationIssue[]): ValidationIssue[] {
    return issues.filter((i) => !i.blocking);
}
