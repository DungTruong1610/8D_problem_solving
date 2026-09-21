/**
 * Test việc hợp nhất tiền lệ của tám bước thành một danh sách đánh số.
 *
 * ── Vì sao đây là chỗ đáng test nhất của tính năng ──
 * Trích dẫn `precedents#N` xuất hiện trong prompt, trong luật ràng buộc
 * (`^(team\.|precedents#)`), trong `postProcess`, và trong phần nguồn hiện trên
 * UI. Khi mỗi bước D chấm kho theo một profile riêng, cái duy nhất phải KHÔNG
 * đổi là: `precedents#2` ở D1 và ở D4 luôn là cùng một case.
 *
 * Cái sai ở đây không làm gãy gì cả — nó cho ra một prompt trông hoàn toàn bình
 * thường với những trích dẫn trỏ nhầm chỗ, và mọi lớp kiểm tra hiện có đều cho
 * qua. Nên nó phải được chốt bằng test.
 */

import { mergeStepPrecedents, type Precedent, type PrecedentResult } from '../findPrecedents';
import { STEP_CODES, type StepCode } from '../profileRepository';

function precedent(notificationId: string, score: number): Precedent {
    return {
        notificationId,
        score,
        maxScore: 16,
        breakdown: [],
        explanation: `${score}/16`,
        symptomShortText: null,
        sapStatus: 'Closed',
        completionDate: null,
        quantityExtent: null,
        workCenterId: null,
        workCenterDesc: null,
        defectCode: null,
        defectText: null,
        materialId: null,
        materialDesc: null,
        rootCauseCategory: null,
        copqEur: null,
        fmeaId: null,
        team: [],
        actions: [],
    };
}

function result(precedents: Precedent[], profileKey = 'default'): PrecedentResult {
    return {
        precedents,
        reason: precedents.length ? null : 'nothing scored high enough',
        maxScore: 16,
        settings: { minScore: 3, topN: 3, closedOnly: true },
        libraryCount: 12,
        candidatesScored: 12,
        semanticUsed: true,
        profileKey,
        profileLabel: profileKey,
    };
}

/** Tám bước cùng một kết quả, rồi ghi đè những bước cần khác đi. */
function byStep(overrides: Partial<Record<StepCode, PrecedentResult>> = {}) {
    const base = Object.fromEntries(
        STEP_CODES.map((code) => [code, result([])]),
    ) as Record<StepCode, PrecedentResult>;
    return { ...base, ...overrides };
}

describe('mergeStepPrecedents', () => {
    it('khử trùng lặp — một case xuất hiện ở nhiều bước vẫn chỉ được đánh số một lần', () => {
        const union = mergeStepPrecedents(byStep({
            D1: result([precedent('8D-100', 7)]),
            D4: result([precedent('8D-100', 5)]),
        }));

        expect(union).toHaveLength(1);
        expect(union[0].notificationId).toBe('8D-100');
    });

    it('giữ điểm CAO NHẤT trong các bước đã chấm case đó', () => {
        const union = mergeStepPrecedents(byStep({
            D1: result([precedent('8D-100', 5)]),
            D4: result([precedent('8D-100', 9)]),
            D7: result([precedent('8D-100', 7)]),
        }));

        expect(union[0].score).toBe(9);
    });

    it('sắp theo điểm giảm dần — precedents#1 là case mạnh nhất trên toàn cục', () => {
        const union = mergeStepPrecedents(byStep({
            D1: result([precedent('8D-LOW', 4), precedent('8D-MID', 6)]),
            D4: result([precedent('8D-TOP', 11)]),
        }));

        expect(union.map((p) => p.notificationId)).toEqual(['8D-TOP', '8D-MID', '8D-LOW']);
    });

    it('tất định khi điểm bằng nhau — chốt bằng mã case', () => {
        const forward = mergeStepPrecedents(byStep({
            D1: result([precedent('8D-B', 5), precedent('8D-A', 5)]),
        }));
        const reverse = mergeStepPrecedents(byStep({
            D1: result([precedent('8D-A', 5)]),
            D2: result([precedent('8D-B', 5)]),
        }));

        // Hai thứ tự đầu vào khác nhau phải cho ra cùng một cách đánh số, nếu
        // không thì chạy lại cùng một case sẽ đổi nghĩa của `precedents#1`.
        expect(forward.map((p) => p.notificationId)).toEqual(['8D-A', '8D-B']);
        expect(reverse.map((p) => p.notificationId)).toEqual(['8D-A', '8D-B']);
    });

    it('gom được case mà chỉ MỘT bước tìm ra', () => {
        // Đây chính là điều tính năng này sinh ra để làm: profile của D4 nặng về
        // ngữ nghĩa nên thấy một case mà profile theo khoá của D1 không thấy.
        const union = mergeStepPrecedents(byStep({
            D1: result([precedent('8D-SHARED', 8)]),
            D4: result([precedent('8D-SHARED', 6), precedent('8D-SEMANTIC-ONLY', 4)]),
        }));

        expect(union.map((p) => p.notificationId)).toEqual(['8D-SHARED', '8D-SEMANTIC-ONLY']);
    });

    it('không bước nào tìm ra gì ⇒ danh sách rỗng, không ném', () => {
        expect(mergeStepPrecedents(byStep())).toEqual([]);
    });

    it('chịu được bước thiếu kết quả', () => {
        // `byStep` luôn đủ tám khoá trong luồng thật, nhưng hàm không được sập
        // nếu một khoá thiếu — nó chạy giữa lượt phân tích.
        const partial = { D1: result([precedent('8D-100', 5)]) } as unknown as Record<StepCode, PrecedentResult>;
        expect(mergeStepPrecedents(partial)).toHaveLength(1);
    });
});
