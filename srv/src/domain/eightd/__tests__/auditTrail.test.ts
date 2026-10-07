/**
 * Bản chụp dữ kiện của một dòng vết kiểm toán.
 *
 * Thứ cần giữ: bản chụp chỉ chứa danh sách trắng (không chép sourcePayload, không
 * chép tên người phụ trách), luôn là JSON hợp lệ dù vượt trần, và trả lời được
 * "lúc quyết định, người đó nhìn thấy số đo / nguyên nhân / tiền lệ nào".
 */

import {
    beforeAfter,
    buildDecisionSnapshot,
    buildTaskDoneSnapshot,
    capJson,
    measurementsOf,
    newlyDoneTasks,
    precedentsFor,
    rootCauseCandidateOf,
    traceIdOf,
} from '../auditTrail';
import { missingColumns, REVIEW_EVENT_COLUMNS } from '../auditSchema';

const caseContext = JSON.stringify({
    inspections: [
        { characteristic: 'Flange flatness', measuredValue: '0.09mm', specValue: '0.05', outOfSpec: false },
        { characteristic: 'Flange burr height', measuredValue: '0.32mm', specValue: 'max 0.1 mm', outOfSpec: true },
    ],
    // Thứ KHÔNG được lọt vào bản chụp.
    customer: { contact: 'Jane Doe', phone: '+49 000' },
});

const precedentsJson = JSON.stringify({
    byStep: {
        D4: { precedents: [{ notificationId: '8D-10049120', score: 11, symptomShortText: 'long text' }] },
        D5: { precedents: [], reason: 'No past case scores at least 3 of 16.' },
    },
});

const report = {
    notificationId: '8D-10048412',
    caseContext,
    precedentsJson,
    rootCauseCategory: 'Man',
    aiRootCause: 'Machine',
    aiModelAnalyze: 'deepseek-flash',
    analyzedAt: '2026-09-21T16:07:04.873Z',
};

describe('measurementsOf', () => {
    it('đặc tính ngoài spec đứng trước, chỉ giữ ba trường cần thiết', () => {
        const m = measurementsOf(caseContext);
        expect(m[0]).toEqual({ characteristic: 'Flange burr height', measured: '0.32mm', spec: 'max 0.1 mm', outOfSpec: true });
        expect(m).toHaveLength(2);
    });

    it('caseContext hỏng hoặc thiếu thì rỗng, không nổ', () => {
        expect(measurementsOf('{bad')).toEqual([]);
        expect(measurementsOf(null)).toEqual([]);
    });
});

describe('precedentsFor', () => {
    it('lấy mã + điểm, bỏ phần văn bản dài', () => {
        expect(precedentsFor(precedentsJson, 'D4')).toEqual({ ids: [{ notificationId: '8D-10049120', score: 11 }], reason: null });
    });

    it('không có tiền lệ thì giữ LÝ DO, không để trống im lặng', () => {
        const p = precedentsFor(precedentsJson, 'D5');
        expect(p.ids).toEqual([]);
        expect(p.reason).toContain('No past case');
    });
});

describe('rootCauseCandidateOf', () => {
    it('đọc dạng có statement', () => {
        const rc = rootCauseCandidateOf({ rootCause: { statement: 'Tool wear on WC-MILL-07', ishikawaBoard: [] } });
        expect(rc.statement).toBe('Tool wear on WC-MILL-07');
    });

    it('đọc dạng category + ishikawa, chỉ giữ mục được đánh dấu là nguyên nhân gốc', () => {
        const rc = rootCauseCandidateOf({
            rootCause: {
                category: 'Man',
                ishikawa: [
                    { category: 'Man', description: 'Shift C operator', isRootCause: true },
                    { category: 'Machine', description: 'Tool changer drift 0.9mm', isRootCause: false },
                ],
            },
        });
        expect(rc.category).toBe('Man');
        expect(rc.markedRootCauses).toEqual(['Man: Shift C operator']);
    });
});

describe('buildDecisionSnapshot', () => {
    it('D4 chụp nguyên nhân ứng viên, số đo và tiền lệ — không chụp dữ liệu khách', () => {
        const snap = buildDecisionSnapshot({
            code: 'D4',
            resultJson: { rootCause: { statement: 'Deburring insert worn' } },
            summary: 'Machine root cause',
            report,
        });
        expect(snap.rootCause).toMatchObject({ statement: 'Deburring insert worn' });
        expect(snap.recordedRootCauseCategory).toBe('Man');
        expect(snap.aiIndependentRootCause).toBe('Machine');
        expect((snap.measurements as any[])[0].measured).toBe('0.32mm');
        expect(snap.precedents).toEqual([{ notificationId: '8D-10049120', score: 11 }]);
        expect(JSON.stringify(snap)).not.toContain('Jane Doe');
    });

    it('D5 chụp trạng thái task + có bằng chứng hay chưa, KHÔNG chụp tên người phụ trách', () => {
        const snap = buildDecisionSnapshot({
            code: 'D5',
            resultJson: { corrective: { assignedActions: [{ id: 'ACT-1', name: 'x', assignee: 'Karl Wagner', status: 'Done' }] } },
            report,
            evidenceTaskIds: ['ACT-1'],
        });
        expect(snap.tasks).toEqual([{ taskId: 'ACT-1', status: 'Done', evidenceRequired: true, hasEvidence: true }]);
        expect(JSON.stringify(snap)).not.toContain('Karl Wagner');
        expect(snap.precedentsNote).toContain('No past case');
    });

    it('D1 không kéo số đo hay tiền lệ vào', () => {
        const snap = buildDecisionSnapshot({ code: 'D1', resultJson: {}, report });
        expect(snap).not.toHaveProperty('measurements');
        expect(snap).not.toHaveProperty('precedents');
    });
});

describe('capJson', () => {
    it('vừa trần thì giữ nguyên', () => {
        expect(capJson({ a: 1 }, 100)).toBe('{"a":1}');
    });

    it('vượt trần thì bỏ bớt mục danh sách, đánh dấu truncated, vẫn là JSON hợp lệ', () => {
        const big = { tasks: Array.from({ length: 50 }, (_, i) => ({ taskId: `T-${i}`, status: 'Done' })) };
        const text = capJson(big, 400)!;
        expect(text.length).toBeLessThanOrEqual(400);
        const parsed = JSON.parse(text);
        expect(parsed.truncated).toBe(true);
        expect(parsed.tasks.length).toBeLessThan(50);
    });

    it('null thì null', () => {
        expect(capJson(null, 100)).toBeNull();
    });
});

describe('newlyDoneTasks', () => {
    it('chỉ báo task vừa chuyển sang Done', () => {
        const before = [{ id: 'A', status: 'Open' }, { id: 'B', status: 'Done' }];
        const after = [{ id: 'A', status: 'Done', note: 'Replaced insert' }, { id: 'B', status: 'Done' }];
        expect(newlyDoneTasks(before, after)).toEqual([{ id: 'A', name: null, note: 'Replaced insert', fromStatus: 'Open' }]);
    });

    it('không có thay đổi thì rỗng', () => {
        expect(newlyDoneTasks([{ id: 'A', status: 'Open' }], [{ id: 'A', status: 'Open' }])).toEqual([]);
    });
});

describe('beforeAfter / traceIdOf / buildTaskDoneSnapshot', () => {
    it('beforeAfter chỉ giữ trường thật sự đổi', () => {
        expect(beforeAfter({ reviewStatus: ['Draft', 'Approved'], workState: ['InProgress', 'InProgress'] }))
            .toEqual({ reviewStatus: { before: 'Draft', after: 'Approved' } });
        expect(beforeAfter({ x: [1, 1] })).toBeNull();
    });

    it('traceId = model@thời điểm phân tích, null khi chưa phân tích', () => {
        expect(traceIdOf(report)).toBe('deepseek-flash@2026-09-21T16:07:04.873Z');
        expect(traceIdOf({ analyzedAt: null })).toBeNull();
    });

    it('task-done ghi cách hoàn tất và id bằng chứng', () => {
        expect(buildTaskDoneSnapshot({ code: 'D5', taskId: 'A', evidenceIds: ['E1'], via: 'evidence-upload' }))
            .toMatchObject({ step: 'D5', taskId: 'A', evidenceIds: ['E1'], via: 'evidence-upload' });
    });
});

describe('missingColumns (migration ReviewEvents)', () => {
    it('bảng cũ thiếu đủ sáu cột mới', () => {
        const old = ['ID', 'reportID', 'disciplineCode', 'fromStatus', 'toStatus', 'note', 'actor', 'at'];
        expect(missingColumns(old).map(([n]) => n)).toEqual(REVIEW_EVENT_COLUMNS.map(([n]) => n));
    });

    it('đã đủ thì không thêm gì — chạy lại không sao', () => {
        expect(missingColumns(REVIEW_EVENT_COLUMNS.map(([n]) => n.toUpperCase()))).toEqual([]);
    });
});
