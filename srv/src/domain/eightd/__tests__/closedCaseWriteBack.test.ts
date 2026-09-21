/**
 * Dựng bối cảnh của một case vừa đóng ở D8.
 *
 * ── Vì sao đáng test kỹ ──
 * Đây là chỗ QUYẾT ĐỊNH kho tiền lệ học được gì. Nó đọc JSON tự do do model sinh
 * rồi người sửa, với hai biến thể khoá ở gần như mọi trường (`actions` /
 * `assignedActions`, `statement` / `statementOverride`). Map sai một nhánh thì
 * dòng vào kho vẫn hợp lệ, vẫn hiện trên màn hình — chỉ là nó lưu câu hỏi thay vì
 * câu trả lời, và không có gì báo cho tới khi ai đó đọc một gợi ý vô nghĩa.
 *
 * Luật xuyên suốt được kiểm ở đây: bước D nào KHÔNG nói gì thì giữ nguyên bản
 * nền. Ghi đè bằng giá trị rỗng là cách chắc chắn nhất để một case đóng đúng quy
 * trình lại vào kho nghèo hơn chính bản phân tích của nó.
 */

import { buildClosedCaseContext } from '../precedent/closedCaseWriteBack';
import type { CaseContext } from '../types';

const baseContext = (over: Partial<CaseContext> = {}): CaseContext => ({
    notificationId: '8D-10048412',
    origin: 'Q3 - Internal Defect',
    isCustomerFacing: false,
    header: {
        symptomShortText: 'Burr on flange edge',
        status: 'In Process',
        foundDate: '2026-05-04',
        completionDate: null,
        quantityExtent: '128 units affected',
        defectQuantity: 128,
        defectQuantityUom: 'PC',
        teamSize: 2,
    },
    product: {
        plant: '1000',
        materialId: 'MAT-10247',
        materialDesc: 'Housing flange',
        materialGroup: 'MG-HOUSING',
        batchId: 'B-49172',
        defectCodeGroup: 'QM-SURF',
        defectCode: 'DEF-0489',
        defectText: 'Flange edge burr above limit',
        defectClass: '2',
        workCenterId: 'WC-MILL-07',
        workCenterDesc: 'CNC Milling Line 7',
    },
    inspections: [],
    isIsNot: { is: 'Line 7 only', isNot: 'Line 8', notes: 'From lot history' },
    rootCause: { category: 'Machine', description: 'Seal degradation', metricValue: null, source: 'recorded' },
    ishikawa: [],
    fiveWhy: [],
    actions: {
        containment: [{ lineNo: 1, actionType: 'Containment', actionText: 'Quarantine batch', status: 'Done' }],
        corrective: [],
        preventive: [],
    },
    team: {
        leader: { partnerId: '1001', partnerName: 'An Le', functionTitle: 'Quality Engineer', partnerRole: '8D Team Leader', email: 'an@x.io', phone: '111' },
        members: [{ partnerId: '1002', partnerName: 'Bao Vu', functionTitle: 'Production Engineer', partnerRole: '8D Team Member', email: 'bao@x.io', phone: '222' }],
    },
    fmea: null,
    copqEur: 14200,
    lessonsLearned: null,
    customer: { complaintReference: null, plantContact: null, slaResponseDue: null, applicable: false },
    responsibility: { reportedBy: null, coordinator: null, department: null },
    unmapped: {},
    gaps: [],
    ...over,
});

const d = (code: string, result: unknown) => ({ code, resultJson: JSON.stringify(result) });

describe('buildClosedCaseContext — bước D không nói gì thì giữ nguyên bản nền', () => {
    it('không có discipline nào thì trả về đúng bối cảnh lúc phân tích', () => {
        const base = baseContext();
        const ctx = buildClosedCaseContext(base, []);

        expect(ctx.header.symptomShortText).toBe('Burr on flange edge');
        expect(ctx.team.leader?.partnerId).toBe('1001');
        expect(ctx.actions.containment).toHaveLength(1);
        expect(ctx.rootCause?.category).toBe('Machine');
        expect(ctx.copqEur).toBe(14200);
    });

    it('không sửa đối tượng nền — người gọi còn dùng nó để ghi Reports', () => {
        const base = baseContext();
        buildClosedCaseContext(base, [d('D2', { problem: { statement: 'Rewritten problem statement' } })]);
        expect(base.header.symptomShortText).toBe('Burr on flange edge');
    });

    it('resultJson hỏng cú pháp ở một bước không làm hỏng cả case', () => {
        const base = baseContext();
        const ctx = buildClosedCaseContext(base, [
            { code: 'D4', resultJson: '{ not json' },
            d('D2', { problem: { statement: 'A precise 30+ character problem statement' } }),
        ]);
        expect(ctx.header.symptomShortText).toBe('A precise 30+ character problem statement');
        expect(ctx.rootCause?.category).toBe('Machine');
    });

    it('mảng rỗng KHÔNG xoá dữ liệu nền', () => {
        const ctx = buildClosedCaseContext(baseContext(), [
            d('D1', { team: { assignedRoster: [] } }),
            d('D3', { containment: { actions: [], assignedActions: [] } }),
        ]);
        expect(ctx.team.leader?.partnerId).toBe('1001');
        expect(ctx.actions.containment).toHaveLength(1);
    });
});

describe('D1 — nhóm 8D đã chốt', () => {
    it('lấy `assignedRoster`, tách trưởng nhóm, và giữ email/phone theo partnerId', () => {
        const ctx = buildClosedCaseContext(baseContext(), [
            d('D1', {
                team: {
                    roster: [{ name: 'Ai de xuat' }],
                    assignedRoster: [
                        { partnerId: '1002', partnerRole: '8D Team Member' },
                        { partnerId: '1001', partnerRole: '8D Team Leader' },
                        { partnerId: '1003', partnerName: 'Cuong Tran', functionTitle: 'Maintenance', partnerRole: '8D Team Member' },
                    ],
                },
            }),
        ]);

        expect(ctx.team.leader?.partnerId).toBe('1001');
        // Liên hệ không nằm trong bảng chốt — phải lấy lại từ nền, nếu không thì
        // kho mất hẳn email của cả nhóm ở mọi case app tự đóng.
        expect(ctx.team.leader?.email).toBe('an@x.io');
        expect(ctx.team.members.map((m) => m.partnerId)).toEqual(['1002', '1003']);
        expect(ctx.team.members[0].partnerName).toBe('Bao Vu');
        expect(ctx.team.members[1].email).toBeNull();
        expect(ctx.header.teamSize).toBe(3);
    });

    it('bảng chốt không có ai mang vai trò leader thì không tự phong một người', () => {
        const ctx = buildClosedCaseContext(baseContext(), [
            d('D1', { team: { assignedRoster: [{ partnerId: '1002', partnerRole: '8D Team Member' }] } }),
        ]);
        expect(ctx.team.leader).toBeNull();
        expect(ctx.team.members).toHaveLength(1);
    });

    it('bỏ dòng không có partnerId thay vì ghi một thành viên rỗng', () => {
        const ctx = buildClosedCaseContext(baseContext(), [
            d('D1', { team: { assignedRoster: [{ partnerRole: '8D Team Member' }, { partnerId: '1001', partnerRole: '8D Team Leader' }] } }),
        ]);
        expect(ctx.team.leader?.partnerId).toBe('1001');
        expect(ctx.team.members).toHaveLength(0);
    });
});

describe('D2 — phát biểu vấn đề', () => {
    it('bản kỹ sư sửa thắng bản AI viết', () => {
        const ctx = buildClosedCaseContext(baseContext(), [
            d('D2', {
                problem: {
                    statement: 'AI wrote this one',
                    statementOverride: 'The engineer rewrote it',
                },
            }),
        ]);
        expect(ctx.header.symptomShortText).toBe('The engineer rewrote it');
    });

    it('Is / Is-Not từ hai mảng thành hai chuỗi, kèm căn cứ', () => {
        const ctx = buildClosedCaseContext(baseContext(), [
            d('D2', {
                problem: {
                    is: ['Line 7', 'Batch B-49172'],
                    isNot: ['Line 8'],
                    isIsNotBasis: 'Compared 40 lots across both lines.',
                },
            }),
        ]);
        expect(ctx.isIsNot).toEqual({
            is: 'Line 7; Batch B-49172',
            isNot: 'Line 8',
            notes: 'Compared 40 lots across both lines.',
        });
    });
});

describe('D3 / D5 / D7 — hành động đã giao', () => {
    it('`assignedActions` thắng `actions`: kho lưu cái người đã nhận, không phải cái AI đề nghị', () => {
        const ctx = buildClosedCaseContext(baseContext(), [
            d('D3', {
                containment: {
                    actions: [{ action: 'AI suggested sorting' }],
                    assignedActions: [{ name: 'Sort batch B-49172', status: 'Done' }],
                },
            }),
        ]);
        expect(ctx.actions.containment).toEqual([
            {
                lineNo: 1,
                actionType: 'Containment',
                actionText: 'Sort batch B-49172',
                status: 'Done',
                // Task này chưa ai điền người/công sức/hạn, nên cả ba là null —
                // không phải chuỗi rỗng, không phải 0.
                taskProcessor: null,
                timeEffort: null,
                plannedEndDate: null,
            },
        ]);
    });

    // Bốn trường dưới đây là toàn bộ phần "Quality Task" mà SAP đòi và app này
    // trước đây không có. Chúng chỉ tồn tại trên bảng người giao việc, nên đây là
    // đường DUY NHẤT chúng vào được kho tiền lệ.
    it('mang người thực hiện, công sức và hạn từ bảng phân công vào kho', () => {
        const ctx = buildClosedCaseContext(baseContext(), [
            d('D5', {
                corrective: {
                    assignedActions: [{
                        name: 'Replace the worn broach on EQ-BROACH01-002',
                        status: 'Done',
                        assignee: 'Heli Weber',
                        durationDays: 3.5,
                        plannedEndDate: '2026-06-14',
                    }],
                },
            }),
        ]);
        expect(ctx.actions.corrective[0]).toMatchObject({
            taskProcessor: 'Heli Weber',
            timeEffort: 3.5,
            plannedEndDate: '2026-06-14',
        });
    });

    // `durationDays: 0` là giá trị mặc định của một task VỪA ĐƯỢC TẠO, nghĩa là
    // chưa ai ước lượng. Ghi 0 vào kho là biến "chưa biết" thành "tốn 0 ngày", và
    // sau đó không ai phân biệt được hai thứ nữa.
    it('không ghi 0 ngày công vào kho khi chưa ai ước lượng', () => {
        const ctx = buildClosedCaseContext(baseContext(), [
            d('D5', { corrective: { assignedActions: [{ name: 'Replace seal kit', durationDays: 0 }] } }),
        ]);
        expect(ctx.actions.corrective[0].timeEffort).toBeNull();
    });

    it('chưa ai chốt thì lấy đề xuất của AI, đọc được cả `action` lẫn `actionText`', () => {
        const ctx = buildClosedCaseContext(baseContext(), [
            d('D5', { corrective: { actions: [{ action: 'Replace seal kit' }, { actionText: 'Retrain operators' }] } }),
            d('D7', { preventive: { actions: [{ action: 'Add seal to PM plan', status: 'Verified' }] } }),
        ]);
        expect(ctx.actions.corrective.map((a) => a.actionText)).toEqual(['Replace seal kit', 'Retrain operators']);
        // Không có trạng thái thì 'Planned', không phải chuỗi rỗng — kho lọc theo cột này.
        expect(ctx.actions.corrective[0].status).toBe('Planned');
        expect(ctx.actions.preventive[0].actionType).toBe('Preventive');
        expect(ctx.actions.preventive[0].status).toBe('Verified');
    });

    it('bỏ dòng không có tên, và đánh lại lineNo liên tục', () => {
        const ctx = buildClosedCaseContext(baseContext(), [
            d('D5', { corrective: { actions: [{ status: 'Done' }, { action: 'Replace seal kit' }] } }),
        ]);
        // lineNo là số dòng người đọc thấy trong panel tiền lệ — bỏ trống số 1
        // trông như case đã mất một hành động.
        expect(ctx.actions.corrective).toEqual([
            {
                lineNo: 1,
                actionType: 'Corrective',
                actionText: 'Replace seal kit',
                status: 'Planned',
                taskProcessor: null,
                timeEffort: null,
                plannedEndDate: null,
            },
        ]);
    });
});

describe('D4 — nguyên nhân gốc', () => {
    it('nhánh 6M được đánh dấu gốc thắng `rootCauseCategory` lúc phân tích', () => {
        const ctx = buildClosedCaseContext(baseContext(), [
            d('D4', {
                rootCause: {
                    statement: 'Hydraulic seal on fixture F1 degraded, dropping clamp pressure.',
                    ishikawaBoard: [
                        { category: 'Man', finding: 'not assessed', isRootCause: false, source: 'proposed' },
                        { category: 'Method', finding: 'Clamp check missing from setup sheet', isRootCause: true, source: 'recorded' },
                    ],
                    fiveWhy: [
                        { step: 1, why: 'Why the burr?', answer: 'Clamp pressure dropped', evidence: 'inspections#1' },
                        { step: 2, why: 'Why did pressure drop (root cause)?', answer: 'Seal degraded', evidence: 'ishikawa.Machine' },
                    ],
                },
            }),
        ]);

        expect(ctx.rootCause?.category).toBe('Method');
        expect(ctx.rootCause?.description).toBe('Hydraulic seal on fixture F1 degraded, dropping clamp pressure.');
        expect(ctx.ishikawa).toHaveLength(2);
        expect(ctx.ishikawa[1].isRootCause).toBe(true);
        expect(ctx.fiveWhy).toHaveLength(2);
        expect(ctx.fiveWhy[1].isRootCauseStep).toBe(true);
        expect(ctx.fiveWhy[0].evidenceCitation).toBe('inspections#1');
    });

    it('bảng Ishikawa không ai đánh dấu gốc thì giữ category của bản phân tích', () => {
        const ctx = buildClosedCaseContext(baseContext(), [
            d('D4', {
                rootCause: {
                    statement: 'Seal degraded on fixture F1.',
                    ishikawaBoard: [{ category: 'Man', finding: 'not assessed', isRootCause: false, source: 'proposed' }],
                },
            }),
        ]);
        expect(ctx.rootCause?.category).toBe('Machine');
        expect(ctx.rootCause?.description).toBe('Seal degraded on fixture F1.');
    });

    it('5-Why thiếu `step` thì đánh số theo thứ tự, không để NaN', () => {
        const ctx = buildClosedCaseContext(baseContext(), [
            d('D4', { rootCause: { fiveWhy: [{ why: 'Why A?' }, { why: 'Why B?' }] } }),
        ]);
        expect(ctx.fiveWhy.map((r) => r.stepNo)).toEqual([1, 2]);
        expect(ctx.fiveWhy[0].answer).toBe('');
    });
});

describe('D8 — bài học và chi phí', () => {
    it('ghi bài học, và đọc COPQ kể cả khi nó là chuỗi có ký hiệu tiền', () => {
        const ctx = buildClosedCaseContext(baseContext(), [
            d('D8', {
                closure: {
                    lessonsWhatWorked: 'Daily clamp pressure check caught the drift.',
                    lessonsWhatDidNot: 'The FMEA was not updated after the last change.',
                    costOfPoorQuality: '18,500 EUR',
                },
            }),
        ]);
        expect(ctx.lessonsLearned).toEqual({
            whatWorked: 'Daily clamp pressure check caught the drift.',
            whatDidnt: 'The FMEA was not updated after the last change.',
        });
        expect(ctx.copqEur).toBe(18500);
    });

    it.each([
        ['18,500 EUR', 18500],      // phần nghìn kiểu Anh
        ['EUR 18.500,00', 18500],   // phần nghìn kiểu Đức, có phần thập phân
        ['1,240.50', 1240.5],
        ['1.240,50', 1240.5],
        ['18,50', 18.5],            // một dấu, hai chữ số → thập phân
        ['1.240.000', 1240000],
        [' 9800 ', 9800],
        [9800, 9800],
    ])('đọc COPQ %p thành %p', (raw, expected) => {
        const ctx = buildClosedCaseContext(baseContext(), [
            d('D8', { closure: { costOfPoorQuality: raw } }),
        ]);
        expect(ctx.copqEur).toBe(expected);
    });

    it.each(['Not quantified', 'TBD', '', '   '])(
        // Bỏ hết ký tự không phải số rồi Number('') ra 0 chứ không ra NaN — ghi 0 EUR
        // vào kho là một con số trông như đã đo, và không ai thấy nó sai.
        'COPQ %p không ra được số thì giữ giá trị của bản phân tích, không ghi 0',
        (raw) => {
            const ctx = buildClosedCaseContext(baseContext(), [
                d('D8', { closure: { costOfPoorQuality: raw } }),
            ]);
            expect(ctx.copqEur).toBe(14200);
        },
    );

    it('chỉ có một trong hai bài học thì vế còn lại lấy từ nền, không thành undefined', () => {
        const base = baseContext({ lessonsLearned: { whatWorked: 'From the analysis', whatDidnt: 'Also from it' } });
        const ctx = buildClosedCaseContext(base, [
            d('D8', { closure: { lessonsWhatWorked: 'Rewritten at closure.' } }),
        ]);
        expect(ctx.lessonsLearned).toEqual({
            whatWorked: 'Rewritten at closure.',
            whatDidnt: 'Also from it',
        });
    });
});
