/**
 * Test lưới an toàn.
 *
 * Đây là chỗ chống bịa cuối cùng: model có thể trả về một discipline nghe rất
 * thuyết phục mà không có fact nào chống lưng. Các test dưới đây dựng đúng những
 * kiểu trả về sai đó rồi khẳng định `postProcess` bắt được và GHI LẠI.
 */

import fs from 'node:fs';
import path from 'node:path';
import { mapCase } from '../caseMapper';
import { postProcess } from '../postProcess';
import { DISCIPLINE_CODES, type CaseContext, type DisciplineDraft, type EightDResult } from '../types';

const MOCK_DIR = path.resolve(__dirname, '../../../../../mock-data/clean');
const load = (n: string) => JSON.parse(fs.readFileSync(path.join(MOCK_DIR, n), 'utf-8'));

const ctxQ3 = mapCase(load('case-8D-10048412.json'));  // internal, đủ 3 loại action
const ctxQ1 = mapCase(load('case-8D-10048577.json'));  // customer complaint
const ctxGaps = mapCase(load('case-8D-10048651.json')); // thiếu preventive + fmea

function draft(code: string, over: Partial<DisciplineDraft> = {}): DisciplineDraft {
    return {
        code: code as DisciplineDraft['code'],
        sequence: 0,
        title: `Title ${code}`,
        summary: `Summary ${code}`,
        content: `Content ${code}`,
        actionItems: [],
        sources: ['header'],
        confidence: 0.9,
        dataBacked: true,
        ...over,
    };
}

/**
 * `data.rootCause` đầy đủ đúng như một model ngoan sẽ trả — chép từ context.
 * D4 nào thiếu phần này sẽ bị backfill sửa và GHI repairs, nên các test
 * "không báo chữa gì" phải xuất phát từ một D4 đã đủ ruột.
 */
function d4Data(ctx: ReturnType<typeof mapCase>) {
    return {
        rootCause: {
            statement: ctx.rootCause
                ? `${ctx.rootCause.category}: ${ctx.rootCause.description}`
                : 'Hypothesis statement long enough for the D4 contract.',
            fiveWhy: ctx.fiveWhy.map((r) => ({
                step: r.stepNo, why: r.question, answer: r.answer, evidence: r.evidenceCitation,
            })),
            ishikawaBoard: ctx.ishikawa.map((r) => ({
                category: r.category, finding: r.description, isRootCause: r.isRootCause, source: 'recorded',
            })),
            evidenceGaps: [],
        },
    };
}

function fullResult(over: Partial<EightDResult> = {}): EightDResult {
    return {
        internalSummary: 'Internal summary.',
        customerSummary: null,
        disciplines: DISCIPLINE_CODES.map((c) => draft(
            c,
            c === 'D6' ? { dataBacked: false } : c === 'D4' ? { data: d4Data(ctxQ3) } : {},
        )),
        ...over,
    };
}

describe('postProcess — đường thẳng', () => {
    it('giữ nguyên kết quả hợp lệ và không báo chữa gì', () => {
        const { result, repairs } = postProcess(fullResult(), ctxQ3);
        expect(result.disciplines).toHaveLength(8);
        expect(result.disciplines.map((d) => d.code)).toEqual([...DISCIPLINE_CODES]);
        expect(repairs).toEqual([]);
    });

    it('đánh số sequence lại theo thứ tự chuẩn, bỏ qua số model tự gán', () => {
        const r = fullResult();
        r.disciplines = r.disciplines.map((d) => ({ ...d, sequence: 99 }));
        const { result } = postProcess(r, ctxQ3);
        expect(result.disciplines.map((d) => d.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('sắp lại đúng thứ tự khi model trả lộn xộn', () => {
        const r = fullResult();
        r.disciplines = [...r.disciplines].reverse();
        const { result } = postProcess(r, ctxQ3);
        expect(result.disciplines.map((d) => d.code)).toEqual([...DISCIPLINE_CODES]);
    });
});

describe('postProcess — discipline thiếu hoặc thừa', () => {
    it('chèn placeholder cho discipline bị bỏ sót', () => {
        const r = fullResult();
        r.disciplines = r.disciplines.filter((d) => d.code !== 'D5');
        const { result, repairs } = postProcess(r, ctxQ3);

        expect(result.disciplines).toHaveLength(8);
        const d5 = result.disciplines.find((d) => d.code === 'D5')!;
        expect(d5.dataBacked).toBe(false);
        expect(d5.confidence).toBe(0);
        expect(repairs).toContain('Thiếu D5; chèn placeholder.');
    });

    it('bỏ discipline trùng, giữ bản đầu', () => {
        const r = fullResult();
        r.disciplines.push(draft('D2', { summary: 'Bản thứ hai' }));
        const { result, repairs } = postProcess(r, ctxQ3);

        expect(result.disciplines).toHaveLength(8);
        expect(result.disciplines.find((d) => d.code === 'D2')!.summary).toBe('Summary D2');
        expect(repairs.some((x) => /trùng D2/.test(x))).toBe(true);
    });

    it('bỏ mã lạ ngoài D1..D8', () => {
        const r = fullResult();
        r.disciplines.push(draft('D9'));
        const { result, repairs } = postProcess(r, ctxQ3);

        expect(result.disciplines).toHaveLength(8);
        expect(repairs.some((x) => /mã lạ/.test(x))).toBe(true);
    });

    it('trả đủ 8 placeholder khi model trả mảng rỗng', () => {
        const { result, repairs } = postProcess(fullResult({ disciplines: [] }), ctxQ3);
        expect(result.disciplines).toHaveLength(8);
        // 8 placeholder + các dòng backfill D4 (placeholder D4 cũng được chép
        // lại 5-Why/Ishikawa đã ghi — xem describe backfill bên dưới).
        expect(repairs.filter((x) => /chèn placeholder/.test(x))).toHaveLength(8);
    });
});

describe('postProcess — chống bịa', () => {
    it('luôn hạ dataBacked của D6 xuống false', () => {
        const r = fullResult();
        r.disciplines = r.disciplines.map((d) =>
            d.code === 'D6' ? { ...d, dataBacked: true, confidence: 0.95 } : d,
        );
        const { result, repairs } = postProcess(r, ctxQ3);

        expect(result.disciplines.find((d) => d.code === 'D6')!.dataBacked).toBe(false);
        expect(repairs.some((x) => /^D6 được đánh dataBacked=true/.test(x))).toBe(true);
    });

    it('hạ dataBacked khi khẳng định có dữ liệu mà sources rỗng', () => {
        const r = fullResult();
        r.disciplines = r.disciplines.map((d) =>
            d.code === 'D4' ? { ...d, sources: [] } : d,
        );
        const { result, repairs } = postProcess(r, ctxQ3);

        expect(result.disciplines.find((d) => d.code === 'D4')!.dataBacked).toBe(false);
        expect(repairs.some((x) => /D4: dataBacked=true nhưng không còn source/.test(x))).toBe(true);
    });

    it('hạ D7 khi CaseContext không có preventive action lẫn FMEA', () => {
        // Đây là phép thử quan trọng nhất: case-8D-10048651 cố ý thiếu cả hai.
        expect(ctxGaps.actions.preventive).toHaveLength(0);
        expect(ctxGaps.fmea).toBeNull();

        const { result, repairs } = postProcess(fullResult(), ctxGaps);

        expect(result.disciplines.find((d) => d.code === 'D7')!.dataBacked).toBe(false);
        expect(repairs.some((x) => /^D7: dataBacked=true nhưng CaseContext không có/.test(x))).toBe(true);
    });

    it('KHÔNG hạ D7 khi case có preventive action thật', () => {
        const { result } = postProcess(fullResult(), ctxQ3);
        expect(result.disciplines.find((d) => d.code === 'D7')!.dataBacked).toBe(true);
    });
});

describe('postProcess — làm sạch giá trị', () => {
    it('cắt summary quá dài', () => {
        const r = fullResult();
        r.disciplines = r.disciplines.map((d) =>
            d.code === 'D1' ? { ...d, summary: 'x'.repeat(700) } : d,
        );
        const { result, repairs } = postProcess(r, ctxQ3);

        expect(result.disciplines.find((d) => d.code === 'D1')!.summary).toHaveLength(500);
        expect(repairs.some((x) => /summary dài 700/.test(x))).toBe(true);
    });

    it.each([
        [1.4, 1],
        [-0.2, 0],
    ])('kẹp confidence %s về %s', (given, expected) => {
        const r = fullResult();
        r.disciplines = r.disciplines.map((d) =>
            d.code === 'D3' ? { ...d, confidence: given } : d,
        );
        const { result } = postProcess(r, ctxQ3);
        expect(result.disciplines.find((d) => d.code === 'D3')!.confidence).toBe(expected);
    });

    it('đặt confidence = 0 khi model trả về thứ không phải số', () => {
        const r = fullResult();
        r.disciplines = r.disciplines.map((d) =>
            d.code === 'D3' ? { ...d, confidence: 'high' as any } : d,
        );
        const { result, repairs } = postProcess(r, ctxQ3);

        expect(result.disciplines.find((d) => d.code === 'D3')!.confidence).toBe(0);
        expect(repairs.some((x) => /không phải số/.test(x))).toBe(true);
    });

    it('điền title mặc định khi model để trống', () => {
        const r = fullResult();
        r.disciplines = r.disciplines.map((d) => (d.code === 'D4' ? { ...d, title: '  ' } : d));
        const { result } = postProcess(r, ctxQ3);
        expect(result.disciplines.find((d) => d.code === 'D4')!.title).toBe('Root Cause Analysis');
    });
});

describe('postProcess — structured data.sources phải cùng bộ lọc với discipline.sources', () => {
    const d1GroundOnly = JSON.stringify({
        enabled: true,
        rules: [
            {
                id: 'D1_GROUNDING',
                type: 'sourcePattern',
                severity: 'error',
                enabled: true,
                pattern: '^(team\\.|precedents#)',
                message: 'Team identities must come from the current team or a cited precedent.',
            },
        ],
    });

    it('loại bỏ path không khớp pattern khỏi data.sources (D1)', () => {
        const r = fullResult();
        r.disciplines = r.disciplines.map((d) =>
            d.code === 'D1'
                ? {
                    ...d,
                    // sources cũ thì đúng pattern, sources mới (UI hiển thị) thì không
                    sources: ['team.leader'],
                    data: { sources: ['team', 'report[]', 'team.leader'] },
                }
                : d,
        );
        const { result, repairs } = postProcess(
            r,
            ctxQ3,
            undefined,
            undefined,
            undefined,
            { D1: d1GroundOnly },
        );
        const d1 = result.disciplines.find((d) => d.code === 'D1')!;
        expect(d1.data?.sources).toEqual(['team.leader']);
        expect(repairs.some((x) => /D1: filtered data\.sources against pattern/.test(x))).toBe(true);
    });

    it('KHÔNG đụng data.sources khi các path đều hợp lệ', () => {
        const r = fullResult();
        r.disciplines = r.disciplines.map((d) =>
            d.code === 'D1'
                ? {
                    ...d,
                    sources: ['team.leader', 'team.members#1'],
                    data: { sources: ['team.leader', 'team.members#1'] },
                }
                : d,
        );
        const { result, repairs } = postProcess(
            r,
            ctxQ3,
            undefined,
            undefined,
            [{ notificationId: 'X', team: [{ partnerName: 'A' }] }],
            { D1: d1GroundOnly },
        );
        const d1 = result.disciplines.find((d) => d.code === 'D1')!;
        expect(d1.data?.sources).toEqual(['team.leader', 'team.members#1']);
        expect(repairs.some((x) => /data\.sources/.test(x))).toBe(false);
    });

    it('áp dụng cùng bộ lọc khi path match pattern nhưng không giải được trên CaseContext', () => {
        // `precedents#999` khớp pattern nhưng vượt quá số tiền lệ — vocab check loại.
        const r = fullResult();
        r.disciplines = r.disciplines.map((d) =>
            d.code === 'D1'
                ? {
                    ...d,
                    sources: ['team.leader'],
                    data: { sources: ['team.leader', 'precedents#999'] },
                }
                : d,
        );
        const { result, repairs } = postProcess(
            r,
            ctxQ3,
            undefined,
            undefined,
            [{ notificationId: 'X', team: [] }],
            { D1: d1GroundOnly },
        );
        const d1 = result.disciplines.find((d) => d.code === 'D1')!;
        expect(d1.data?.sources).toEqual(['team.leader']);
        expect(repairs.some((x) => /D1: data\.sources không tồn tại trong CaseContext/.test(x))).toBe(true);
    });
});

describe('postProcess — ràng buộc Q1-ONLY-CUSTOMER-FIELDS', () => {
    it('bỏ customerSummary khi case là Q3 nội bộ', () => {
        const { result, repairs } = postProcess(
            fullResult({ customerSummary: 'Dear customer…' }),
            ctxQ3,
        );
        expect(result.customerSummary).toBeNull();
        expect(repairs.some((x) => /Case Q3 nhưng model vẫn sinh/.test(x))).toBe(true);
    });

    it('giữ customerSummary khi case là Q1 khách hàng', () => {
        const { result, repairs } = postProcess(
            fullResult({ customerSummary: 'Dear customer…' }),
            ctxQ1,
        );
        expect(result.customerSummary).toBe('Dear customer…');
        // Chỉ khẳng định về customerSummary. Trước đây test này đòi repairs RỖNG,
        // và điều đó vô tình khoá cả những luật không liên quan: từ khi case Q1 bị
        // ép `entryMode = 'outside-inspection'` (Q1 không có lô kiểm tra), D2 điền
        // được ô "how" và ghi một dòng chữa hoàn toàn đúng.
        expect(repairs.some((x) => /customerSummary/.test(x))).toBe(false);
    });

    it('báo chữa khi case Q1 mà model không sinh customerSummary', () => {
        const { repairs } = postProcess(fullResult({ customerSummary: null }), ctxQ1);
        expect(repairs.some((x) => /Case Q1 nhưng model không sinh/.test(x))).toBe(true);
    });

    it('coi chuỗi rỗng như null', () => {
        const { result } = postProcess(fullResult({ customerSummary: '   ' }), ctxQ1);
        expect(result.customerSummary).toBeNull();
    });
});

/**
 * Chế độ sinh từng bước gọi `postProcess` với ĐÚNG MỘT discipline.
 *
 * Không giới hạn phạm vi thì bảy bước kia bị coi là model bỏ sót và bị thay
 * bằng placeholder, nên kết quả vẫn là mảng D1..D8 — bên gọi lấy `[0]` sẽ nhận
 * ô D1 thay vì bước vừa sinh. Hệ quả thật đã xảy ra: mọi bước D2..D8 ghi đè lên
 * hàng D1 và báo cáo cuối cùng chỉ còn một dòng, không kèm lỗi nào.
 */
describe('postProcess — phạm vi từng bước', () => {
    it('trả về đúng bước được yêu cầu, không phải ô D1', () => {
        const { result } = postProcess(
            { internalSummary: '', customerSummary: null, disciplines: [draft('D4')] },
            ctxQ3, undefined, undefined, undefined, undefined, ['D4'],
        );

        expect(result.disciplines).toHaveLength(1);
        expect(result.disciplines[0].code).toBe('D4');
        expect(result.disciplines[0].summary).toBe('Summary D4');
    });

    it('giữ nguyên sequence chuẩn của bước, không phải vị trí trong tập con', () => {
        const { result } = postProcess(
            { internalSummary: '', customerSummary: null, disciplines: [draft('D7')] },
            ctxQ3, undefined, undefined, undefined, undefined, ['D7'],
        );
        expect(result.disciplines[0].sequence).toBe(7);
    });

    it('không báo "thiếu" cho những bước nằm ngoài phạm vi', () => {
        const { repairs } = postProcess(
            { internalSummary: '', customerSummary: null, disciplines: [draft('D2')] },
            ctxQ3, undefined, undefined, undefined, undefined, ['D2'],
        );
        expect(repairs.filter((r) => r.includes('Thiếu'))).toEqual([]);
    });

    it('vẫn chèn placeholder khi chính bước trong phạm vi bị thiếu', () => {
        const { result, repairs } = postProcess(
            { internalSummary: '', customerSummary: null, disciplines: [] },
            ctxQ3, undefined, undefined, undefined, undefined, ['D5'],
        );
        expect(result.disciplines).toHaveLength(1);
        expect(result.disciplines[0].code).toBe('D5');
        expect(repairs.some((r) => r.includes('Thiếu D5'))).toBe(true);
    });

    it('vẫn áp luật riêng của bước trong phạm vi — D6 không bao giờ dataBacked', () => {
        const { result } = postProcess(
            { internalSummary: '', customerSummary: null, disciplines: [draft('D6', { dataBacked: true })] },
            ctxQ3, undefined, undefined, undefined, undefined, ['D6'],
        );
        expect(result.disciplines[0].dataBacked).toBe(false);
    });

    it('bỏ trống phạm vi thì giữ nguyên hành vi cũ: đủ tám bước', () => {
        const { result } = postProcess(fullResult(), ctxQ3);
        expect(result.disciplines.map((d) => d.code)).toEqual([...DISCIPLINE_CODES]);
    });

    it('phạm vi rỗng cũng là hành vi cũ, không phải kết quả rỗng', () => {
        const { result } = postProcess(fullResult(), ctxQ3, undefined, undefined, undefined, undefined, []);
        expect(result.disciplines).toHaveLength(DISCIPLINE_CODES.length);
    });
});

/**
 * Backfill D4 tất định.
 *
 * D4 là bước cả báo cáo bị chấm theo, và chuỗi 5-Why, bảng Ishikawa, root cause
 * đã xác nhận ĐỀU nằm sẵn trong CaseContext. Model (nhất là model nhỏ chạy
 * nhanh) thỉnh thoảng bỏ sót — code phải chép lại được thay vì chấp nhận một
 * D4 khuyết.
 */
describe('postProcess — backfill D4 từ CaseContext', () => {
    const rc = (result: EightDResult) =>
        (result.disciplines.find((d) => d.code === 'D4')!.data as any).rootCause;

    it('model bỏ trống data: chép lại 5-Why, dựng đủ bảng 6M, đánh cờ root cause', () => {
        const r = fullResult();
        r.disciplines = r.disciplines.map((d) => (d.code === 'D4' ? { ...d, data: {} } : d));
        const { result, repairs } = postProcess(r, ctxQ3);

        const root = rc(result);
        expect(root.fiveWhy).toHaveLength(ctxQ3.fiveWhy.length);
        expect(root.fiveWhy.every((row: any) => String(row.answer).trim().length > 0)).toBe(true);
        expect(root.ishikawaBoard).toHaveLength(6);
        expect(root.ishikawaBoard.filter((row: any) => row.isRootCause)).toHaveLength(1);
        expect(String(root.statement).trim()).not.toBe('');
        expect(repairs.some((x) => /D4: rootCause\.fiveWhy trống/.test(x))).toBe(true);
    });

    it('row 5-Why thiếu answer thì điền lại từ bản ghi, giữ nguyên phần model viết', () => {
        const data = d4Data(ctxQ3);
        (data.rootCause.fiveWhy[0] as any).answer = '';
        const r = fullResult();
        r.disciplines = r.disciplines.map((d) => (d.code === 'D4' ? { ...d, data } : d));
        const { result, repairs } = postProcess(r, ctxQ3);

        const root = rc(result);
        expect(root.fiveWhy[0].answer).toBe(ctxQ3.fiveWhy[0].answer);
        expect(repairs.some((x) => /thiếu answer/.test(x))).toBe(true);
    });

    it('nhiều nhánh cùng mang cờ root cause thì chỉ giữ nhánh đã ghi', () => {
        const data = d4Data(ctxQ3);
        data.rootCause.ishikawaBoard = data.rootCause.ishikawaBoard.map((row) => ({ ...row, isRootCause: true }));
        const r = fullResult();
        r.disciplines = r.disciplines.map((d) => (d.code === 'D4' ? { ...d, data } : d));
        const { result, repairs } = postProcess(r, ctxQ3);

        const marked = rc(result).ishikawaBoard.filter((row: any) => row.isRootCause);
        expect(marked).toHaveLength(1);
        expect(marked[0].category).toBe(ctxQ3.rootCause!.category);
        expect(repairs.some((x) => /cùng mang cờ root cause/.test(x))).toBe(true);
    });

    it('case chưa điều tra: dựng khung 6M not assessed, KHÔNG bịa root cause', () => {
        const blankCtx = { ...ctxQ3, fiveWhy: [], ishikawa: [], rootCause: null };
        const r = fullResult();
        r.disciplines = r.disciplines.map((d) => (d.code === 'D4' ? { ...d, data: {} } : d));
        const { result } = postProcess(r, blankCtx as typeof ctxQ3);

        const root = rc(result);
        expect(root.ishikawaBoard).toHaveLength(6);
        expect(root.ishikawaBoard.every((row: any) => row.source === 'proposed' && row.finding === 'not assessed')).toBe(true);
        expect(root.ishikawaBoard.some((row: any) => row.isRootCause)).toBe(false);
        expect(root.fiveWhy).toBeUndefined();
    });

    it('D4 đã đủ ruột thì backfill không đụng vào và không báo chữa gì', () => {
        const { repairs } = postProcess(fullResult(), ctxQ3);
        expect(repairs.filter((x) => x.startsWith('D4:'))).toEqual([]);
    });
});

/**
 * Case CHƯA có điều tra: D4 dựng từ chẩn đoán độc lập.
 *
 * Pipeline có sẵn một lượt gọi CHUYÊN root cause (chẩn đoán mù) — nó tự dựng
 * 5-Why, tự chọn nhánh 6M, tự loại năm nhánh kia kèm lý do. Với case trống,
 * D4 phải là phép chiếu của kết quả đó chứ không trông chờ model viết báo cáo
 * "nghĩ lại" từ đầu.
 */
describe('postProcess — D4 dựng từ chẩn đoán độc lập khi case chưa điều tra', () => {
    const blankCtx = { ...ctxQ3, fiveWhy: [], ishikawa: [], rootCause: null } as typeof ctxQ3;
    const rc = (result: EightDResult) =>
        (result.disciplines.find((d) => d.code === 'D4')!.data as any).rootCause;

    function fakeIndependent() {
        return {
            finding: {
                rootCauseCategory: 'Machine',
                rootCauseStatement: 'Worn clamp pad on fixture #2 allowed 0.2 mm part shift during milling.',
                derivedFiveWhy: [
                    { stepNo: 1, question: 'Why was the hole position out of tolerance?', answer: 'The part shifted during milling.', evidence: 'inspections#1' },
                    { stepNo: 2, question: 'Why did the part shift?', answer: 'Fixture #2 clamp pad is worn 0.2 mm.', evidence: 'blind evidence: fixture finding' },
                ],
                ruledOut: [
                    { category: 'Man', reason: 'Defect is shift-independent.' },
                    { category: 'Method', reason: 'Parameters unchanged since PPAP.' },
                    { category: 'Material', reason: 'Batch certified within spec.' },
                    { category: 'Measurement', reason: 'Gauge R&R 8%.' },
                    { category: 'Environment', reason: 'Temperature logged stable.' },
                ],
                runnerUpCategory: null,
                runnerUpReason: null,
                confidence: 0.8,
                evidenceGaps: ['PM log for fixture #2'],
            },
            verdict: { recordedCategory: null, aiCategory: 'Machine', agrees: false, aiStepCount: 2, recordedStepCount: 0 },
            leaks: [],
        };
    }

    it('data trống: chuỗi 5-Why, bảng 6M và cờ root cause đều chiếu từ finding', () => {
        const r = fullResult();
        r.disciplines = r.disciplines.map((d) => (d.code === 'D4' ? { ...d, data: {} } : d));
        const { result, repairs } = postProcess(r, blankCtx, undefined, fakeIndependent());

        const root = rc(result);
        expect(root.fiveWhy).toHaveLength(2);
        expect(root.fiveWhy.every((row: any) => String(row.answer).trim().length > 0)).toBe(true);
        expect(root.ishikawaBoard).toHaveLength(6);
        const machine = root.ishikawaBoard.find((row: any) => row.category === 'Machine');
        expect(machine.isRootCause).toBe(true);
        expect(machine.source).toBe('proposed');
        expect(machine.finding).toContain('clamp pad');
        const man = root.ishikawaBoard.find((row: any) => row.category === 'Man');
        expect(man.finding).toBe('Defect is shift-independent.');
        expect(String(root.statement)).toContain('hypothesis');
        expect(root.evidenceGaps).toEqual(['PM log for fixture #2']);
        expect(repairs.some((x) => /chẩn đoán độc lập/.test(x))).toBe(true);
        // Dùng finding thì phải trích dẫn nó — luật grounding của D4.
        expect(result.disciplines.find((d) => d.code === 'D4')!.sources).toContain('independent');
    });

    it('chuỗi model khuyết answer bị thay NGUYÊN KHỐI bằng chuỗi finding, không vá lai', () => {
        const r = fullResult();
        r.disciplines = r.disciplines.map((d) => (d.code === 'D4'
            ? { ...d, data: { rootCause: { fiveWhy: [{ step: 1, why: 'Why did it fail?', answer: '' }] } } }
            : d));
        const { result, repairs } = postProcess(r, blankCtx, undefined, fakeIndependent());

        const root = rc(result);
        expect(root.fiveWhy).toHaveLength(2);
        expect(root.fiveWhy[0].why).toBe('Why was the hole position out of tolerance?');
        expect(repairs.some((x) => /khuyết answer.*chẩn đoán độc lập/.test(x))).toBe(true);
    });

    it('chuỗi model ĐỦ answer thì được giữ nguyên — finding không đè output tốt', () => {
        const ownChain = [
            { step: 1, why: 'Why out of tolerance?', answer: 'Part shifted.', evidence: 'inspections#1' },
        ];
        const r = fullResult();
        r.disciplines = r.disciplines.map((d) => (d.code === 'D4'
            ? { ...d, data: { rootCause: { statement: 'Model statement long enough for the contract.', fiveWhy: ownChain } } }
            : d));
        const { result } = postProcess(r, blankCtx, undefined, fakeIndependent());
        expect(rc(result).fiveWhy).toHaveLength(1);
        expect(rc(result).fiveWhy[0].answer).toBe('Part shifted.');
    });

    it('bản ghi vẫn thắng finding khi case ĐÃ có điều tra', () => {
        const r = fullResult();
        r.disciplines = r.disciplines.map((d) => (d.code === 'D4' ? { ...d, data: {} } : d));
        const { result } = postProcess(r, ctxQ3, undefined, fakeIndependent());

        const root = rc(result);
        expect(root.fiveWhy).toHaveLength(ctxQ3.fiveWhy.length);
        const marked = root.ishikawaBoard.filter((row: any) => row.isRootCause);
        expect(marked).toHaveLength(1);
        expect(marked[0].category).toBe(ctxQ3.rootCause!.category);
        expect(marked[0].source).toBe('recorded');
    });
});

describe('postProcess — D3/D5/D7 Action Assignee Matching', () => {
    const mockTeamCtx = {
        ...ctxQ3,
        team: {
            leader: 'DungTruonghyhy',
            members: [
                { name: 'Karl Wagner', role: 'Maintenance Planner', functionTitle: 'Maintenance' },
                { name: 'Minh Dinh', role: 'Production Engineer', functionTitle: 'Production' },
                { name: 'Anna Schmidt', role: 'Quality Engineer', functionTitle: 'Quality' },
            ],
            gaps: [],
        },
    } as unknown as CaseContext;

    it('tự động gán assignee từ D1 team roster cho hành động D3, D5, D7 khi owner unassigned hoặc generic role', () => {
        const d1Draft: DisciplineDraft = {
            ...draft('D1'),
            data: {
                team: {
                    roster: [
                        { name: 'Karl Wagner', organizationalRole: 'Maintenance Planner', caseResponsibility: 'Tooling and machine calibration' },
                        { name: 'Minh Dinh', organizationalRole: 'Production Engineer', caseResponsibility: 'NC program and machining parameters' },
                        { name: 'Anna Schmidt', organizationalRole: 'Quality Engineer', caseResponsibility: 'Inspection, CMM measurements, FMEA update' },
                    ],
                },
            },
        };

        const d3Draft: DisciplineDraft = {
            ...draft('D3'),
            data: {
                'containment.actions': [
                    { action: 'Quarantine 26 rotor shafts from batch B-61200 and perform 100% roughness check', status: 'Planned' },
                    { action: 'Remove grinding wheel WC-GRIND-04-WHEEL1 and tag for maintenance evaluation', status: 'Planned' },
                ],
            },
        };

        const d5Draft: DisciplineDraft = {
            ...draft('D5'),
            data: {
                'corrective.actions': [
                    { action: 'Replace and dress grinding wheel WC-GRIND-04-WHEEL1', owner: 'Unassigned (Maintenance Engineer)', status: 'Planned' },
                    { action: 'Audit NC program feed rate and spindle speed parameters', owner: 'Production Engineer', status: 'Planned' },
                ],
            },
        };

        const d7Draft: DisciplineDraft = {
            ...draft('D7'),
            data: {
                'preventive.actions': [
                    { action: 'Update FMEA-GRIND-2024 failure mode and prevention controls', owner: 'Process Engineer · Quality Engineer', status: 'Planned' },
                ],
            },
        };

        const r: EightDResult = {
            internalSummary: 'Summary',
            customerSummary: null,
            disciplines: [d1Draft, draft('D2'), d3Draft, draft('D4', { data: d4Data(ctxQ3) }), d5Draft, draft('D6', { dataBacked: false }), d7Draft, draft('D8')],
        };

        const { result, repairs } = postProcess(r, mockTeamCtx);

        const d3Res = result.disciplines.find((d) => d.code === 'D3');
        const d5Res = result.disciplines.find((d) => d.code === 'D5');
        const d7Res = result.disciplines.find((d) => d.code === 'D7');

        const d3Actions = (d3Res?.data as any)['containment.actions'];
        expect(d3Actions[0].owner).toBe('Anna Schmidt (Quality Engineer)'); // Quality Engineer matches quarantine/check
        expect(d3Actions[1].owner).toBe('Karl Wagner (Maintenance Planner)'); // Maintenance Planner matches maintenance

        const d5Actions = (d5Res?.data as any)['corrective.actions'];
        expect(d5Actions[0].owner).toBe('Karl Wagner (Maintenance Planner)'); // Maintenance
        expect(d5Actions[1].owner).toBe('Minh Dinh (Production Engineer)'); // Production

        const d7Actions = (d7Res?.data as any)['preventive.actions'];
        expect(d7Actions[0].owner).toBe('Anna Schmidt (Quality Engineer)'); // FMEA / Quality

        expect(repairs.some((x) => /gán người phụ trách/.test(x))).toBe(true);
    });

    it('bổ sung role vào owner khi model đã gán đúng tên thành viên trong team D1', () => {
        const d3Draft: DisciplineDraft = {
            ...draft('D3'),
            data: {
                'containment.actions': [
                    { action: 'Quarantine parts', owner: 'Karl Wagner', status: 'Planned' },
                ],
            },
        };

        const r: EightDResult = {
            internalSummary: '',
            customerSummary: null,
            disciplines: [d3Draft],
        };

        const { result } = postProcess(r, mockTeamCtx, undefined, undefined, undefined, {}, ['D3']);
        const d3Actions = (result.disciplines[0].data as any)['containment.actions'];
        expect(d3Actions[0].owner).toBe('Karl Wagner (Maintenance Planner)');
    });
});
