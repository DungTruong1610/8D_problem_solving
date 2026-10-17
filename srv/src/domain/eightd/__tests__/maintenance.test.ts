/**
 * Đề xuất bảo trì phòng ngừa — sáu ca bắt buộc của tính năng.
 *
 * Mỗi ca khoá một luật của Master Idea: đi sâu chứ không đi ngang, không bịa số,
 * từ chối trung thực, chỉ đề xuất trên D4 đã duyệt.
 */

import {
    applyDecision,
    buildMaintenancePlan,
    carryDecisions,
    classifyControl,
    extractInterval,
    normalizeRootCause,
    recurrenceIntervals,
    type PlanInput,
} from '../maintenance/rules';

/** D4 dạng case nguồn `8D-10048420`: Man = N, Machine = Y, why sâu nhất là nguyên nhân hệ thống. */
const broachD4 = {
    causesIshikawa: [
        { category: 'Man', description: 'EMP-3301 ran the standard cycle', metricValue: null, isRootCause: 'N' },
        {
            category: 'Machine',
            description: 'EQ-BROACH01-002, broach tool ran 41,200 strokes against a 30,000 stroke replacement limit',
            metricValue: '41,200 of 30,000 strokes',
            isRootCause: 'Y',
        },
    ],
    fiveWhyChain: [
        { stepNo: 1, question: 'Why ridge?', answer: 'Ridge 0.28mm against a 0.05mm maximum', evidenceCitation: 'QALS' },
        { stepNo: 2, question: 'Why push?', answer: 'Cutting edges rounded after 41,200 strokes', evidenceCitation: 'EQ log' },
        { stepNo: 3, question: 'Why worn?', answer: 'Broach life is tracked on a paper tally at the machine and nobody owns it', evidenceCitation: 'PM plan' },
    ],
};

const plan = (overrides: Partial<PlanInput>): PlanInput => ({
    notificationId: '8D-1',
    defectCode: 'DEF-1',
    workCenterId: 'WC-1',
    foundDate: '2026-10-01',
    d4Approved: true,
    d4Result: broachD4,
    recordedRootCauseCategory: null,
    history: [],
    ...overrides,
});

describe('maintenance rules', () => {
    it('Machine root cause with "41,200 of 30,000 strokes" → preventive maintenance, limit 30000 strokes', () => {
        const result = buildMaintenancePlan(plan({}));
        expect(result.refusal).toBeNull();
        expect(result.proposals).toHaveLength(1);
        const [p] = result.proposals;
        expect(p.controlType).toBe('preventive-maintenance');
        expect(p.interval).toMatchObject({ limit: 30000, actual: 41200, unit: 'strokes' });
        expect(p.whyStepUsed).toBe(3);
        expect(p.sourceCaseIds).toEqual(['8D-1']);
        expect(result.stops).toEqual([]);
    });

    it('Man on the surface, deepest why is a system cause → classified on the deepest why', () => {
        const rc = normalizeRootCause({
            rootCause: {
                ishikawaBoard: [{ category: 'Man', finding: 'Operator skipped the torque check', isRootCause: true }],
                fiveWhy: [
                    { step: 1, why: 'Why loose?', answer: 'Operator did not torque the bolt', evidence: 'audit' },
                    { step: 2, why: 'Why not torqued?', answer: 'Operator was new and skipped the step', evidence: 'HR' },
                    { step: 3, why: 'Why not caught?', answer: 'The torque wrench has no calibration interval and read 20% low', evidence: 'TEM' },
                ],
            },
        });
        const cls = classifyControl(rc);
        expect(cls.category).toBe('Measurement');
        expect(cls.controlType).toBe('calibration');
        expect(cls.whyStepUsed).toBe(3);
    });

    it('no parseable number → interval null + unverified-facts stop', () => {
        const d4 = {
            causesIshikawa: [{ category: 'Machine', description: 'Spindle bearing worn', metricValue: '0,32mm', isRootCause: 'Y' }],
            fiveWhyChain: [{ stepNo: 1, answer: 'Bearing was never on the PM plan', evidenceCitation: 'EQ log' }],
        };
        const result = buildMaintenancePlan(plan({ d4Result: d4 }));
        expect(result.proposals[0].controlType).toBe('preventive-maintenance');
        expect(result.proposals[0].interval).toBeNull();
        expect(result.stops.map((s) => s.type)).toEqual(['unverified-facts']);
        expect(extractInterval(['0,32mm', 'Spindle bearing worn'])).toBeNull();
    });

    it('no controllable why → outside-scope, only "increase inspection frequency", interval null', () => {
        const d4 = {
            causesIshikawa: [{ category: 'Environment', description: 'Plant flooded', isRootCause: 'Y' }],
            fiveWhyChain: [
                { stepNo: 1, answer: 'Parts corroded after the flood', evidenceCitation: 'report' },
                { stepNo: 2, answer: 'Typhoon caused a grid power outage for 3 days', evidenceCitation: 'utility notice' },
            ].map((w) => ({ ...w, answer: `${w.answer} (natural disaster)` })),
        };
        const result = buildMaintenancePlan(plan({ d4Result: d4 }));
        expect(result.stops.map((s) => s.type)).toEqual(['outside-scope']);
        expect(result.proposals).toHaveLength(1);
        expect(result.proposals[0].controlType).toBe('inspection-frequency');
        expect(result.proposals[0].interval).toBeNull();
        expect(result.proposals[0].sourceCaseIds.length).toBeGreaterThan(0);
    });

    it('recurrence gaps for 3 dates with the action date in the middle → before/after day gaps', () => {
        const r = recurrenceIntervals(['2026-03-12', '2026-01-01', '2026-01-11'], '2026-02-01');
        expect(r.dates).toEqual(['2026-01-01', '2026-01-11', '2026-03-12']);
        expect(r.before).toEqual([10]);
        expect(r.after).toEqual([60]);
    });

    it('D4 not approved → refusal, no proposals', () => {
        const result = buildMaintenancePlan(plan({ d4Approved: false }));
        expect(result.refusal).toMatch(/D4/);
        expect(result.proposals).toEqual([]);
    });

    it('cites closed same-type cases only when they share the root-cause category', () => {
        const result = buildMaintenancePlan(plan({
            history: [
                { notificationId: '8D-A', foundDate: '2026-06-01', completionDate: '2026-06-20', rootCauseCategory: 'Machine', preventiveActions: ['Tool-life counter'] },
                { notificationId: '8D-B', foundDate: '2026-07-01', completionDate: '2026-07-20', rootCauseCategory: 'Method', preventiveActions: [] },
            ],
        }));
        expect(result.proposals[0].sourceCaseIds).toEqual(['8D-1', '8D-A']);
        expect(result.intervals.actionDate).toBe('2026-07-20');
        expect(result.intervals.after).toEqual([92]);
    });

    it('decisions survive regeneration and carry the server-side actor', () => {
        const first = buildMaintenancePlan(plan({}));
        const { plan: decided, proposal } = applyDecision(first, first.proposals[0].id, 'approve', 'ok', 'alice', '2026-10-02T00:00:00Z');
        expect(proposal).toMatchObject({ status: 'Approved', decidedBy: 'alice', note: 'ok' });
        const again = carryDecisions(decided, buildMaintenancePlan(plan({})));
        expect(again.proposals[0].status).toBe('Approved');
        expect(() => applyDecision(first, 'nope', 'reject', null, 'alice')).toThrow(/not found/);
    });
});
