/**
 * Test kiểm tra `sources`.
 *
 * Bộ test này được viết lại sau khi chạy thật 4 case với AI Core. Bản đầu dùng
 * danh sách đường dẫn liệt kê tay và báo sai 4 chỗ: model trích
 * `product.batchId`, `header.quantityExtent`, `header.status`, `origin` — đều
 * là trường CÓ THẬT mà danh sách của tôi quá thô nên không chứa.
 *
 * Vì vậy khối "đường dẫn model thật sự sinh ra" bên dưới chép nguyên văn từ
 * output AI Core. Đó là hồi quy quan trọng nhất ở đây: chúng phải luôn hợp lệ.
 */

import fs from 'node:fs';
import path from 'node:path';
import { mapCase } from '../caseMapper';
import { buildSourceVocabulary, checkSources } from '../sourceVocabulary';
import { postProcess } from '../postProcess';
import { DISCIPLINE_CODES, type DisciplineDraft, type EightDResult } from '../types';

const MOCK_DIR = path.resolve(__dirname, '../../../../../mock-data/clean');
const load = (n: string) => JSON.parse(fs.readFileSync(path.join(MOCK_DIR, n), 'utf-8'));

// 3 bước 5-Why · 2 inspection · 1 mỗi loại action · 4 người trong team
const ctx = mapCase(load('case-8D-10048412.json'));

const enrichment = {
    unmapped: [],
    derivedFacts: ['fact one', 'fact two', 'fact three'],
    dataQualityNotes: [],
    severity: 'High',
    severityRationale: 'because',
};

describe('đường dẫn model thật sự sinh ra khi chạy AI Core', () => {
    const vocab = buildSourceVocabulary(ctx, enrichment);

    // Chép nguyên văn từ output của gemini-2.5-pro trên 4 case mock.
    it.each([
        'origin',
        'header',
        'header.status',
        'header.quantityExtent',
        'product',
        'product.batchId',
        'inspections#1',
        'inspections#2',
        'isIsNot',
        'rootCause',
        'ishikawa',
        'ishikawa#2',
        'ishikawa.Machine',
        'ishikawa.Measurement',
        'ishikawa.Environment',
        'fiveWhy',
        'fiveWhy#1',
        'fiveWhy#3',
        'actions.containment#1',
        'actions.corrective#1',
        'actions.preventive#1',
        'team',
        'team.leader',
        'team.members',
        'fmea',
        'copqEur',
        'lessonsLearned',
        'customer',
        'enrichment.derivedFacts#1',
        'enrichment.derivedFacts#3',
    ])('%s giải được', (p) => {
        expect(vocab.has(p)).toBe(true);
    });
});

describe('giải đường dẫn — chấp nhận', () => {
    const vocab = buildSourceVocabulary(ctx, enrichment);

    it('chấp nhận trường lồng sâu hơn một cấp', () => {
        expect(vocab.has('rootCause.category')).toBe(true);
        expect(vocab.has('lessonsLearned.whatWorked')).toBe(true);
        expect(vocab.has('team.leader.partnerName')).toBe(true);
    });

    it('chấp nhận phần tử mảng rồi vào trường của nó', () => {
        expect(vocab.has('fiveWhy#2.evidenceCitation')).toBe(true);
        expect(vocab.has('actions.containment#1.status')).toBe(true);
    });

    it('chấp nhận trỏ vào trường có giá trị null — đó là sự thật, không phải bịa', () => {
        // Case này chưa đóng nên completion_date là null.
        expect(ctx.header.completionDate).toBeNull();
        expect(vocab.has('header.completionDate')).toBe(true);
    });

    it('chấp nhận mảng — gaps hoặc unmapped', () => {
        expect(vocab.has('gaps')).toBe(true);
        expect(vocab.has('gaps#1')).toBe(true);
    });
});

describe('giải đường dẫn — từ chối', () => {
    const vocab = buildSourceVocabulary(ctx, enrichment);

    it('từ chối chỉ số vượt biên — dấu hiệu bịa rõ nhất', () => {
        expect(ctx.fiveWhy).toHaveLength(3);
        expect(vocab.has('fiveWhy#4')).toBe(false);
        expect(vocab.has('fiveWhy#7')).toBe(false);
        expect(vocab.has('inspections#9')).toBe(false);
    });

    it('từ chối chỉ số 0 — quy ước đếm từ 1', () => {
        expect(vocab.has('fiveWhy#0')).toBe(false);
    });

    it('từ chối chỉ số action vượt số dòng thật của loại đó', () => {
        expect(ctx.actions.containment).toHaveLength(1);
        expect(vocab.has('actions.containment#1')).toBe(true);
        expect(vocab.has('actions.containment#2')).toBe(false);
    });

    it('từ chối category Ishikawa bịa', () => {
        expect(vocab.has('ishikawa.Machine')).toBe(true);
        expect(vocab.has('ishikawa.Management')).toBe(false);
        expect(vocab.has('ishikawa.Money')).toBe(false);
    });

    it('từ chối tên trường không tồn tại', () => {
        expect(vocab.has('header.sapSystem')).toBe(false);
        expect(vocab.has('product.vendorId')).toBe(false);
        expect(vocab.has('maintenanceLog')).toBe(false);
    });

    it('từ chối văn xuôi thay vì đường dẫn', () => {
        expect(vocab.has('the maintenance log')).toBe(false);
        expect(vocab.has('SAP EQUI/AFIH')).toBe(false);
        expect(vocab.has('')).toBe(false);
    });

    it('từ chối chỉ số đặt trên thứ không phải mảng', () => {
        expect(vocab.has('header#1')).toBe(false);
    });

    it('từ chối derivedFacts vượt số phần tử enrichment thật sự có', () => {
        expect(vocab.has('enrichment.derivedFacts#3')).toBe(true);
        expect(vocab.has('enrichment.derivedFacts#4')).toBe(false);
    });

    it('không có enrichment thì mọi chỉ số derivedFacts đều bị từ chối', () => {
        const bare = buildSourceVocabulary(ctx);
        expect(bare.has('enrichment.derivedFacts')).toBe(true);
        expect(bare.has('enrichment.derivedFacts#1')).toBe(false);
    });
});

describe('giải đường dẫn — khác biệt giữa các case', () => {
    it('case nhiều containment hơn thì chấp nhận chỉ số cao hơn', () => {
        const q1 = mapCase(load('case-8D-10048577.json'));
        expect(buildSourceVocabulary(q1).has('actions.containment#2')).toBe(true);
    });

    it('case không có preventive action thì từ chối mọi chỉ số preventive', () => {
        const gaps = mapCase(load('case-8D-10048651.json'));
        const vocab = buildSourceVocabulary(gaps);

        expect(gaps.actions.preventive).toHaveLength(0);
        expect(vocab.has('actions.preventive#1')).toBe(false);
        // Dạng trần vẫn hợp lệ — trỏ vào mảng rỗng là nói sự thật.
        expect(vocab.has('actions.preventive')).toBe(true);
    });

    it('case thiếu FMEA vẫn cho trỏ vào fmea — giá trị null là sự thật', () => {
        const gaps = mapCase(load('case-8D-10048651.json'));
        expect(gaps.fmea).toBeNull();
        expect(buildSourceVocabulary(gaps).has('fmea')).toBe(true);
    });

    it('case có gap thì gaps#N giải được đúng số lượng', () => {
        const gaps = mapCase(load('case-8D-10048651.json'));
        const vocab = buildSourceVocabulary(gaps);

        expect(gaps.gaps.length).toBeGreaterThanOrEqual(2);
        expect(vocab.has('gaps#1')).toBe(true);
        expect(vocab.has('gaps#2')).toBe(true);
        expect(vocab.has(`gaps#${gaps.gaps.length + 1}`)).toBe(false);
    });

    it('case 5-Why dài hơn thì chấp nhận bước thứ 4', () => {
        const method = mapCase(load('case-8D-10048603.json'));
        expect(buildSourceVocabulary(method).has('fiveWhy#4')).toBe(true);
        expect(buildSourceVocabulary(method).has('fiveWhy#5')).toBe(false);
    });
});

describe('checkSources', () => {
    it('tách phần giải được khỏi phần không', () => {
        const vocab = buildSourceVocabulary(ctx, enrichment);
        const { known, unknown } = checkSources(
            ['header.status', 'fiveWhy#2', 'fiveWhy#9', 'maintenance log'],
            vocab,
        );
        expect(known).toEqual(['header.status', 'fiveWhy#2']);
        expect(unknown).toEqual(['fiveWhy#9', 'maintenance log']);
    });
});

// ─────────────────────────────────────────────────────────────────────────────

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

function fullResult(over: Partial<EightDResult> = {}): EightDResult {
    return {
        internalSummary: 'Internal summary.',
        customerSummary: null,
        disciplines: DISCIPLINE_CODES.map((c) => draft(c, c === 'D6' ? { dataBacked: false } : {})),
        ...over,
    };
}

describe('postProcess — thực thi kiểm tra sources', () => {
    it('không báo chữa với đúng bộ sources model đã sinh ra khi chạy thật', () => {
        // Hồi quy cho 4 chỗ báo sai của bản liệt kê tay.
        const r = fullResult();
        r.disciplines = r.disciplines.map((d) => {
            if (d.code === 'D3') return { ...d, sources: ['actions.containment#1', 'product.batchId', 'header.quantityExtent'] };
            if (d.code === 'D8') return { ...d, sources: ['lessonsLearned', 'team', 'header.status'] };
            return d;
        });

        const { repairs } = postProcess(r, ctx, enrichment);
        expect(repairs.filter((x) => /sources không tồn tại/.test(x))).toEqual([]);
    });

    it('loại source không giải được và ghi lại', () => {
        const r = fullResult();
        r.disciplines = r.disciplines.map((d) =>
            d.code === 'D4' ? { ...d, sources: ['rootCause', 'fiveWhy#99'] } : d,
        );
        const { result, repairs } = postProcess(r, ctx, enrichment);

        const d4 = result.disciplines.find((d) => d.code === 'D4')!;
        expect(d4.sources).toEqual(['rootCause']);
        expect(d4.dataBacked).toBe(true); // vẫn còn một source hợp lệ
        expect(repairs.some((x) => /D4: sources không tồn tại.*fiveWhy#99/.test(x))).toBe(true);
    });

    it('hạ dataBacked khi TOÀN BỘ sources đều không giải được', () => {
        const r = fullResult();
        r.disciplines = r.disciplines.map((d) =>
            d.code === 'D5' ? { ...d, sources: ['SAP maintenance system', 'operator interview'] } : d,
        );
        const { result, repairs } = postProcess(r, ctx, enrichment);

        const d5 = result.disciplines.find((d) => d.code === 'D5')!;
        expect(d5.sources).toEqual([]);
        expect(d5.dataBacked).toBe(false);
        expect(repairs.some((x) => /D5: dataBacked=true nhưng không còn source/.test(x))).toBe(true);
    });
});
