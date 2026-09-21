/**
 * Test ranh giới `criteria` / `criteriaFields` của `saveProfile`.
 *
 * ── Vì sao bộ test này cần thiết ──
 * Đây là chỗ rủi ro cao nhất của tính năng Object Schema: nếu ranh giới này vỡ,
 * Object Schema sẽ âm thầm ghi đè trọng số đã tune ở tab Similarity chỉ vì có
 * người kéo thêm một field — đúng lỗi mà chính comment trong `profileRepository.ts`
 * mô tả. Không có DB thật ở đây — `cds.connect.to('db')` được thay bằng một `db`
 * giả đọc/ghi trong bộ nhớ, dựng theo đúng shape CQN thật của `@sap/cds`
 * (`{SELECT:{...}}`, `{INSERT:{...}}`...). Nhờ vậy test chạy được mà không cần
 * bootstrap CDS server hay SQLite — đúng tinh thần "lớp domain thuần" mà
 * `jest.config.js` mô tả, chỉ khác là biên I/O ở đây là DB thay vì AI Core.
 */

import cds from '@sap/cds';
import {
    saveProfile, PROFILES, PROFILE_CRITERIA, STEP_BINDINGS,
} from '../profileRepository';

type Row = Record<string, unknown>;

function makeFakeDb(opts: { profileRow?: Row | null; existingCriteria?: Row[] } = {}) {
    // `??` coi `null` là "chưa truyền" giống `undefined` — dùng nó ở đây sẽ
    // không bao giờ mô phỏng được "profile không tồn tại". Phải kiểm bằng `in`.
    const profileRow = 'profileRow' in opts ? opts.profileRow : { profileKey: 'p1', label: 'P1' };
    const existingCriteria = opts.existingCriteria ?? [];
    const inserted: Row[][] = [];
    const deleted: unknown[] = [];
    const updated: Array<{ target: string; set: Row; where: unknown }> = [];

    const run = jest.fn(async (query: any) => {
        if (query.SELECT) {
            const target = query.SELECT.from?.ref?.[0];
            if (target === PROFILES) return query.SELECT.one ? profileRow : (profileRow ? [profileRow] : []);
            if (target === PROFILE_CRITERIA) return existingCriteria;
            if (target === STEP_BINDINGS) return [];
            return [];
        }
        if (query.INSERT) {
            inserted.push(query.INSERT.entries as Row[]);
            return { affectedRows: (query.INSERT.entries as Row[]).length };
        }
        if (query.DELETE) {
            deleted.push(query.DELETE);
            return { affectedRows: 1 };
        }
        if (query.UPDATE) {
            updated.push({
                target: query.UPDATE.entity?.ref?.[0],
                set: query.UPDATE.data,
                where: query.UPDATE.where,
            });
            return { affectedRows: 1 };
        }
        throw new Error(`db.run giả không nhận diện được query: ${JSON.stringify(query)}`);
    });

    return { run, inserted, deleted, updated };
}

/** Cài `db` giả vào `cds.connect.to('db')` cho một test, gỡ lại sau đó. */
function withFakeDb(db: ReturnType<typeof makeFakeDb>) {
    const original = (cds.connect as any).to;
    (cds.connect as any).to = jest.fn(async (name: string) => {
        if (name === 'db') return db;
        throw new Error(`fake cds.connect.to gọi với tên lạ: ${name}`);
    });
    return () => { (cds.connect as any).to = original; };
}

describe('saveProfile — ranh giới criteria / criteriaFields', () => {
    let restore: () => void;

    afterEach(() => {
        restore?.();
        jest.clearAllMocks();
    });

    it('profile không tồn tại → reject 404, không ghi gì', async () => {
        const db = makeFakeDb({ profileRow: null });
        restore = withFakeDb(db);

        await expect(saveProfile('missing', { criteria: [] })).rejects.toMatchObject({ code: 404 });
        expect(db.inserted).toHaveLength(0);
    });

    it('gửi đồng thời `criteria` và `criteriaFields` → reject 400, không ghi gì', async () => {
        const db = makeFakeDb();
        restore = withFakeDb(db);

        await expect(saveProfile('p1', {
            criteria: [{ criterionKey: 'a', sourceField: 'a', matchType: 'exact', weight: 1 }],
            criteriaFields: [{ criterionKey: 'a', sourceField: 'a' }],
        })).rejects.toMatchObject({ code: 400 });
        expect(db.inserted).toHaveLength(0);
    });

    it('criteriaFields — field MỚI: weight=1, TẮT sẵn, minSimilarity=null nếu không phải cosine', async () => {
        const db = makeFakeDb({ existingCriteria: [] });
        restore = withFakeDb(db);

        await saveProfile('p1', {
            criteriaFields: [
                { criterionKey: 'actionsActionText', label: 'Action text', sourceField: 'actionsActionText', sourceTable: 'HistoricalCases.attributesJson' },
            ],
        });

        expect(db.inserted).toHaveLength(1);
        const entry = db.inserted[0][0];
        expect(entry).toMatchObject({
            criterionKey: 'actionsActionText',
            weight: 1,
            enabled: false,
            matchType: 'exact',
            minSimilarity: null,
        });
    });

    it('criteriaFields — field MỚI kiểu cosine: minSimilarity mặc định 0.7', async () => {
        const db = makeFakeDb({ existingCriteria: [] });
        restore = withFakeDb(db);

        await saveProfile('p1', {
            criteriaFields: [
                { criterionKey: 'embedding', label: 'Case narrative', sourceField: 'embedding', sourceTable: 'HistoricalCases.searchText', matchType: 'cosine' },
            ],
        });

        const entry = db.inserted[0][0];
        expect(entry).toMatchObject({ weight: 1, enabled: false, matchType: 'cosine', minSimilarity: 0.7 });
    });

    it('criteriaFields — field ĐÃ CÓ tuning: giữ nguyên weight/matchType/fallback/minSimilarity/enabled, không bị criteriaFields ghi đè', async () => {
        const db = makeFakeDb({
            existingCriteria: [{
                criterionKey: 'wc',
                matchType: 'keyword',
                weight: 7,
                fallbackField: 'foo',
                fallbackMatch: 'exact',
                fallbackWeight: 2,
                minSimilarity: 0.55,
                enabled: true,
            }],
        });
        restore = withFakeDb(db);

        await saveProfile('p1', {
            criteriaFields: [
                // matchType 'exact' ở đây là một nỗ lực ghi đè — phải bị bỏ qua.
                { criterionKey: 'wc', label: 'Work centre v2', sourceField: 'workCenterId', sourceTable: 'HistoricalCases.workCenterId', matchType: 'exact' },
            ],
        });

        const entry = db.inserted[0][0];
        expect(entry).toMatchObject({
            // Giữ nguyên từ tuning cũ:
            matchType: 'keyword',
            weight: 7,
            fallbackField: 'foo',
            fallbackMatch: 'exact',
            fallbackWeight: 2,
            minSimilarity: 0.55,
            enabled: true,
            // Lấy từ criteriaFields mới (đúng vai của Object Schema — thành viên/định danh):
            label: 'Work centre v2',
            sourceField: 'workCenterId',
        });
    });

    it('matchType không có nhánh xử lý → reject 400, không ghi gì', async () => {
        const db = makeFakeDb();
        restore = withFakeDb(db);

        await expect(saveProfile('p1', {
            criteria: [{ criterionKey: 'x', sourceField: 'y', matchType: 'bogus', weight: 1, enabled: true }],
        })).rejects.toMatchObject({ code: 400 });
        expect(db.inserted).toHaveLength(0);
        expect(db.deleted).toHaveLength(0);
    });

    it('cosine mà sourceField khác "embedding" → reject 400', async () => {
        const db = makeFakeDb();
        restore = withFakeDb(db);

        await expect(saveProfile('p1', {
            criteria: [{ criterionKey: 'x', sourceField: 'notEmbedding', matchType: 'cosine', weight: 1, enabled: true }],
        })).rejects.toMatchObject({ code: 400 });
        expect(db.inserted).toHaveLength(0);
    });

    it('tiêu chí thiếu sourceField → reject 400', async () => {
        const db = makeFakeDb();
        restore = withFakeDb(db);

        await expect(saveProfile('p1', {
            criteria: [{ criterionKey: 'x', sourceField: '', matchType: 'exact', weight: 1, enabled: true }],
        })).rejects.toMatchObject({ code: 400 });
    });

    it('criterionKey trùng trong cùng một lượt lưu → reject 400', async () => {
        const db = makeFakeDb();
        restore = withFakeDb(db);

        await expect(saveProfile('p1', {
            criteria: [
                { criterionKey: 'dup', sourceField: 'a', matchType: 'exact', weight: 1, enabled: true },
                { criterionKey: 'dup', sourceField: 'b', matchType: 'exact', weight: 1, enabled: true },
            ],
        })).rejects.toMatchObject({ code: 400 });
        expect(db.inserted).toHaveLength(0);
    });

    it('gán bước D không hợp lệ ("D9") → reject 400, không ghi gì', async () => {
        const db = makeFakeDb();
        restore = withFakeDb(db);

        await expect(saveProfile('p1', { steps: ['D1', 'D9'] })).rejects.toMatchObject({ code: 400 });
        expect(db.updated).toHaveLength(0);
    });

    it('cùng một bước D lặp lại trong `steps` → reject 400', async () => {
        const db = makeFakeDb();
        restore = withFakeDb(db);

        await expect(saveProfile('p1', { steps: ['D1', 'D1'] })).rejects.toMatchObject({ code: 400 });
        expect(db.updated).toHaveLength(0);
    });

    it('gán nhiều hơn một bước D cho một profile → reject 400', async () => {
        const db = makeFakeDb();
        restore = withFakeDb(db);

        await expect(saveProfile('p1', { steps: ['D1', 'D2'] })).rejects.toMatchObject({ code: 400 });
        expect(db.updated).toHaveLength(0);
    });
});
