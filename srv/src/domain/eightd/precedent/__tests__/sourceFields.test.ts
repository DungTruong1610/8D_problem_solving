/**
 * Test việc làm phẳng payload SAP và dựng danh mục field.
 *
 * ── Vì sao bộ test này cần thiết ──
 * Toàn bộ tính năng "kéo field bất kỳ vào profile chấm điểm" đứng trên một giả
 * định: đường dẫn làm phẳng lúc NẠP KHO và đường dẫn làm phẳng lúc CHẤM case
 * đang mở là một. Lệch nhau ở hai đầu là lỗi im lặng kinh điển của kho này —
 * không bao giờ khớp, mà cũng không bao giờ báo lỗi. Test chạy trên chính mock
 * data thật, vì một hàm đúng trên fixture tự chế mà sai trên payload thật thì
 * vô dụng.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
    buildSourceFieldCatalog,
    flattenPayload,
    parseAttributes,
    type AttributeMap,
} from '../sourceFields';
import { scoreCase, type Criterion, type ScorableCase } from '../scoring';

const MOCK_DIR = path.resolve(__dirname, '../../../../../../mock-data/clean');

function loadMockPayloads(): unknown[] {
    if (!fs.existsSync(MOCK_DIR)) return [];
    return fs.readdirSync(MOCK_DIR)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .map((f) => JSON.parse(fs.readFileSync(path.join(MOCK_DIR, f), 'utf8')));
}

describe('flattenPayload', () => {
    it('làm phẳng object lồng nhau thành đường dẫn có dấu chấm', () => {
        const flat = flattenPayload({
            notificationId: '8D-1',
            material: { materialId: 'MAT-1', materialGroup: 'GRP-A' },
        });

        expect(flat.notificationId).toBe('8D-1');
        expect(flat['material.materialId']).toBe('MAT-1');
        expect(flat['material.materialGroup']).toBe('GRP-A');
    });

    it('gộp mảng thành nhiều giá trị dưới một đường dẫn có `[]`', () => {
        const flat = flattenPayload({
            inspections: [
                { characteristic: 'Roughness', measuredValue: '3.2' },
                { characteristic: 'Diameter', measuredValue: '10.1' },
            ],
        });

        expect(flat['inspections[].characteristic']).toEqual(['Roughness', 'Diameter']);
        expect(flat['inspections[].measuredValue']).toEqual(['3.2', '10.1']);
    });

    it('khử trùng lặp trong mảng — đo ba lần cùng một đặc tính vẫn là một đặc tính', () => {
        const flat = flattenPayload({
            inspections: [
                { characteristic: 'Roughness' },
                { characteristic: 'Roughness' },
                { characteristic: 'Diameter' },
            ],
        });

        expect(flat['inspections[].characteristic']).toEqual(['Roughness', 'Diameter']);
    });

    it('bỏ giá trị rỗng và null — "không có" không phải một giá trị so được', () => {
        const flat = flattenPayload({
            a: '', b: null, c: undefined, d: '  ', e: 'kept',
        });

        expect(Object.keys(flat)).toEqual(['e']);
    });

    it('cắt khoảng trắng thừa để hai bên so được với nhau', () => {
        expect(flattenPayload({ id: '  MAT-1  ' }).id).toBe('MAT-1');
    });

    it('giữ số và boolean dưới dạng chuỗi so được', () => {
        const flat = flattenPayload({ teamSize: 4, active: true, zero: 0 });
        expect(flat.teamSize).toBe('4');
        expect(flat.active).toBe('true');
        // 0 là một giá trị thật, không phải "trống" — mất nó là mất một fact.
        expect(flat.zero).toBe('0');
    });

    it('bóc vỏ OData `value` để đường dẫn không dính tiền tố', () => {
        const wrapped = flattenPayload({ value: [{ notificationId: '8D-1' }] });
        expect(wrapped.notificationId).toBe('8D-1');
        expect(Object.keys(wrapped).some((k) => k.startsWith('value'))).toBe(false);
    });

    it('không lặp vô hạn với cấu trúc tự tham chiếu', () => {
        const cyclic: Record<string, unknown> = { name: 'root' };
        cyclic.self = cyclic;
        expect(() => flattenPayload(cyclic)).not.toThrow();
    });
});

describe('parseAttributes', () => {
    it('trả map rỗng cho giá trị hỏng thay vì ném', () => {
        expect(parseAttributes('{ not json')).toEqual({});
        expect(parseAttributes(null)).toEqual({});
        expect(parseAttributes('')).toEqual({});
        // Mảng JSON hợp lệ nhưng sai hình dạng cũng phải trả rỗng — nếu không thì
        // `attributes[path]` trả về phần tử theo chỉ số, tức là dữ liệu rác.
        expect(parseAttributes('[1,2,3]')).toEqual({});
    });

    it('đi vòng tròn được với `flattenPayload`', () => {
        const original = flattenPayload({ material: { materialId: 'MAT-1' }, tags: ['a', 'b'] });
        expect(parseAttributes(JSON.stringify(original))).toEqual(original);
    });
});

describe('buildSourceFieldCatalog', () => {
    const payloads = [
        {
            notificationId: '8D-1',
            workCenter: { workCenterId: 'WC-1' },
            defect: { defectCode: 'DEF-1' },
            inspections: [{ characteristic: 'Roughness' }],
        },
        {
            notificationId: '8D-2',
            workCenter: { workCenterId: 'WC-1' },
            defect: { defectCode: 'DEF-2' },
            inspections: [{ characteristic: 'Diameter' }, { characteristic: 'Roughness' }],
        },
    ];

    it('đánh dấu field có cột riêng là lọc trước được', () => {
        const catalog = buildSourceFieldCatalog(payloads);
        const workCenter = catalog.find((f) => f.path === 'workCenter.workCenterId');

        expect(workCenter?.indexed).toBe(true);
        expect(workCenter?.column).toBe('workCenterId');
    });

    it('đánh dấu field không có cột là chỉ nằm trong JSON', () => {
        const catalog = buildSourceFieldCatalog(payloads);
        const characteristic = catalog.find((f) => f.path === 'inspections[].characteristic');

        expect(characteristic?.indexed).toBe(false);
        expect(characteristic?.column).toBeNull();
        expect(characteristic?.multiValued).toBe(true);
    });

    it('đo được sức phân biệt — field mọi case cùng giá trị bị nêu tên', () => {
        const catalog = buildSourceFieldCatalog(payloads);
        const workCenter = catalog.find((f) => f.path === 'workCenter.workCenterId');

        // Cả hai case cùng WC-1: khớp 100%, cộng điểm đều, không đổi thứ hạng.
        expect(workCenter?.distinctValues).toBe(1);
        expect(workCenter?.note).toMatch(/exact same value/);
    });

    it('luôn có mặt các field suy ra lúc nạp, kể cả khi payload không chứa chúng', () => {
        const catalog = buildSourceFieldCatalog(payloads);
        const derived = catalog.filter((f) => f.origin === 'derived').map((f) => f.path);

        // Thiếu `embedding` hoặc `defectKeywords` trong danh mục là hai tiêu chí
        // mạnh nhất trở nên vô hình trên UI.
        expect(derived).toEqual(
            expect.arrayContaining(['defectKeywords', 'materialFamily', 'rootCauseCategory', 'embedding']),
        );
    });

    it('chịu được kho rỗng', () => {
        const catalog = buildSourceFieldCatalog([]);
        expect(catalog.every((f) => f.origin === 'derived')).toBe(true);
    });
});

describe('chấm điểm theo đường dẫn payload', () => {
    /** Chấm trên `causesIshikawa[].category` — field KHÔNG có cột riêng nào. */
    const ishikawaCriterion: Criterion = {
        criterionKey: 'ishikawaBranch',
        label: 'Ishikawa branch',
        sourceField: 'causesIshikawa[].category',
        matchType: 'exact',
        weight: 3,
        enabled: true,
        sortOrder: 10,
    };

    const withAttributes = (notificationId: string, attributes: AttributeMap): ScorableCase =>
        ({ notificationId, attributes });

    it('khớp khi hai case có chung ít nhất một giá trị của field nhiều giá trị', () => {
        const a = withAttributes('A', { 'causesIshikawa[].category': ['Machine', 'Method'] });
        const b = withAttributes('B', { 'causesIshikawa[].category': ['Material', 'Machine'] });

        const result = scoreCase(a, b, [ishikawaCriterion]);

        expect(result.score).toBe(3);
        expect(result.breakdown[0].level).toBe('exact');
        expect(result.breakdown[0].matchedOn).toBe('Machine');
    });

    it('không khớp khi hai tập rời nhau', () => {
        const a = withAttributes('A', { 'causesIshikawa[].category': ['Machine'] });
        const b = withAttributes('B', { 'causesIshikawa[].category': ['Material'] });

        expect(scoreCase(a, b, [ishikawaCriterion]).score).toBe(0);
    });

    it('thiếu payload đã làm phẳng ⇒ 0 điểm, KHÔNG ném', () => {
        // Đây là case đang mở khi người gọi quên truyền `raw`. Phải trượt lặng lẽ
        // chứ không được làm hỏng cả lượt phân tích.
        const a: ScorableCase = { notificationId: 'A' };
        const b = withAttributes('B', { 'causesIshikawa[].category': ['Machine'] });

        expect(scoreCase(a, b, [ishikawaCriterion]).score).toBe(0);
    });

    it('rỗng không khớp rỗng — hai case cùng thiếu field không phải hai case giống nhau', () => {
        const a = withAttributes('A', {});
        const b = withAttributes('B', {});

        expect(scoreCase(a, b, [ishikawaCriterion]).score).toBe(0);
    });

    it('cột thật vẫn được ưu tiên hơn map payload', () => {
        // `workCenterId` có cột riêng. Map payload chứa một giá trị KHÁC để bắt
        // được trường hợp thứ tự phân giải bị đảo.
        const criterion: Criterion = {
            ...ishikawaCriterion, criterionKey: 'wc', sourceField: 'workCenterId', weight: 4,
        };
        const a: ScorableCase = { notificationId: 'A', workCenterId: 'WC-1', attributes: { workCenterId: 'WC-9' } };
        const b: ScorableCase = { notificationId: 'B', workCenterId: 'WC-1', attributes: { workCenterId: 'WC-8' } };

        expect(scoreCase(a, b, [criterion]).score).toBe(4);
    });

    it('keyword đọc ĐÚNG field được cấu hình, không phải luôn là mô tả lỗi', () => {
        // Trước đây nhánh keyword bỏ qua `sourceField` và luôn so từ khoá lỗi.
        // Với cấu hình tự do thì đó là một tiêu chí lặng lẽ chấm trên field khác.
        const criterion: Criterion = {
            criterionKey: 'symptom',
            label: 'Symptom keywords',
            sourceField: 'symptomShortText',
            matchType: 'keyword',
            weight: 2,
            enabled: true,
            sortOrder: 10,
        };
        const a = withAttributes('A', {
            symptomShortText: 'Coating delamination after curing',
            // Mô tả lỗi trùng nhau hoàn toàn — nếu nhánh keyword vẫn đọc nhầm
            // sang đây thì test sẽ đậu vì lý do sai.
        });
        const b = withAttributes('B', { symptomShortText: 'Delamination observed on coating' });

        const result = scoreCase(a, b, [criterion]);
        expect(result.score).toBe(2);
        expect(result.breakdown[0].matchedOn).toMatch(/coating|delamination/);
    });
});

describe('trên mock data thật', () => {
    const payloads = loadMockPayloads();

    (payloads.length ? it : it.skip)('quét ra được các field khoá của bộ dữ liệu', () => {
        const catalog = buildSourceFieldCatalog(payloads);
        const paths = new Set(catalog.map((f) => f.path));

        // Bốn đường dẫn này là nguồn của các tiêu chí mặc định. Mất một cái nghĩa
        // là công thức làm phẳng đã đổi và profile đang chạy sẽ trượt im lặng.
        for (const expected of [
            'workCenter.workCenterId',
            'defect.defectCode',
            'material.materialId',
            'material.materialGroup',
        ]) {
            expect(paths).toContain(expected);
        }
    });

    (payloads.length ? it : it.skip)('làm phẳng tất định — cùng payload luôn cùng kết quả', () => {
        for (const payload of payloads) {
            expect(flattenPayload(payload)).toEqual(flattenPayload(payload));
        }
    });

    (payloads.length ? it : it.skip)('mọi đường dẫn có cột riêng đều khớp giá trị của cột đó', () => {
        const catalog = buildSourceFieldCatalog(payloads);
        const indexed = catalog.filter((f) => f.indexed && f.origin === 'sap');

        // Danh mục nói "field này có cột riêng". Nếu ánh xạ đường dẫn → cột sai
        // thì UI hứa lọc được bằng SQL trong khi thực tế không, và không có gì báo.
        expect(indexed.length).toBeGreaterThan(0);
        for (const field of indexed) {
            expect(field.column).toBeTruthy();
            expect(field.sourceTable).toBe(`HistoricalCases.${field.column}`);
        }
    });
});
