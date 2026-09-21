/**
 * `classifyTaskCode` — bộ luật gán mã nhiệm vụ cho một hành động 8D.
 *
 * ── Vì sao đáng test ──
 * Hàm này chạy trên MỌI hành động được nạp vào kho tiền lệ, và kết quả của nó
 * trở thành một CỘT được đếm. Cả giá trị của Phase 4 nằm ở phép đếm đó: "lần
 * trước gặp lỗi này chúng ta đã làm gì" là một câu SQL, không còn là một lần
 * đọc lại văn xuôi. Một mã sai không hiện thành lỗi — nó hiện thành một câu trả
 * lời tự tin và sai, trông y hệt câu trả lời đúng.
 *
 * ── Vì sao test bằng câu thật, không bằng câu bịa ──
 * Mọi chuỗi dưới đây là `actionText` có thật trong kho 78 hành động hiện tại.
 * Bộ luật được viết ra để đọc thứ tiếng Anh mà dataset này viết; test bằng câu
 * tự nghĩ chỉ chứng minh regex khớp chính nó.
 */

import {
    TASK_CODES,
    TASK_CODE_GROUPS,
    classifyTaskCode,
    taskCodeGroupOf,
    taskCodeTextOf,
} from '../../../../../shared/task-catalogue';

const code = (text: string) => classifyTaskCode(text)?.taskCode ?? null;

describe('danh mục', () => {
    it('mã không trùng nhau', () => {
        expect(new Set(TASK_CODES.map((t) => t.key)).size).toBe(TASK_CODES.length);
    });

    it('mọi mã thuộc về một nhóm có thật', () => {
        const groups = new Set(TASK_CODE_GROUPS.map((g) => g.key));
        for (const t of TASK_CODES) expect(groups.has(t.codeGroup)).toBe(true);
    });

    // Nhóm rỗng là nhóm không ai chọn được gì trong đó — một mục F4 chết.
    it('mọi nhóm có ít nhất một mã', () => {
        const used = new Set(TASK_CODES.map((t) => t.codeGroup));
        for (const g of TASK_CODE_GROUPS) expect(used.has(g.key)).toBe(true);
    });

    it('tra ngược được nhóm và mô tả của một mã', () => {
        expect(taskCodeGroupOf('TSK-3030')).toBe('QM-EQP');
        expect(taskCodeTextOf('tsk-3030')).toBe('Calibrate or re-qualify measuring equipment');
        expect(taskCodeGroupOf('TSK-9999')).toBeNull();
        expect(taskCodeTextOf(null)).toBeNull();
    });
});

describe('classifyTaskCode — việc CHÍNH là việc đứng trước', () => {
    // Đây là quy tắc trung tâm của bộ luật. Hành động thật hay ghép hai việc, và
    // mã phải tả việc đầu — nếu không, `Quarantine batch B-49688 and inspect the
    // bore mouth` bị đếm thành một lần kiểm tra thay vì một lệnh cách ly.
    it.each([
        ['Quarantine batch B-49688 and inspect the bore mouth of all H22 hubs in WIP and finished stock', 'TSK-1010'],
        ['Block all M12 stock and gauge thread depth on every unit at the customer and in transit', 'TSK-1010'],
        ['Notify the customer and sort the 310 units already delivered', 'TSK-1040'],
        ['Recall and re-torque all 63 units from the affected Shift B window', 'TSK-1030'],
        ['Rework 48 bridged boards using hot-air micro-soldering and 100% X-ray inspection', 'TSK-2010'],
        ['Retrain Shift C operators on NC program selection and re-issue the setup sheet', 'TSK-6010'],
        ['Return coil lot COIL-6612 to the supplier and raise a supplier corrective action request', 'TSK-5020'],
        ['Replace the WC-GRIND-04 spindle bearing set and re-qualify the machine with a capability run', 'TSK-3010'],
    ])('%s → %s', (text, expected) => {
        expect(code(text)).toBe(expected);
    });

    // Cắt ở `and` đôi khi cắt quá tay: mệnh đề đầu chỉ còn `Reject`, không đủ để
    // luật nào nhận ra. Lượt hai đọc toàn văn là thứ cứu những dòng này.
    it('đọc lại toàn văn khi mệnh đề đầu quá ngắn', () => {
        expect(code('Reject and return ingot lot ING-77412 to supplier; release replacement lot ING-77455 after hydrogen re-test')).toBe('TSK-5020');
        expect(code('Restart and service the WC-BOND-02 dehumidifier, then re-qualify the cell with a bonded test panel')).toBe('TSK-3040');
        expect(code('Acid flush and descale induction coil on WC-HEAT-03; restore cooling water flow to 31 l/min')).toBe('TSK-3040');
    });

    // `quarantined` ở đây là TÍNH TỪ, không phải mệnh lệnh. Neo `^` vào động từ
    // mở đầu là thứ phân biệt "kiểm 85 cái đang bị cách ly" với "cách ly 85 cái".
    it('không nhầm danh từ mô tả thành động từ ra lệnh', () => {
        expect(code('100% surface roughness inspection on all 85 quarantined housings and sort out-of-spec units')).toBe('TSK-1020');
        expect(code('Perform 100% Barkhausen noise non-destructive inspection on all 26 quarantined guide rails')).toBe('TSK-1020');
    });
});

describe('classifyTaskCode — "cụ thể thắng chung chung"', () => {
    // Ba cặp dưới đây là lý do THỨ TỰ luật là một phần của luật. Mỗi câu khớp
    // nhiều luật; luật đứng trước phải là luật hẹp hơn.
    it('thiết bị đo thắng "thay linh kiện"', () => {
        expect(code('Replace damaged ruby stylus on CMM 1, torque M2 shank to 1.2 Nm, and re-qualify probe on reference sphere')).toBe('TSK-3030');
        expect(code('Rebuild CMM-BC14-03 against datum B and correlate against a first article before release')).toBe('TSK-3030');
        // Còn một lần thay linh kiện KHÔNG dính thiết bị đo thì vẫn về 3010.
        expect(code('Replace worn deburring tool on EQ-MILL07-002')).toBe('TSK-3010');
    });

    it('hệ tiện ích thắng "thay linh kiện"', () => {
        expect(code('Replace faulty coolant chiller thermostat on WC-LATHE-02 and integrate thermal probe compensation macro in CNC program')).toBe('TSK-3040');
    });

    it('tuổi thọ dụng cụ thắng "chống nhầm"', () => {
        expect(code('Integrate RFID stencil life tracker into solder printer to automatically lock out stencils exceeding 40,000 prints')).toBe('TSK-7030');
        expect(code('Add tool-life counter alarm at 8,000 cycles on WC-MILL-07')).toBe('TSK-7030');
        // "lock out" không kèm tuổi thọ thì vẫn là chống nhầm.
        expect(code('Make the MES step refuse a unit sign-off unless a calibrated torque tool ID is scanned')).toBe('TSK-7020');
    });

    // `GA-0117` từng lọt lưới vì regex viết `ga-\d` rồi đóng `\b` ngay sau một
    // chữ số — ranh giới đó không tồn tại ở giữa `0117`. Giữ lại làm chốt chặn.
    it('nhận số hiệu thiết bị đo nhiều chữ số', () => {
        expect(code('Re-calibrate GA-0117 and re-inspect every C80 lot released since 2026-05-30')).toBe('TSK-3030');
    });

    // "across all ... lines" trong kho này gần như luôn là TRẠNG NGỮ gắn vào một
    // việc khác. Chỉ khi việc đó không tự nhận mã nào hẹp hơn thì mới là 7060.
    it('nhân rộng chỉ thành mã khi không có việc hẹp hơn', () => {
        expect(code('Convert induction cell cooling to closed-loop deionized water chiller circuit across all heat treat lines')).toBe('TSK-7060');
        expect(code('Install automated coolant temperature interlock to halt machining if coolant exceeds 25C across all CNC lathe cells')).toBe('TSK-7020');
        expect(code('Introduce preventive drawbar force gauge check into 500-hour PM schedule across all CNC milling centers')).toBe('TSK-7030');
    });
});

describe('classifyTaskCode — không đoán mò', () => {
    // Cùng nguyên tắc của `classifyAction`: không nhận ra thì trả null. Một mã
    // sai trông y hệt một mã đúng và sẽ được đếm như nhau; ô trống thì đếm được
    // là ô trống.
    it.each([null, undefined, '', '   ', 42, {}])('trả null cho %p', (raw) => {
        expect(classifyTaskCode(raw)).toBeNull();
    });

    it('trả null cho câu không mô tả việc gì', () => {
        expect(classifyTaskCode('Pending discussion with the customer quality department')).toBeNull();
        expect(classifyTaskCode('TBD')).toBeNull();
    });

    it('mã trả về luôn kèm đúng nhóm của nó', () => {
        const hit = classifyTaskCode('Purge all remaining O-ring stock from batch OR-9912 in warehouse and assembly line kitting bins');
        expect(hit).toEqual({ taskCode: 'TSK-1060', taskCodeGroup: 'QM-CNT' });
        expect(taskCodeGroupOf(hit!.taskCode)).toBe(hit!.taskCodeGroup);
    });
});
