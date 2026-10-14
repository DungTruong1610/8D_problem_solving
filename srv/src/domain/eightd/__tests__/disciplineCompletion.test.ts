/**
 * Một bước D duyệt được chưa — tính từ task, không từ việc ai đó bấm duyệt.
 *
 * Lỗi cũ: duyệt D3/D5/D7 đổi MỌI task sang Done. Bộ test này giữ cho điều đó
 * không quay lại theo đường khác: D3/D7 (và D6, cho task của D5) chỉ duyệt được
 * khi TỪNG task đã có người phụ trách, đã Done, và có bằng chứng nếu task đó đòi
 * bằng chứng. D5 chỉ là bước giao việc: một task có người nhận là đủ.
 */

import { describeBlockers, evaluateDisciplineCompletion } from '../../../../../shared/discipline-completion';

const task = (over: Record<string, unknown> = {}) => ({
    id: 'ACT-01',
    name: 'Replace deburring insert',
    assignee: 'Karl Wagner',
    status: 'Done',
    evidenceRequired: true,
    ...over,
});

const d5 = (tasks: unknown[], actions: unknown[] = []) => JSON.stringify({ corrective: { assignedActions: tasks, actions } });
const d3 = (tasks: unknown[]) => JSON.stringify({ containment: { assignedActions: tasks } });
const d7 = (tasks: unknown[]) => JSON.stringify({ preventive: { assignedActions: tasks } });

describe('evaluateDisciplineCompletion — D3/D7 (thực thi tại chính bước)', () => {
    it('task xong, có người, có bằng chứng thì duyệt được', () => {
        const v = evaluateDisciplineCompletion({ code: 'D3', resultJson: d3([task()]), evidenceTaskIds: ['ACT-01'] });
        expect(v.canApprove).toBe(true);
        expect(v.blockers).toEqual([]);
    });

    it('task chưa Done thì chặn và nêu đích danh task', () => {
        const v = evaluateDisciplineCompletion({
            code: 'D3',
            resultJson: d3([task({ status: 'Open' })]),
            evidenceTaskIds: ['ACT-01'],
        });
        expect(v.canApprove).toBe(false);
        expect(v.blockers).toHaveLength(1);
        expect(v.blockers[0]).toMatchObject({ issue: 'not-done', taskId: 'ACT-01' });
        expect(v.blockers[0].message).toContain('Replace deburring insert');
    });

    it('task không có người phụ trách thì chặn', () => {
        const v = evaluateDisciplineCompletion({
            code: 'D3',
            resultJson: d3([task({ assignee: '' })]),
            evidenceTaskIds: ['ACT-01'],
        });
        expect(v.blockers.map((b) => b.issue)).toEqual(['no-assignee']);
    });

    it('task đòi bằng chứng mà chưa có file thì chặn', () => {
        const v = evaluateDisciplineCompletion({ code: 'D7', resultJson: d7([task()]) });
        expect(v.blockers.map((b) => b.issue)).toEqual(['evidence-missing']);
    });

    it('"không yêu cầu bằng chứng" KHÔNG bị đòi bằng chứng', () => {
        const v = evaluateDisciplineCompletion({
            code: 'D7',
            resultJson: d7([task({ evidenceRequired: false })]),
            evidenceTaskIds: [],
        });
        expect(v.canApprove).toBe(true);
    });

    it('file đính kèm lưu sẵn trong task được tính là bằng chứng', () => {
        const v = evaluateDisciplineCompletion({
            code: 'D3',
            resultJson: d3([task({ attachments: [{ name: 'ppap-signoff.pdf', kind: 'PDF' }] })]),
        });
        expect(v.canApprove).toBe(true);
    });

    it('bằng chứng của task KHÁC không thay được bằng chứng của task này', () => {
        const v = evaluateDisciplineCompletion({ code: 'D3', resultJson: d3([task()]), evidenceTaskIds: ['ACT-99'] });
        expect(v.blockers.map((b) => b.issue)).toEqual(['evidence-missing']);
    });

    it('mỗi vấn đề của một task là một dòng riêng', () => {
        const v = evaluateDisciplineCompletion({
            code: 'D7',
            resultJson: d7([task({ assignee: '', status: 'Planned' })]),
        });
        expect(v.blockers.map((b) => b.issue)).toEqual(['no-assignee', 'not-done', 'evidence-missing']);
    });

    it('D7 không có hành động nào thì chặn; chỉ có đề xuất AI thì vẫn qua', () => {
        expect(evaluateDisciplineCompletion({ code: 'D7', resultJson: d7([]) }).blockers[0].issue).toBe('no-actions');
        expect(evaluateDisciplineCompletion({
            code: 'D7',
            resultJson: JSON.stringify({ preventive: { assignedActions: [], actions: [{ action: 'Update PFMEA' }] } }),
        }).canApprove).toBe(true);
    });

    it('D3 không có task nào thì không chặn — containment có thể chưa cần giao việc', () => {
        expect(evaluateDisciplineCompletion({ code: 'D3', resultJson: JSON.stringify({ containment: {} }) }).canApprove).toBe(true);
    });

    it('task lưu kiểu cũ ở gốc `assignedActions` vẫn được đọc', () => {
        const v = evaluateDisciplineCompletion({
            code: 'D7',
            resultJson: JSON.stringify({ assignedActions: [task({ status: 'Open' })] }),
            evidenceTaskIds: ['ACT-01'],
        });
        expect(v.blockers.map((b) => b.issue)).toEqual(['not-done']);
    });
});

describe('evaluateDisciplineCompletion — D5 chỉ giao việc', () => {
    it('một task đã có người nhận là duyệt được, dù chưa Done và chưa có bằng chứng', () => {
        const v = evaluateDisciplineCompletion({ code: 'D5', resultJson: d5([task({ status: 'Open' })]) });
        expect(v.canApprove).toBe(true);
    });

    it('chỉ cần MỘT task có người nhận — task khác chưa giao người không chặn', () => {
        const v = evaluateDisciplineCompletion({
            code: 'D5',
            resultJson: d5([task({ status: 'Planned' }), task({ id: 'ACT-02', assignee: '', status: 'Planned' })]),
        });
        expect(v.canApprove).toBe(true);
    });

    it('chưa task nào có người nhận thì chặn — đề xuất AI hay task chưa giao không tính', () => {
        expect(evaluateDisciplineCompletion({ code: 'D5', resultJson: d5([]) }).blockers.map((b) => b.issue)).toEqual(['no-actions']);
        expect(evaluateDisciplineCompletion({ code: 'D5', resultJson: d5([], [{ action: 'Recalibrate offset' }]) }).canApprove).toBe(false);
        expect(evaluateDisciplineCompletion({ code: 'D5', resultJson: d5([task({ assignee: '' })]) }).canApprove).toBe(false);
    });

    it('resultJson hỏng không làm nổ — D5 coi như chưa giao task nào', () => {
        const v = evaluateDisciplineCompletion({ code: 'D5', resultJson: '{not json' });
        expect(v.blockers.map((b) => b.issue)).toEqual(['no-actions']);
    });
});

describe('evaluateDisciplineCompletion — D6 quản lý thực thi task của D5', () => {
    const d6 = (tasks: unknown[], evidenceTaskIds: string[] = ['ACT-01']) => evaluateDisciplineCompletion({
        code: 'D6',
        resultJson: '{}',
        evidenceTaskIds,
        siblings: [{ code: 'D5', resultJson: d5(tasks) }],
    });

    it('chặn khi task D5 còn mở, và chặn dưới tên D6', () => {
        const v = d6([task({ status: 'Open' })]);
        expect(v.canApprove).toBe(false);
        expect(v.blockers[0]).toMatchObject({ issue: 'not-done', code: 'D6', taskId: 'ACT-01' });
        expect(v.blockers[0].message).toContain('D5 task');
    });

    it('chặn khi task D5 bắt buộc bằng chứng mà chưa có file', () => {
        expect(d6([task()], []).blockers.map((b) => b.issue)).toEqual(['evidence-missing']);
    });

    it('qua khi mọi task D5 đã Done và có bằng chứng', () => {
        expect(d6([task()]).canApprove).toBe(true);
    });

    it('D5 chưa giao task nào thì D6 chưa có gì để kiểm', () => {
        expect(d6([]).blockers.map((b) => b.issue)).toEqual(['prerequisite-open']);
    });

    it('D1/D2/D4/D8 không có luật task', () => {
        for (const code of ['D1', 'D2', 'D4', 'D8']) {
            expect(evaluateDisciplineCompletion({ code, resultJson: '{}' }).canApprove).toBe(true);
        }
    });
});

describe('describeBlockers', () => {
    it('một câu đầu + mỗi dòng một việc', () => {
        const v = evaluateDisciplineCompletion({ code: 'D3', resultJson: d3([task({ status: 'Open' })]), evidenceTaskIds: ['ACT-01'] });
        const text = describeBlockers(v.blockers);
        expect(text.split('\n')[0]).toBe('Cannot approve D3: 1 item still open.');
        expect(text).toContain('is Open, not Done');
    });

    it('rỗng khi không có gì chặn', () => {
        expect(describeBlockers([])).toBe('');
    });
});
