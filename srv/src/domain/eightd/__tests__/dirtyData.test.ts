/**
 * Pipeline với dữ liệu BẨN.
 *
 * ── Vì sao bộ test này tồn tại ──
 * `clean/` được dựng ngược từ báo cáo 8D đã hoàn thành nên sạch một cách phi
 * thực tế. `dirty/` là CHÍNH những case đó, ghi lại theo kiểu SAP QM thật: ngày
 * định dạng Đức, dấu phẩy thập phân, số đo nằm trong câu văn, chỉ 2-3 nhánh
 * Ishikawa được điều tra, 5-Why cụt, action chưa phân loại, cờ root cause là
 * 'x' thay vì 'Y'.
 *
 * Vì hai bộ mô tả cùng một sự thật, mọi khác biệt trong kết quả đều đến từ CHẤT
 * LƯỢNG GHI CHÉP chứ không phải nội dung. Đó là điều kiện để phép so sánh có
 * nghĩa.
 *
 * ── Bộ test này khẳng định điều gì ──
 * Dữ liệu bẩn phải ĐI ĐƯỢC ĐẾN AI. Không phải ra kết quả hoàn hảo — chỉ là
 * không bị chặn ở cổng, và mọi chỗ mỏng đều được ghi lại để model biết.
 */

import fs from 'node:fs';
import path from 'node:path';
import { classifyAction, extractDeepCase, mapCase, normalizeDate } from '../caseMapper';
import { blockingIssues, qualityIssues, validateDataset } from '../datasetValidator';
import { auditBlindEvidence, buildBlindEvidence } from '../blindEvidence';

const MOCK = path.resolve(__dirname, '../../../../../mock-data');
const CLEAN = path.join(MOCK, 'clean');
const DIRTY = path.join(MOCK, 'dirty');

const load = (dir: string, f: string) =>
    JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));

/**
 * Hình dạng đã chuẩn hoá của một file, dùng khi test cần soi vào dữ liệu THÔ.
 *
 * Đọc thẳng `raw.data.…` hay `raw.material.…` là buộc test vào một định dạng cụ
 * thể — đúng thứ đã hỏng khi mock data chuyển sang Deep Structure. Đi qua
 * `extractDeepCase` thì test nói về nội dung, không nói về định dạng.
 */
const loadRows = (dir: string, f: string) => extractDeepCase(load(dir, f))!;
const listCases = (dir: string) =>
    fs.readdirSync(dir).filter((f) => f.startsWith('case-') && f.endsWith('.json')).sort();

const CLEAN_CASES = listCases(CLEAN);
const DIRTY_CASES = listCases(DIRTY);

/** `clean/case-8D-10048412.json` ↔ `dirty/case-8D-90048412.json` */
const twin = (cleanFile: string) => cleanFile.replace('8D-1', '8D-9');

// ─────────────────────────────────────────────────────────────────────────────

describe('hai bộ dữ liệu', () => {
    it('ghép cặp một-một', () => {
        expect(CLEAN_CASES.length).toBeGreaterThanOrEqual(12);
        expect(DIRTY_CASES).toEqual(CLEAN_CASES.map(twin));
    });
});

describe('validator KHÔNG chặn dữ liệu bẩn', () => {
    it.each(DIRTY_CASES)('%s đi qua được cổng vào', (f) => {
        // Đây là khẳng định trung tâm. Luật cũ chặn cả 12 case này.
        expect(blockingIssues(validateDataset(load(DIRTY, f)))).toEqual([]);
    });

    it.each(DIRTY_CASES)('%s vẫn được ghi nhận là dữ liệu mỏng', (f) => {
        // Không chặn KHÔNG có nghĩa là im lặng. Mọi chỗ mỏng phải được báo, nếu
        // không model sẽ viết một báo cáo tự tin trên nền dữ liệu khuyết.
        expect(qualityIssues(validateDataset(load(DIRTY, f))).length).toBeGreaterThan(0);
    });

    it('bản bẩn luôn có nhiều cảnh báo hơn bản sạch tương ứng', () => {
        for (const f of CLEAN_CASES) {
            const c = qualityIssues(validateDataset(load(CLEAN, f))).length;
            const d = qualityIssues(validateDataset(load(DIRTY, twin(f)))).length;
            expect(d).toBeGreaterThan(c);
        }
    });
});

describe('mapper đọc được dữ liệu bẩn', () => {
    it.each(DIRTY_CASES)('%s — không ném lỗi', (f) => {
        expect(() => mapCase(load(DIRTY, f))).not.toThrow();
    });

    it.each(DIRTY_CASES)('%s — mã đã được cắt khoảng trắng', (f) => {
        const ctx = mapCase(load(DIRTY, f));
        const raw = loadRows(DIRTY, f).materials[0].material_id;

        expect(raw).toMatch(/^\s|\s$/);              // dữ liệu gốc có dính
        expect(ctx.product.materialId).toBe(raw.trim());
    });

    it.each(DIRTY_CASES)('%s — ngày đã về ISO', (f) => {
        const ctx = mapCase(load(DIRTY, f));
        if (ctx.header.foundDate) {
            expect(ctx.header.foundDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
        if (ctx.header.completionDate) {
            expect(ctx.header.completionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
    });

    it.each(DIRTY_CASES)('%s — cờ root cause: hiểu được thì khớp, mất thì null', (f) => {
        const ctx = mapCase(load(DIRTY, f));
        const clean = mapCase(load(CLEAN, f.replace('8D-9', '8D-1')));

        const anyFlag = loadRows(DIRTY, f).causes_ishikawa.some((r: any) =>
            ['y', 'x', 'ja', 'yes'].includes(String(r.is_root_cause ?? '').trim().toLowerCase()));

        if (anyFlag) {
            // Cờ ghi bằng 'x' hay 'ja' vẫn phải nhận ra, và phải ra ĐÚNG nhánh
            // như bản sạch — đây là fact, không đổi theo chất lượng ghi chép.
            expect(ctx.rootCause?.category).toBe(clean.rootCause?.category);
        } else {
            // Không ai đánh dấu: mapper KHÔNG được bịa ra một nhánh. Đây là
            // kịch bản đáng giá nhất — AI thành người duy nhất kết luận, thay
            // vì người phản biện kết luận của kỹ sư.
            expect(ctx.rootCause).toBeNull();
            expect(ctx.gaps.some((g) => /root cause/i.test(g))).toBe(true);
        }
    });

    it('có cả case được đánh dấu lẫn case không ai đánh dấu', () => {
        // Bộ dữ liệu phải chứa cả hai tình huống, nếu không thì nhánh xử lý còn
        // lại không bao giờ được chạy thử.
        const flagged = DIRTY_CASES.filter((f) => mapCase(load(DIRTY, f)).rootCause !== null);
        expect(flagged.length).toBeGreaterThan(0);
        expect(flagged.length).toBeLessThan(DIRTY_CASES.length);
    });

    it.each(DIRTY_CASES)('%s — báo nhiều lỗ hổng hơn bản sạch', (f) => {
        const dirty = mapCase(load(DIRTY, f));
        const clean = mapCase(load(CLEAN, f.replace('8D-9', '8D-1')));
        expect(dirty.gaps.length).toBeGreaterThan(clean.gaps.length);
    });

    it('ô trống kiểu người nhập được quy về null, không lọt vào báo cáo', () => {
        for (const f of DIRTY_CASES) {
            const ctx = mapCase(load(DIRTY, f));
            const values = [
                ctx.isIsNot?.is, ctx.isIsNot?.isNot, ctx.isIsNot?.notes,
                ctx.lessonsLearned?.whatWorked, ctx.lessonsLearned?.whatDidnt,
                ctx.customer.plantContact, ctx.customer.slaResponseDue,
            ];
            for (const v of values) {
                if (v == null) continue;
                // Chuỗi 'N/A - ...' được giữ nguyên có chủ đích, nên chỉ bắt ô
                // trống ĐỨNG MỘT MÌNH.
                expect(['-', '--', 'n.a.', 'k.a.', 'na', '']).not.toContain(
                    String(v).trim().toLowerCase(),
                );
            }
        }
    });
});

describe('bằng chứng mù vẫn dựng được', () => {
    it.each(DIRTY_CASES)('%s — đủ input tối thiểu để chẩn đoán', (f) => {
        const ctx = mapCase(load(DIRTY, f));
        const evidence = buildBlindEvidence(ctx);

        expect(evidence.notificationId).toBeTruthy();
        expect(evidence.investigationFindings.length).toBeGreaterThan(0);
        expect(evidence.inspections.length).toBeGreaterThan(0);
    });

    it.each(DIRTY_CASES)('%s — không rò đáp án', (f) => {
        const ctx = mapCase(load(DIRTY, f));
        expect(auditBlindEvidence(buildBlindEvidence(ctx), ctx)).toEqual([]);
    });

    it('bằng chứng mù bản bẩn hẹp hơn bản sạch — đúng kỳ vọng', () => {
        const d = buildBlindEvidence(mapCase(load(DIRTY, DIRTY_CASES[0])));
        const c = buildBlindEvidence(mapCase(load(CLEAN, CLEAN_CASES[0])));
        expect(d.investigationFindings.length).toBeLessThan(c.investigationFindings.length);
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('normalizeDate', () => {
    it.each([
        ['2026-08-03', '2026-08-03'],
        ['03.08.2026', '2026-08-03'],
        ['3.8.2026', '2026-08-03'],
        ['03/08/2026', '2026-08-03'],
        ['03-AUG-26', '2026-08-03'],
        ['03-aug-26', '2026-08-03'],
    ])('%s → %s', (input, expected) => {
        expect(normalizeDate(input)).toBe(expected);
    });

    it.each(['', '   ', '-', 'n.a.', 'k.A.', null, undefined])('%s → null', (v) => {
        expect(normalizeDate(v)).toBeNull();
    });

    it('định dạng lạ giữ nguyên chuỗi — thà không hiểu còn hơn đoán sai', () => {
        expect(normalizeDate('KW 32/2026')).toBe('KW 32/2026');
    });
});

describe('classifyAction', () => {
    it.each([
        ['Containment', 'Containment'],
        ['Sofortmassnahme', 'Containment'],
        ['SM', 'Containment'],
        ['Corrective', 'Corrective'],
        ['Korrekturmassnahme', 'Corrective'],
        ['KM', 'Corrective'],
        ['Abstellmassnahme', 'Corrective'],
        ['Preventive', 'Preventive'],
        ['Vorbeugemassnahme', 'Preventive'],
        ['vorbeugend', 'Preventive'],
        ['VM', 'Preventive'],
    ])('%s → %s', (label, expected) => {
        expect(classifyAction(label)).toBe(expected);
    });

    it.each(['', '   ', null, undefined, 'Massnahme', 'TODO'])(
        '%s → null, và được ghi vào gaps thay vì nhét bừa',
        (label) => {
            expect(classifyAction(label)).toBeNull();
        },
    );
});
