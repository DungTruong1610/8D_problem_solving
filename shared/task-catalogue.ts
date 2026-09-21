/**
 * Danh mục MÃ NHIỆM VỤ (SAP catalog type 2) và bộ luật gán mã cho một hành động.
 *
 * ── Vì sao 8D cần mã nhiệm vụ ──
 * Hôm nay mỗi hành động của D3/D5/D7 là một câu tiếng Anh tự do. Câu thì đọc
 * được, nhưng KHÔNG tra được: hỏi "lần trước gặp lỗi này chúng ta đã làm gì" là
 * bắt AI đọc lại toàn bộ văn xuôi của kho case. Có mã thì câu hỏi đó thành một
 * phép đếm trên một cột.
 *
 * Đó cũng là điều kiện cho một tiêu chí chấm điểm mà hôm nay không tồn tại:
 * "case được sửa bằng CÙNG một cách". Trọng số của tiêu chí đó thuộc luồng AI —
 * ở đây chỉ lo phần mã hoá.
 *
 * ── Vì sao mã KHÔNG mang sẵn Containment/Corrective/Preventive ──
 * Cám dỗ là gắn mỗi mã với một discipline, giống `defectClass` gắn với mã lỗi.
 * Dữ liệu thật bác bỏ: `Rework 48 bridged boards` được ghi là **Containment**,
 * còn `Rework 212 affected shafts` là **Corrective**. Cùng một việc, hai vai trò
 * khác nhau trong case. Mã nói VIỆC GÌ; discipline nói việc đó phục vụ mục đích
 * gì — hai trục độc lập, gộp lại là ép sai một trong hai.
 *
 * ── Vì sao file này không import `cds` ──
 * Để `classifyTaskCode` test được bằng bảng dữ liệu thuần, không cần dựng CAP.
 * Nó chạy trên mọi hành động được nạp vào kho; sai ở đây là sai lặng lẽ trên cả
 * kho tiền lệ. `valueHelpSeeder` import hai mảng dưới đây để dựng F4.
 */

/** Nhóm mã nhiệm vụ — tầng trên của catalog type 2, song song với `DEFECT_CODE_GROUPS`. */
export const TASK_CODE_GROUPS = [
    { key: 'QM-CNT', text: 'Containment and immediate response' },
    { key: 'QM-REP', text: 'Rework and disposition' },
    { key: 'QM-EQP', text: 'Equipment and tooling' },
    { key: 'QM-PRC', text: 'Process and document control' },
    { key: 'QM-SUP', text: 'Supplier action' },
    { key: 'QM-PPL', text: 'People and instruction' },
    { key: 'QM-SYS', text: 'Systemic prevention' },
];

/**
 * 32 mã nhiệm vụ, đủ để mã hoá trọn 78 hành động đang có trong kho case.
 *
 * ── Cơ sở của danh sách ──
 * Không nghĩ ra từ đầu: đọc hết 78 `HistoricalActions.actionText` rồi gom theo
 * VIỆC ĐƯỢC LÀM. Phép phủ được kiểm bằng chính dữ liệu đó, trong
 * `taskCatalogue.test.ts`.
 *
 * ── Sáu mã mà bộ luật KHÔNG BAO GIỜ tự sinh ra trên kho hiện tại ──
 * `TSK-2020`, `TSK-2030`, `TSK-2040`, `TSK-3050`, `TSK-5030`, `TSK-6020`.
 * Cả sáu đều là việc CÓ THẬT trong kho, nhưng luôn nằm ở vế sau của một hành
 * động ghép: `... and re-qualify the machine with a capability run`,
 * `... and re-issue the setup sheet`. Bộ luật chỉ mã hoá việc CHÍNH, nên chúng
 * không bao giờ thắng. Giữ chúng lại vì người dùng thêm tay một nhiệm vụ sẽ cần
 * đúng những mã đó; đừng ngạc nhiên khi thống kê tự động không có chúng.
 *
 * Đây là một GIẢ ĐỊNH ĐƯỢC GHI RÕ, giống `DEFECT_CODES`: catalogue thật của một
 * nhà máy nằm trong S/4. Khi nối được, trỏ `TASK_CODE` sang `sourceType:
 * 'external'` và toàn bộ mảng này thành thừa.
 */
export const TASK_CODES = [
    // ── QM-CNT · ngăn chặn ───────────────────────────────────────────────────
    { key: 'TSK-1010', text: 'Quarantine or block affected stock', codeGroup: 'QM-CNT' },
    { key: 'TSK-1020', text: '100% inspection or sorting of suspect stock', codeGroup: 'QM-CNT' },
    { key: 'TSK-1030', text: 'Contain or recall stock already at the customer', codeGroup: 'QM-CNT' },
    { key: 'TSK-1040', text: 'Notify the customer of the affected delivery', codeGroup: 'QM-CNT' },
    { key: 'TSK-1050', text: 'Stop the process or take equipment out of service', codeGroup: 'QM-CNT' },
    { key: 'TSK-1060', text: 'Purge suspect material from the line', codeGroup: 'QM-CNT' },
    { key: 'TSK-1070', text: 'Release falsely rejected stock', codeGroup: 'QM-CNT' },

    // ── QM-REP · xử lý sản phẩm đã sai ───────────────────────────────────────
    { key: 'TSK-2010', text: 'Rework affected units to drawing', codeGroup: 'QM-REP' },
    { key: 'TSK-2020', text: 'Scrap units that cannot be reworked', codeGroup: 'QM-REP' },
    { key: 'TSK-2030', text: 'Replace defective parts in affected units', codeGroup: 'QM-REP' },
    { key: 'TSK-2040', text: 'Re-process or re-torque affected assemblies', codeGroup: 'QM-REP' },

    // ── QM-EQP · thiết bị và dụng cụ ─────────────────────────────────────────
    { key: 'TSK-3010', text: 'Replace a worn tool, die, stencil or machine component', codeGroup: 'QM-EQP' },
    { key: 'TSK-3020', text: 'Repair or rebuild the machine or tooling assembly', codeGroup: 'QM-EQP' },
    { key: 'TSK-3030', text: 'Calibrate or re-qualify measuring equipment', codeGroup: 'QM-EQP' },
    { key: 'TSK-3040', text: 'Service the auxiliary or utility system', codeGroup: 'QM-EQP' },
    { key: 'TSK-3050', text: 'Re-qualify the machine with a capability run', codeGroup: 'QM-EQP' },
    { key: 'TSK-3060', text: 'Stage backup or replacement equipment', codeGroup: 'QM-EQP' },

    // ── QM-PRC · quy trình và tài liệu ───────────────────────────────────────
    { key: 'TSK-4010', text: 'Correct the NC program or machine recipe', codeGroup: 'QM-PRC' },
    { key: 'TSK-4020', text: 'Revise the drawing, specification or work instruction', codeGroup: 'QM-PRC' },
    { key: 'TSK-4030', text: 'Restore the validated process parameter', codeGroup: 'QM-PRC' },
    { key: 'TSK-4040', text: 'Lock the parameter or program against change', codeGroup: 'QM-PRC' },

    // ── QM-SUP · nhà cung cấp ────────────────────────────────────────────────
    { key: 'TSK-5010', text: 'Raise a supplier corrective action request', codeGroup: 'QM-SUP' },
    { key: 'TSK-5020', text: 'Reject and return the supplied lot', codeGroup: 'QM-SUP' },
    { key: 'TSK-5030', text: 'Re-qualify a replacement lot', codeGroup: 'QM-SUP' },

    // ── QM-PPL · con người ───────────────────────────────────────────────────
    { key: 'TSK-6010', text: 'Retrain the operators', codeGroup: 'QM-PPL' },
    { key: 'TSK-6020', text: 'Re-issue the setup sheet or operating instruction', codeGroup: 'QM-PPL' },

    // ── QM-SYS · phòng ngừa hệ thống ─────────────────────────────────────────
    { key: 'TSK-7010', text: 'Add a check to the inspection plan', codeGroup: 'QM-SYS' },
    { key: 'TSK-7020', text: 'Install an error-proofing interlock', codeGroup: 'QM-SYS' },
    { key: 'TSK-7030', text: 'Add a preventive maintenance or tool-life rule', codeGroup: 'QM-SYS' },
    { key: 'TSK-7040', text: 'Extend the engineering change or review checklist', codeGroup: 'QM-SYS' },
    { key: 'TSK-7050', text: 'Add an automated alarm or monitoring routine', codeGroup: 'QM-SYS' },
    { key: 'TSK-7060', text: 'Roll the countermeasure out to comparable lines', codeGroup: 'QM-SYS' },
];

const GROUP_OF = new Map(TASK_CODES.map((t) => [t.key, t.codeGroup]));
const TEXT_OF = new Map(TASK_CODES.map((t) => [t.key, t.text]));

export interface TaskCodeRef {
    taskCode: string;
    taskCodeGroup: string;
}

/**
 * Luật gán mã, XẾP THEO THỨ TỰ — luật khớp đầu tiên thắng.
 *
 * ── Vì sao thứ tự là một phần của luật, không phải chi tiết cài đặt ──
 * Một hành động thật hầu như luôn khớp nhiều luật: `Replace damaged ruby stylus
 * on CMM 1` là "thay linh kiện" (3010) VÀ "thiết bị đo" (3030). Thứ tự dưới đây
 * chính là quy tắc "cụ thể thắng chung chung" — 3030 đứng trước 3010, 7030 đứng
 * trước 7020. Đảo thứ tự là đổi kết quả, nên đừng sắp lại cho gọn mắt.
 *
 * ── Vì sao phần lớn neo bằng `^` ──
 * Mã phải tả VIỆC CHÍNH. `100% surface roughness inspection on all 85
 * quarantined housings` có chữ "quarantined" nhưng là một cuộc kiểm tra, không
 * phải một lệnh cách ly. Neo vào động từ mở đầu loại bỏ đúng nhóm nhầm lẫn đó.
 * Vài luật CỐ Ý không neo (`falsely rejected`, `supplier corrective action
 * request`) vì chúng nhận diện bằng ngữ cảnh chứ không bằng động từ.
 */
const TASK_CODE_RULES: ReadonlyArray<{ code: string; pattern: RegExp }> = [
    // ── Ngăn chặn ────────────────────────────────────────────────────────────
    { code: 'TSK-1070', pattern: /falsely rejected/i },
    { code: 'TSK-1040', pattern: /^notify\b/i },
    // Cần CẢ động từ ngăn chặn LẪN dấu vết khách hàng trong cùng một mệnh đề:
    // hàng đã rời nhà máy là một loại việc khác hẳn hàng còn trong kho.
    { code: 'TSK-1030', pattern: /^(?:recall\b|(?:contain|sort|quarantine|hold|block|segregate)\b[^.]*\b(?:customer|already delivered|in transit)\b)/i },
    { code: 'TSK-1050', pattern: /^(?:stop|freeze|shut down|take .* out of service|remove\b[^.]*\bfrom service)\b/i },
    { code: 'TSK-1060', pattern: /^purge\b/i },
    { code: 'TSK-1010', pattern: /^(?:quarantine|block|hold|segregate|impound)\b/i },

    // ── Sản phẩm đã sai ──────────────────────────────────────────────────────
    // Đứng trước phần kiểm tra: `Rework 48 bridged boards ... and 100% X-ray
    // inspection` là một lệnh sửa hàng, không phải một lệnh kiểm.
    { code: 'TSK-2010', pattern: /^(?:rework|re-?work|re-?drill|re-?machine|re-?finish|repair)\b/i },
    { code: 'TSK-2040', pattern: /^(?:re-?torque|re-?assemble|re-?process|re-?bond)\b/i },

    // ── Thiết bị đo, tiện ích, dụng cụ ───────────────────────────────────────
    { code: 'TSK-3030', pattern: /^(?:re-?calibrate|calibrate|rebuild|re-?qualify|replace|correlate)\b[^.]*\b(?:cmm|gauge|gage|ga-\d+|probe|stylus|micrometer|meter|datum)\b/i },
    // `convert` CỐ Ý không có ở đây. `Convert induction cell cooling ... across
    // all heat treat lines` là một biện pháp phòng ngừa được nhân rộng, không
    // phải một lần bảo dưỡng — để nó rơi xuống TSK-7060 là đọc đúng ý D7.
    { code: 'TSK-3040', pattern: /^(?:dump|flush|acid flush|descale|service|restart|recharge|clean|replace)\b[^.]*\b(?:coolant|chiller|dehumidifier|tank|resin|rinse|water|cooling|humidity|filter|thermostat|induction coil)\b/i },
    { code: 'TSK-3010', pattern: /^(?:replace|scrap|install new|swap)\b[^.]*\b(?:tool|die|stencil|broach|insert|bearing|spindle|nozzle|bracket|pack|wheel|pad|bushing|component|assembly)\b/i },
    { code: 'TSK-3020', pattern: /^(?:rebuild|repair|overhaul|re-?align)\b/i },
    { code: 'TSK-3060', pattern: /^(?:stage|provide|procure|make available)\b/i },

    // ── Nhà cung cấp ─────────────────────────────────────────────────────────
    { code: 'TSK-5020', pattern: /^(?:reject|return)\b[^.]*\b(?:supplier|vendor|lot|batch|coil|ingot)\b/i },
    { code: 'TSK-5010', pattern: /supplier corrective action request|\bSCAR\b/i },
    { code: 'TSK-5030', pattern: /^re-?qualify\b[^.]*\b(?:replacement|supplier|lot|batch)\b/i },

    // ── Con người ────────────────────────────────────────────────────────────
    { code: 'TSK-6010', pattern: /^(?:retrain|train|brief|coach)\b/i },
    { code: 'TSK-6020', pattern: /^re-?issue\b[^.]*\b(?:setup sheet|work instruction|instruction|sop)\b/i },

    // ── Quy trình và tài liệu ────────────────────────────────────────────────
    { code: 'TSK-4030', pattern: /^(?:restore|reset|re-?establish)\b/i },
    { code: 'TSK-4010', pattern: /^(?:correct|adjust|re-?program|regenerate|update)\b[^.]*\b(?:nc program|program|offset|recipe|macro|controller)\b/i },
    { code: 'TSK-4020', pattern: /^(?:correct|revise|update|re-?issue|amend|re-?release)\b[^.]*\b(?:doc-\d|drawing|specification|\bspec\b|work instruction|checklist|\brev\b)/i },
    { code: 'TSK-4040', pattern: /^lock\b/i },

    // ── Phòng ngừa hệ thống ──────────────────────────────────────────────────
    // Bốn luật này nhận diện bằng NGỮ CẢNH: một biện pháp phòng ngừa được mô tả
    // bằng thứ nó cắm vào (kế hoạch kiểm, lịch bảo trì, checklist), không bằng
    // động từ — `Add`, `Implement`, `Introduce` dùng cho cả bốn.
    { code: 'TSK-7040', pattern: /engineering change|change review|review checklist|\bchecklist\b/i },
    { code: 'TSK-7010', pattern: /inspection plan|incoming inspection/i },
    { code: 'TSK-7030', pattern: /tool.?life|stencil life|preventive maintenance|\bPM (?:rule|system|schedule)\b|\bin SAP PM\b|stroke count/i },
    { code: 'TSK-7020', pattern: /interlock|lock ?out|error.?proof|poka|checksum|barcode|scanner|\bdisable\b|\brefuse\b|\block\b(?!ed)/i },
    { code: 'TSK-7050', pattern: /\balarm|\bandon\b|monitoring|\broutine\b|\bsensor\b/i },
    { code: 'TSK-7060', pattern: /across all|plant.?wide|every (?:cell|line|station|machine)|all .{0,30}(?:lines|cells|stations|centers|centres)/i },

    // Bắt cuối: hai luật rộng cho phần còn lại của kho.
    { code: 'TSK-1020', pattern: /^(?:sort|inspect|perform|run|gauge|gage|re-?measure|check|test|\d+\s*%)/i },
    { code: 'TSK-2020', pattern: /^scrap\b/i },
];

/**
 * Mệnh đề ĐẦU của một hành động.
 *
 * Hành động thật hay ghép hai việc: `Quarantine batch B-49688 and inspect the
 * bore mouth…`. Mã tả việc chính, mà việc chính là việc đứng trước. Cắt ở `and`
 * / `;` / `, then` là cách rẻ nhất để lấy nó mà không cần phân tích cú pháp.
 */
function headClause(text: string): string {
    const cut = text.split(/\s+and\s+|;|,\s+then\s+/i)[0];
    return cut.trim();
}

/**
 * Gán mã nhiệm vụ cho một hành động. `null` khi không luật nào nhận ra.
 *
 * Hai lượt: mệnh đề đầu trước, rồi toàn văn. Lượt hai cứu những dòng mà phép cắt
 * đã cắt quá tay — `Reject and return ingot lot ING-77412 to supplier` có mệnh
 * đề đầu chỉ vỏn vẹn `Reject`, không đủ để luật nào nhận ra.
 *
 * ── Vì sao trả null chứ không đoán ──
 * Cùng lý do `classifyAction` trả null cho nhãn lạ: một mã sai trông y hệt một
 * mã đúng, và nó sẽ được đếm vào thống kê "lần trước chúng ta đã làm gì". Dòng
 * không mã hoá được thì để trống — chỗ trống đếm được, mã sai thì không.
 */
export function classifyTaskCode(actionText: unknown): TaskCodeRef | null {
    const full = String(actionText ?? '').trim();
    if (!full) return null;

    const head = headClause(full);
    for (const subject of head === full ? [full] : [head, full]) {
        for (const rule of TASK_CODE_RULES) {
            if (rule.pattern.test(subject)) {
                return { taskCode: rule.code, taskCodeGroup: GROUP_OF.get(rule.code)! };
            }
        }
    }
    return null;
}

/** Nhóm của một mã, hoặc null nếu mã không có trong danh mục. */
export function taskCodeGroupOf(code: unknown): string | null {
    return GROUP_OF.get(String(code ?? '').trim().toUpperCase()) ?? null;
}

/** Mô tả của một mã, hoặc null. Dùng để hiển thị mã đã lưu mà không phải join. */
export function taskCodeTextOf(code: unknown): string | null {
    return TEXT_OF.get(String(code ?? '').trim().toUpperCase()) ?? null;
}
