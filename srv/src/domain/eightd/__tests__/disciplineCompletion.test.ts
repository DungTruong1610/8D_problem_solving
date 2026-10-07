/**
 * Một bước D duyệt được chưa — tính từ task, không từ việc ai đó bấm duyệt.
 *
 * Lỗi cũ: duyệt D3/D5/D7 đổi MỌI task sang Done. Bộ test này giữ cho điều đó
 * không quay lại theo đường khác: bước chỉ duyệt được khi TỪNG task đã có người
 * phụ trách, đã Done, và có bằng chứng nếu task đó đòi bằng chứng.
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

describe('evaluateDisciplineCompletion — D3/D5/D7', () => {
    it('task xong, có người, có bằng chứng thì duyệt được', () => {
        const v = evaluateDisciplineCompletion({ code: 'D5', resultJson: d5([task()]), evidenceTaskIds: ['ACT-01'] });
        expect(v.canApprove).toBe(true);
        expect(v.blockers).toEqual([]);
    });

    it('task chưa Done thì chặn và nêu đích danh task', () => {
        const v = evaluateDisciplineCompletion({
            code: 'D5',
            resultJson: d5([task({ status: 'Open' })]),
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
            resultJson: JSON.stringify({ containment: { assignedActions: [task({ assignee: '' })] } }),
            evidenceTaskIds: ['ACT-01'],
        });
        expect(v.blockers.map((b) => b.issue)).toEqual(['no-assignee']);
    });

    it('task đòi bằng chứng mà chưa có file thì chặn', () => {
        const v = evaluateDisciplineCompletion({ code: 'D7', resultJson: JSON.stringify({ preventive: { assignedActions: [task()] } }) });
        expect(v.blockers.map((b) => b.issue)).toEqual(['evidence-missing']);
    });

    it('"không yêu cầu bằng chứng" KHÔNG bị đòi bằng chứng', () => {
        const v = evaluateDisciplineCompletion({
            code: 'D5',
            resultJson: d5([task({ evidenceRequired: false })]),
            evidenceTaskIds: [],
        });
        expect(v.canApprove).toBe(true);
    });

    it('file đính kèm lưu sẵn trong task được tính là bằng chứng', () => {
        const v = evaluateDisciplineCompletion({
            code: 'D5',
            resultJson: d5([task({ attachments: [{ name: 'ppap-signoff.pdf', kind: 'PDF' }] })]),
        });
        expect(v.canApprove).toBe(true);
    });

    it('bằng chứng của task KHÁC không thay được bằng chứng của task này', () => {
        const v = evaluateDisciplineCompletion({ code: 'D5', resultJson: d5([task()]), evidenceTaskIds: ['ACT-99'] });
        expect(v.blockers.map((b) => b.issue)).toEqual(['evidence-missing']);
    });

    it('mỗi vấn đề của một task là một dòng riêng', () => {
        const v = evaluateDisciplineCompletion({
            code: 'D5',
            resultJson: d5([task({ assignee: '', status: 'Planned' })]),
        });
        expect(v.blockers.map((b) => b.issue)).toEqual(['no-assignee', 'not-done', 'evidence-missing']);
    });

    it('D5 không có hành động nào thì chặn; chỉ có đề xuất AI thì vẫn qua (giữ luật cũ)', () => {
        expect(evaluateDisciplineCompletion({ code: 'D5', resultJson: d5([]) }).blockers[0].issue).toBe('no-actions');
        expect(evaluateDisciplineCompletion({ code: 'D5', resultJson: d5([], [{ action: 'Recalibrate offset' }]) }).canApprove).toBe(true);
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

    it('resultJson hỏng không làm nổ — D5 coi như chưa có hành động', () => {
        const v = evaluateDisciplineCompletion({ code: 'D5', resultJson: '{not json' });
        expect(v.blockers.map((b) => b.issue)).toEqual(['no-actions']);
    });
});

describe('evaluateDisciplineCompletion — D6 và bước khác', () => {
    it('D6 chặn khi task D5 còn mở', () => {
        const v = evaluateDisciplineCompletion({
            code: 'D6',
            resultJson: '{}',
            siblings: [{ code: 'D5', resultJson: d5([task({ status: 'Open' })]) }],
        });
        expect(v.canApprove).toBe(false);
        expect(v.blockers[0]).toMatchObject({ issue: 'prerequisite-open', code: 'D6', taskId: 'ACT-01' });
    });

    it('D6 qua khi mọi task D5 đã Done', () => {
        const v = evaluateDisciplineCompletion({
            code: 'D6',
            resultJson: '{}',
            siblings: [{ code: 'D5', resultJson: d5([task()]) }],
        });
        expect(v.canApprove).toBe(true);
    });

    it('D1/D2/D4/D8 không có luật task', () => {
        for (const code of ['D1', 'D2', 'D4', 'D8']) {
            expect(evaluateDisciplineCompletion({ code, resultJson: '{}' }).canApprove).toBe(true);
        }
    });
});

describe('describeBlockers', () => {
    it('một câu đầu + mỗi dòng một việc', () => {
        const v = evaluateDisciplineCompletion({ code: 'D5', resultJson: d5([task({ status: 'Open' })]), evidenceTaskIds: ['ACT-01'] });
        const text = describeBlockers(v.blockers);
        expect(text.split('\n')[0]).toBe('Cannot approve D5: 1 item still open.');
        expect(text).toContain('is Open, not Done');
    });

    it('rỗng khi không có gì chặn', () => {
        expect(describeBlockers([])).toBe('');
    });
});
