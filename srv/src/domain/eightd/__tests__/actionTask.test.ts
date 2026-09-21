/**
 * Chuyển đề xuất của AI thành task giao được.
 *
 * Logic nằm ở `shared/` vì FE dùng, nhưng test chạy ở jest của backend — cùng
 * cách đã làm với `evidence-path`, `precedent-shape` và `step-status`. Đây là
 * phần dễ hỏng âm thầm: bấm Accept hai lần ra hai dòng, hoặc một giá trị mặc
 * định trông như đã có người nhận việc.
 */

import {
    actionLabel,
    assignedFieldFor,
    isAccepted,
    mergeTasks,
    normalizeTasks,
    taskFromAction,
    type ActionTask,
} from '../../../../../shared/action-task';

const task = (over: Partial<ActionTask> = {}): ActionTask => ({
    id: 'task-1',
    name: 'Replace clamp pads',
    description: '',
    assignee: '',
    durationDays: 0,
    status: 'Not started',
    origin: 'AI suggestion',
    attachments: [],
    taskCode: '',
    taskCodeGroup: '',
    plannedEndDate: '',
    ...over,
});

describe('actionLabel', () => {
    it('đọc được cả `action` lẫn `actionText` — model đã trả cả hai kiểu', () => {
        expect(actionLabel({ action: 'Sort batch 2605' })).toBe('Sort batch 2605');
        expect(actionLabel({ actionText: 'Sort batch 2605' })).toBe('Sort batch 2605');
    });

    it('trả chuỗi rỗng khi không có gì, không phải undefined', () => {
        expect(actionLabel({})).toBe('');
    });
});

describe('assignedFieldFor', () => {
    it('theo đúng quy ước của D1 — chỉ đổi đoạn cuối', () => {
        expect(assignedFieldFor('containment.actions')).toBe('containment.assignedActions');
        expect(assignedFieldFor('corrective.actions')).toBe('corrective.assignedActions');
        expect(assignedFieldFor('preventive.actions')).toBe('preventive.assignedActions');
    });
});

describe('taskFromAction', () => {
    it('giữ người AI đề xuất — đó là đề xuất có căn cứ, không phải bịa', () => {
        expect(taskFromAction({ action: 'X', owner: 'Karl Wagner' }, 'a').assignee).toBe('Karl Wagner');
    });

    it('KHÔNG bịa người nhận khi AI không nói — một cái tên mặc định là nói dối', () => {
        expect(taskFromAction({ action: 'X' }, 'a').assignee).toBe('');
    });

    it('KHÔNG bịa thời hạn — 0 nghĩa là chưa ai ước lượng', () => {
        expect(taskFromAction({ action: 'X' }, 'a').durationDays).toBe(0);
    });

    it('đánh dấu nguồn là AI để bảng phân biệt được với việc người tự thêm', () => {
        expect(taskFromAction({ action: 'X' }, 'a').origin).toBe('AI suggestion');
    });

    it('id đi theo seed truyền vào nên ổn định, không phụ thuộc thứ tự render', () => {
        expect(taskFromAction({ action: 'X' }, 'abc').id).toBe('task-abc');
    });
});

describe('normalizeTasks', () => {
    it('giá trị không phải mảng cho ra mảng rỗng', () => {
        for (const bad of [null, undefined, 'x', 42, {}]) expect(normalizeTasks(bad)).toEqual([]);
    });

    it('bỏ hàng không có tên thay vì hiện một dòng trống', () => {
        expect(normalizeTasks([{ description: 'chỉ có mô tả' }, { name: 'Thật' }])).toHaveLength(1);
    });

    it('đọc được hàng lưu theo hình dạng cũ (`action` + `owner`)', () => {
        const [row] = normalizeTasks([{ action: 'Sort batch', owner: 'QE' }]);
        expect(row.name).toBe('Sort batch');
        expect(row.assignee).toBe('QE');
    });

    it('thời hạn hỏng hoặc âm về 0, không để NaN lọt vào bảng', () => {
        expect(normalizeTasks([{ name: 'A', durationDays: 'ba ngày' }])[0].durationDays).toBe(0);
        expect(normalizeTasks([{ name: 'A', durationDays: -5 }])[0].durationDays).toBe(0);
        expect(normalizeTasks([{ name: 'A', durationDays: 3 }])[0].durationDays).toBe(3);
    });

    it('bỏ đính kèm không có tên, giữ cái có', () => {
        const [row] = normalizeTasks([{ name: 'A', attachments: [{ kind: 'PDF' }, { name: 'cmm.pdf' }] }]);
        expect(row.attachments).toEqual([{ name: 'cmm.pdf', kind: 'FILE' }]);
    });
});

describe('mergeTasks', () => {
    it('bấm Accept hai lần không tạo ra hai dòng', () => {
        const existing = [task()];
        expect(mergeTasks(existing, [task({ id: 'task-2' })])).toHaveLength(1);
    });

    it('trùng tính không phân biệt hoa thường', () => {
        expect(mergeTasks([task()], [task({ id: 'x', name: 'REPLACE CLAMP PADS' })])).toHaveLength(1);
    });

    it('không có gì mới thì trả về ĐÚNG mảng cũ — React không phải render lại', () => {
        const existing = [task()];
        expect(mergeTasks(existing, [task({ id: 'task-9' })])).toBe(existing);
    });

    it('thêm việc mới vào cuối, giữ nguyên thứ tự cũ', () => {
        const merged = mergeTasks([task()], [task({ id: 'task-2', name: 'Re-run stack-up' })]);
        expect(merged.map((t) => t.name)).toEqual(['Replace clamp pads', 'Re-run stack-up']);
    });

    it('lọc trùng ngay trong lô mới — Accept all không nhân đôi', () => {
        const merged = mergeTasks([], [task({ id: 'a' }), task({ id: 'b' })]);
        expect(merged).toHaveLength(1);
    });
});

describe('isAccepted', () => {
    it('nhận ra đề xuất đã nằm trong bảng, để nút đổi thành đã thêm', () => {
        expect(isAccepted({ action: 'Replace clamp pads' }, [task()])).toBe(true);
        expect(isAccepted({ action: 'Re-run stack-up' }, [task()])).toBe(false);
    });

    it('đề xuất không có tên thì không bao giờ tính là đã nhận', () => {
        expect(isAccepted({}, [task({ name: '' })])).toBe(false);
    });
});
