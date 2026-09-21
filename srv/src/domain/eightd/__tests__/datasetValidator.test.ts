/**
 * Test validator sau khi đổi vai trò.
 *
 * Validator KHÔNG còn là cổng chặn. Nó chỉ từ chối khi payload không phải một
 * case; mọi thứ khác thành cảnh báo chất lượng, chảy vào `CaseContext.gaps` và
 * được gửi cho model làm ngữ cảnh.
 *
 * Lý do đổi nằm ở `mock-data/dirty/`: với luật cũ, cả 12 case mô phỏng dữ liệu
 * SAP thật đều bị chặn. Từ chối phân tích chúng là từ chối đúng những case cần
 * giúp nhất.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
    blockingIssues,
    isDeliberateNA,
    isRootCauseFlag,
    qualityIssues,
    validateDataset,
} from '../datasetValidator';
import { extractDeepCase } from '../caseMapper';

const MOCK_DIR = path.resolve(__dirname, '../../../../../mock-data/clean');

/**
 * `beta/` giữ định dạng Golden Dataset cũ với khối `data` phẳng — nơi master
 * data nằm ở bảng riêng và notification trỏ sang bằng khoá ngoại.
 *
 * Deep Structure không có khái niệm đó: master data nằm lồng ngay trong case,
 * nên `extractDeepCase` dựng cả hai đầu của khoá ngoại từ CÙNG một giá trị và
 * FK-EXISTS không bao giờ có thể sai. Ba test về khoá ngoại vì vậy chỉ có nghĩa
 * trên định dạng cũ — và vẫn cần chạy, vì mapper vẫn nhận định dạng đó.
 */
const LEGACY_DIR = path.resolve(__dirname, '../../../../../mock-data/beta');

function load(name = 'case-8D-10048412.json') {
    return JSON.parse(fs.readFileSync(path.join(MOCK_DIR, name), 'utf-8'));
}

function loadLegacy(name = 'case-8D-10048412.json') {
    return JSON.parse(fs.readFileSync(path.join(LEGACY_DIR, name), 'utf-8'));
}

/** Hình dạng đã chuẩn hoá — để test nói về nội dung, không về định dạng. */
const rowsOf = (raw: unknown) => extractDeepCase(raw)!;

const ALL_CASES = fs.readdirSync(MOCK_DIR)
    .filter((f) => f.startsWith('case-') && f.endsWith('.json'))
    .sort();

const blockingIds = (raw: unknown) =>
    blockingIssues(validateDataset(raw)).map((i) => i.constraintId);
const qualityIds = (raw: unknown) =>
    qualityIssues(validateDataset(raw)).map((i) => i.constraintId);

// ─────────────────────────────────────────────────────────────────────────────

describe('bộ clean', () => {
    it.each(ALL_CASES)('%s không có vi phạm chặn', (file) => {
        expect(blockingIds(load(file))).toEqual([]);
    });

    it.each(ALL_CASES)('%s cũng không có cảnh báo chất lượng nào', (file) => {
        // Đây là điều phân biệt `clean/` với `dirty/`: bộ sạch phải sạch tuyệt
        // đối, nếu không thì không còn là mốc so sánh.
        expect(qualityIds(load(file))).toEqual([]);
    });

    it('phủ đủ 6 nhánh Ishikawa làm nguyên nhân gốc', () => {
        const roots = new Set(
            ALL_CASES.map((f) => {
                const rows = rowsOf(load(f)).causes_ishikawa as Array<Record<string, string>>;
                return rows.find((r) => isRootCauseFlag(r.is_root_cause))?.category;
            }),
        );
        expect([...roots].sort()).toEqual(
            ['Environment', 'Machine', 'Man', 'Material', 'Measurement', 'Method'],
        );
    });

    it('phủ cả hai origin và cả ba trạng thái SAP', () => {
        const notes = ALL_CASES.map((f) => rowsOf(load(f)).notifications[0]);
        expect(new Set(notes.map((n: any) => String(n.origin).slice(0, 2))))
            .toEqual(new Set(['Q1', 'Q3']));
        expect(new Set(notes.map((n: any) => n.status)))
            .toEqual(new Set(['In Process', 'Completed', 'Closed']));
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('CHẶN — payload không phải một case', () => {
    it('không phải object', () => {
        expect(blockingIds('nope')).toContain('SHAPE');
        expect(blockingIds(null)).toContain('SHAPE');
    });

    it("thiếu khối 'data'", () => {
        expect(blockingIds({ meta: {} })).toContain('SHAPE');
    });

    it('không có dòng notifications', () => {
        expect(blockingIds({ data: { notifications: [] } })).toContain('SHAPE');
    });

    it('nhiều hơn một case trong một file', () => {
        // Chỉ định dạng cũ mới diễn đạt được "hai case trong một file": Deep
        // Structure là một object cho đúng một case.
        const raw = loadLegacy();
        raw.data.notifications.push({ ...raw.data.notifications[0], notification_id: '8D-99999999' });
        expect(blockingIds(raw)).toContain('SHAPE');
    });

    it('thiếu notification_id — không có khoá để join', () => {
        expect(blockingIds({ data: { notifications: [{ origin: 'Q3 - Internal Defect' }] } }))
            .toContain('SHAPE');
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('KHÔNG chặn — chỉ là vấn đề chất lượng', () => {
    /** Mọi thứ ở đây từng chặn pipeline; giờ chỉ cảnh báo. */
    const cases: Array<[string, string, (raw: any) => void]> = [
        ['thiếu nhánh Ishikawa', 'ISHIKAWA-COVERAGE',
            (r) => { r.causesIshikawa = r.causesIshikawa.slice(0, 3); }],
        ['không nhánh nào được đánh dấu root cause', 'ROOT-CAUSE-FLAG',
            (r) => { for (const x of r.causesIshikawa) x.isRootCause = 'N'; }],
        ['hai nhánh cùng đánh dấu root cause', 'ROOT-CAUSE-FLAG',
            (r) => { r.causesIshikawa[0].isRootCause = 'Y'; }],
        ['5-Why rỗng', 'FIVE-WHY-DEPTH',
            (r) => { r.fiveWhyChain = []; }],
        ['5-Why chỉ một bước', 'FIVE-WHY-DEPTH',
            (r) => { r.fiveWhyChain = r.fiveWhyChain.slice(0, 1); }],
        ['team_size lệch số dòng', 'TEAM-SIZE-MATCH',
            (r) => { r.teamSize = 99; }],
        ['không có trưởng nhóm', 'TEAM-ONE-LEADER',
            (r) => { for (const x of r.teamAssignments) x.partnerRole = '8D Team Member'; }],
        ['action trùng dòng', 'PK-UNIQUE',
            (r) => { r.actions.push({ ...r.actions[0] }); }],
        ['action không được phân loại', 'ACTION-TYPE-MISSING',
            (r) => { for (const a of r.actions) a.actionType = ''; }],
        ['case Q3 mang dữ liệu khách hàng', 'Q1-ONLY-CUSTOMER-FIELDS',
            (r) => { r.customerReference.complaintReference = 'CC-2026-9999'; }],
    ];

    it.each(cases)('%s → cảnh báo %s, không chặn', (_label, constraintId, mutate) => {
        const raw = load();
        mutate(raw);
        expect(qualityIds(raw)).toContain(constraintId);
        expect(blockingIds(raw)).toEqual([]);
    });

    it('khoá ngoại trỏ vào nơi không tồn tại → cảnh báo FK-EXISTS, không chặn', () => {
        const raw = loadLegacy();
        raw.data.notifications[0].material_id = 'MAT-KHONG-TON-TAI';
        expect(qualityIds(raw)).toContain('FK-EXISTS');
        expect(blockingIds(raw)).toEqual([]);
    });

    it('case đã đóng mà thiếu loại action chỉ là cảnh báo', () => {
        const raw = load('case-8D-10048603.json'); // Closed
        raw.actions = raw.actions.filter((a: any) => a.actionType !== 'Preventive');
        expect(qualityIds(raw)).toContain('ACTION-TYPE-COVERAGE');
        expect(blockingIds(raw)).toEqual([]);
    });

    it('case đang mở mà thiếu preventive thì KHÔNG kêu gì cả — đúng luật', () => {
        expect(validateDataset(load('case-8D-10048651.json'))).toEqual([]);
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('dung sai với dữ liệu bẩn', () => {
    it('khoá ngoại có khoảng trắng thừa vẫn khớp', () => {
        const raw = loadLegacy();
        raw.data.notifications[0].material_id = `  ${raw.data.materials[0].material_id} `;
        expect(qualityIds(raw)).not.toContain('FK-EXISTS');
    });

    it('khoá ngoại sai hoa thường vẫn khớp', () => {
        const raw = loadLegacy();
        raw.data.notifications[0].work_center_id =
            String(raw.data.work_centers[0].work_center_id).toLowerCase();
        expect(qualityIds(raw)).not.toContain('FK-EXISTS');
    });

    it('ô trống dạng chuỗi ở trường khách hàng không bị coi là dữ liệu thật', () => {
        const raw = load(); // case Q3
        raw.customerReference.customerPlantContact = '   ';
        expect(qualityIds(raw)).not.toContain('Q1-ONLY-CUSTOMER-FIELDS');
    });
});

describe('isRootCauseFlag', () => {
    it.each([
        ['Y', true], ['y', true], ['x', true], ['X', true],
        ['ja', true], ['yes', true], ['✓', true],
        ['N', false], ['', false], ['-', false], ['nein', false],
    ])('%s → %s', (value, expected) => {
        expect(isRootCauseFlag(value)).toBe(expected);
    });

    it('null và undefined không phải cờ', () => {
        expect(isRootCauseFlag(null)).toBe(false);
        expect(isRootCauseFlag(undefined)).toBe(false);
    });
});

describe('isDeliberateNA', () => {
    it.each([
        ['N/A - internal defect, no customer reference', true],
        ['N/A', true],
        ['n/a - lowercase still counts', true],
        ['CC-2026-0442', false],
        ['', false],
    ])('%s → %s', (value, expected) => {
        expect(isDeliberateNA(value)).toBe(expected);
    });

    it('null không phải "N/A có chủ đích" — đó là thiếu dữ liệu thật', () => {
        expect(isDeliberateNA(null)).toBe(false);
        expect(isDeliberateNA(undefined)).toBe(false);
    });
});

describe('thông báo', () => {
    it('gắn kèm notification_id để biết case nào', () => {
        const raw = load();
        raw.teamSize = 99;
        const issue = validateDataset(raw).find((i) => i.constraintId === 'TEAM-SIZE-MATCH');
        expect(issue?.message).toContain('8D-10048412');
    });

    it('cảnh báo nói rõ thiếu nhánh nào, không chỉ nói "sai"', () => {
        const raw = load();
        raw.causesIshikawa = raw.causesIshikawa.filter(
            (r: any) => !['Man', 'Environment'].includes(r.category),
        );
        const msg = validateDataset(raw).find((i) => i.constraintId === 'ISHIKAWA-COVERAGE')?.message;
        expect(msg).toContain('Man');
        expect(msg).toContain('Environment');
    });
});

/**
 * Nguồn gốc và lô kiểm tra.
 *
 * Validator chạy trên FILE nguồn, trước khi mapper dọn. Nên nó vẫn phải nhìn
 * thấy — và nói ra — cái lô mà mapper sắp bỏ đi. Nếu chỉ mapper biết, dataset
 * hỏng sẽ được sửa lặng lẽ ở mỗi lần chạy và không bao giờ được sửa ở gốc.
 */
describe('Q1-NO-INSPECTION-LOT', () => {
    it('case Q1 mang inspection_lot_id là cảnh báo chất lượng', () => {
        const raw = { ...load('case-8D-10048577.json'), inspectionLotId: '0010000001' };
        expect(qualityIds(raw)).toContain('Q1-NO-INSPECTION-LOT');
    });

    it('case Q1 không mang lô thì im lặng', () => {
        expect(qualityIds(load('case-8D-10048577.json'))).not.toContain('Q1-NO-INSPECTION-LOT');
    });

    it('case Q3 mang lô là bình thường', () => {
        const raw = { ...load('case-8D-10048412.json'), inspectionLotId: '0010000042' };
        expect(qualityIds(raw)).not.toContain('Q1-NO-INSPECTION-LOT');
    });

    it('case Q2 mang lô là bình thường — hàng nhập có lô kiểm tra của mình', () => {
        const raw = {
            ...load('case-8D-10048412.json'),
            origin: 'Q2 - Supplier Defect',
            inspectionLotId: '0010000099',
        };
        expect(qualityIds(raw)).not.toContain('Q1-NO-INSPECTION-LOT');
    });
});

/**
 * Trường khách hàng thuộc về case hướng khách hàng — MỌI nguồn gốc khác đều
 * không, không riêng Q3. Luật cũ chỉ so với Q3, nên case Q2 lọt qua.
 */
describe('Q1-ONLY-CUSTOMER-FIELDS trên nguồn gốc Q2', () => {
    it('case Q2 mang mã khiếu nại khách hàng là cảnh báo', () => {
        const raw = {
            ...load('case-8D-10048412.json'),
            origin: 'Q2 - Supplier Defect',
            customerReference: { complaintReference: 'CC-2026-0442' },
        };
        expect(qualityIds(raw)).toContain('Q1-ONLY-CUSTOMER-FIELDS');
    });

    it("case Q2 với sentinel 'N/A - ...' thì không", () => {
        const raw = {
            ...load('case-8D-10048412.json'),
            origin: 'Q2 - Supplier Defect',
            customerReference: { complaintReference: 'N/A - supplier defect, no customer reference' },
        };
        expect(qualityIds(raw)).not.toContain('Q1-ONLY-CUSTOMER-FIELDS');
    });
});
