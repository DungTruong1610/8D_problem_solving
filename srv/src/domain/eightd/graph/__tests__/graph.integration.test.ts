/**
 * Integration test cho truy hồi bằng graph — CHẠY THẬT trên HANA.
 *
 * ── Vì sao phải có, khi đã có 26 unit test ──
 * Unit test phủ phần thuần: chấm điểm, chuẩn hoá cấu hình, dựng chuỗi truy vấn.
 * Chúng KHÔNG phủ được thứ dễ sai nhất ở module này — câu Cypher có hợp lệ với
 * phương ngữ của HANA không, view có trả đúng dòng không, workspace có deploy
 * được không. Một chữ gõ nhầm trong `probes.ts` đi lọt cả `tsc` lẫn `jest` và
 * chỉ nổ lúc chạy thật, giữa một lượt phân tích.
 *
 * ── Vì sao gác bằng biến môi trường chứ không tự dò rồi bỏ qua ──
 * Cách "tự dò, không kết nối được thì thôi" cho ra một bộ test XANH mà không
 * chạy gì cả — tệ hơn là không có test, vì nó tạo cảm giác đã được phủ. Ở đây
 * `describe.skip` khai báo tĩnh, nên jest báo đúng chữ "skipped".
 *
 * Chạy:
 *   npm run test:graph
 *
 * `npm test` thường sẽ BỎ QUA tệp này — có chủ ý: bộ test chính phải chạy được
 * offline, không cần credential, không cần mạng.
 */

import cds from '@sap/cds';
import { buildAnchor, keywordPredicate, type GraphAnchor } from '../anchor';
import { isGraphAvailable, runGraphQuery } from '../graphClient';
import { findPrecedentsByStepGraph } from '../engine';
import {
    resolvedByActionType,
    sameMaterial,
    sameMaterialFamily,
    sameWorkCenter,
    sharedKeywords,
} from '../probes';
import { DEFAULT_STEP_PROFILES, STEP_CODES, scoreEvidence } from '../stepProfiles';
import { GRAPH_STEP_PARAMS, getStepProfiles, resetStepProfilesCache, seedGraphStepParams } from '../settings';
import { NODE } from '../model';

const ENABLED = process.env.GRAPH_INTEGRATION === '1';
const describeGraph = ENABLED ? describe : describe.skip;

/** Kết nối HANA chậm hơn hẳn một hàm thuần — mặc định 5 giây của jest không đủ. */
const TIMEOUT = 90_000;

/**
 * Case neo cố định, chọn vì nó CHÍNH LÀ ca dương tính giả trong
 * `docs/PRECEDENT-RETRIEVAL-REVIEW.md`: *"Flange edge burr above limit"*, từng
 * khớp *"Chatter marks … on milled flange"* qua đúng một chữ `flange`.
 */
const ANCHOR = '8D-10048412';

/**
 * `CaseContext` đủ trường để `buildQueryText` chạy được.
 *
 * Stub tối giản từng làm test đỏ ở đúng chỗ đáng học: tầng 2 đọc sâu vào
 * `ishikawa`/`actions`/`fiveWhy`, những phần mà một object ba trường không có.
 * Giữ stub nghèo nàn nghĩa là không bao giờ chạy qua đường thật.
 */
const contextOf = (over: Record<string, unknown> = {}): any => ({
    notificationId: '8D-LIVE-TEST',
    origin: 'Q3 - Internal Defect',
    isCustomerFacing: false,
    header: {
        symptomShortText: 'Flange edge burr above limit after milling',
        status: 'Open', foundDate: null, completionDate: null,
        quantityExtent: '85 units affected', defectQuantity: 85,
        defectQuantityUom: 'PC', teamSize: null,
    },
    product: {
        plant: '1000', materialId: 'MAT-10247', materialDesc: 'Bracket housing',
        materialGroup: 'MG-HOUSING', workCenterId: 'WC-MILL-07',
        workCenterDesc: 'CNC milling cell 07', defectCode: 'DEF-0489',
        defectText: 'Burr on flange edge', batchId: null,
    },
    ishikawa: [{ category: 'Machine', description: 'Clamp pad worn 0.2 mm' }],
    actions: {
        containment: [{ actionText: 'Quarantine 85 housings at the outgoing dock' }],
        corrective: [], preventive: [],
    },
    fiveWhy: [{ question: 'Why is the burr above limit?', answer: 'The clamp slips during the finish pass.' }],
    rootCause: { category: 'Machine', description: 'Worn clamp pad lets the part shift' },
    team: { leader: null, members: [] },
    ...over,
});

const anchorOf = (over: Partial<GraphAnchor> = {}): GraphAnchor => ({
    notificationId: ANCHOR,
    workCenterId: 'WC-MILL-07',
    defectCode: 'DEF-0489',
    materialId: 'MAT-10247',
    materialFamily: 'MG-HOUSING',
    keywords: ['burr', 'edge', 'flange', 'limit'],
    ...over,
});

describeGraph('graph retrieval (HANA)', () => {
    beforeAll(async () => {
        /**
         * Nạp CDS model TRƯỚC khi chạm DB.
         *
         * ── Vì sao phải làm tay ở đây ──
         * `cds.connect.to('db')` KHÔNG tự nạp model. Server thật luôn có model vì
         * `cds.serve` nạp nó, nhưng một tiến trình jest thì không — và hậu quả im
         * lặng đến mức nguy hiểm: raw SQL vẫn chạy bình thường, còn CQN thì mất
         * khả năng ánh xạ tên. `UPDATE(...).set({ topN: 1 })` không map được
         * `topN` sang cột `TOPN` nên KHÔNG ghi gì cả, không lỗi, không cảnh báo.
         *
         * Nghĩa là mọi test cấu hình sẽ đọc lại đúng giá trị mặc định và xanh —
         * chứng minh một điều không hề đúng. Chính cái bẫy đó đã suýt được ghi
         * vào repo như một kết luận.
         */
        if (!cds.model) {
            const model = await cds.load(cds.resolve('*') as any);
            cds.model = cds.linked(cds.compile.for.nodejs(model as any) as any);
        }

        const available = await isGraphAvailable();
        if (!available) {
            throw new Error(
                'GRAPH_INTEGRATION=1 nhưng graph workspace không dùng được. '
                + 'Chạy `npm run cf:cpea && npm run cf:sandbox`, rồi `npm run deploy:graph` '
                + 'và `npm run seed:graph`.',
            );
        }
    }, TIMEOUT);

    /**
     * Trả connection pool của CAP về, nếu không jest chạy xong vẫn treo.
     *
     * Không dùng `--forceExit`: cờ đó giết tiến trình bất kể còn gì đang mở, nên
     * nó che luôn cả những chỗ rò thật mà lần sau ta sẽ muốn biết.
     */
    afterAll(async () => {
        const db = (cds as any).db;
        await db?.disconnect?.().catch(() => { /* pool đã đóng */ });
    }, TIMEOUT);

    // ── Nền tảng ─────────────────────────────────────────────────────────────

    it('workspace deploy được và hợp lệ', async () => {
        expect(await isGraphAvailable()).toBe(true);
    }, TIMEOUT);

    it('kho đã seed đủ 25 case', async () => {
        const rows = await runGraphQuery<{ N: number }>({
            cypher: `MATCH (c:${NODE.case}) RETURN c.BIZ_KEY AS NID`,
            wrap: (graph) => `SELECT COUNT(*) AS "N" FROM ${graph}`,
        });
        expect(Number(rows[0].N)).toBe(25);
    }, TIMEOUT);

    /**
     * Kiểm chính cú pháp mà phương ngữ HANA bắt buộc và Cypher chuẩn thì không:
     * quan hệ PHẢI có tên biến, và hình chữ V phải viết bằng mẫu ngăn dấu phẩy
     * chứ không bằng mũi tên ngược. Sai một trong hai là lỗi runtime.
     */
    it('mẫu ngăn dấu phẩy đi được hai chặng qua một đỉnh chung', async () => {
        const rows = await runGraphQuery<{ OTHER: string }>({
            cypher:
                `MATCH (c1:${NODE.case})-[e1:ON_MATERIAL]->(m:${NODE.material}), `
                + `(c2:${NODE.case})-[e2:ON_MATERIAL]->(m) `
                + 'WHERE c1.BIZ_KEY = $anchor AND c2.BIZ_KEY <> $anchor '
                + 'RETURN DISTINCT c2.BIZ_KEY AS OTHER',
            params: { anchor: ANCHOR },
        });
        // MAT-10247 được bốn case dùng chung, nên trừ chính nó còn ba.
        expect(rows.map((r) => r.OTHER).sort()).toEqual(
            ['8D-10048880', '8D-10049010', '8D-10049120'],
        );
    }, TIMEOUT);

    /**
     * `[*1..N]` là năng lực DUY NHẤT mà SQL trên HANA không thay được — HANA Cloud
     * không có recursive CTE. Nếu nó hỏng thì lý do chọn graph mất một nửa.
     */
    it('đường độ dài biến thiên chạy được', async () => {
        const rows = await runGraphQuery<{ VIA: string }>({
            cypher:
                `MATCH p = (c:${NODE.case})-[*1..2]-(x:${NODE.case}) `
                + 'WHERE c.BIZ_KEY = $anchor AND x.BIZ_KEY <> $anchor '
                + 'RETURN x.BIZ_KEY AS VIA',
            params: { anchor: ANCHOR },
        });
        expect(rows.length).toBeGreaterThan(0);
    }, TIMEOUT);

    // ── Tham số bind ─────────────────────────────────────────────────────────

    /**
     * Spike S1 đóng lại thành test: giá trị đi qua `PARAMETERS` ở lại làm DỮ LIỆU.
     * Nếu một ngày ai đó đổi sang nội suy chuỗi, chuỗi này sẽ khớp mọi vật tư.
     */
    it('giá trị thù địch qua tham số không đổi được ý nghĩa truy vấn', async () => {
        const rows = await runGraphQuery({
            cypher:
                `MATCH (c:${NODE.case})-[e:ON_MATERIAL]->(m:${NODE.material}) `
                + 'WHERE m.BIZ_KEY = $mat RETURN c.BIZ_KEY AS NID',
            params: { mat: `MAT-10247' OR '1'='1` },
        });
        expect(rows).toEqual([]);
    }, TIMEOUT);

    it('chuỗi OR của từ khoá chạy được — `IN [$a,$b]` thì không, đó là lý do nó tồn tại', async () => {
        const predicate = keywordPredicate(['burr', 'edge'])!;
        const rows = await runGraphQuery<{ NID: string }>({
            cypher:
                `MATCH (c:${NODE.case})-[e:MENTIONS]->(k:${NODE.keyword}) `
                + `WHERE ${predicate.predicate} RETURN DISTINCT c.BIZ_KEY AS NID`,
            params: predicate.params,
        });
        expect(rows.map((r) => r.NID).sort()).toEqual(['8D-10048412', '8D-10049030']);
    }, TIMEOUT);

    // ── Probe ────────────────────────────────────────────────────────────────

    it('sameWorkCenter trả về case cùng trạm, không bao giờ trả về chính nó', async () => {
        const hits = await sameWorkCenter(anchorOf());
        expect(hits.length).toBeGreaterThan(0);
        expect(hits.map((h) => h.notificationId)).not.toContain(ANCHOR);
        for (const hit of hits) {
            expect(hit.kind).toBe('workCenter');
            expect(hit.detail).toBe('WC-MILL-07');
            expect(hit.count).toBe(1);
        }
    }, TIMEOUT);

    it('sameMaterialFamily đi được hai chặng Case → Material → MaterialFamily', async () => {
        const hits = await sameMaterialFamily(anchorOf());
        expect(hits.length).toBeGreaterThan(0);
        expect(hits.every((h) => h.detail === 'MG-HOUSING')).toBe(true);
        expect(hits.map((h) => h.notificationId)).not.toContain(ANCHOR);
    }, TIMEOUT);

    it('probe trả mảng rỗng khi anchor thiếu giá trị, không ném', async () => {
        expect(await sameWorkCenter(anchorOf({ workCenterId: null }))).toEqual([]);
        expect(await sameMaterial(anchorOf({ materialId: null }))).toEqual([]);
        expect(await sameMaterialFamily(anchorOf({ materialFamily: null }))).toEqual([]);
        expect(await sharedKeywords(anchorOf({ keywords: [] }))).toEqual([]);
    }, TIMEOUT);

    it('probe hành động lọc đúng loại và chỉ chạy trên ứng viên đã cho', async () => {
        const candidates = ['8D-10049010', '8D-10049030'];
        const hits = await resolvedByActionType(anchorOf(), 'Containment', 'containment', candidates);
        expect(hits.length).toBeGreaterThan(0);
        for (const hit of hits) {
            expect(candidates).toContain(hit.notificationId);
            expect(hit.kind).toBe('containment');
            expect(hit.count).toBeGreaterThan(0);
        }
        expect(await resolvedByActionType(anchorOf(), 'Corrective', 'corrective', [])).toEqual([]);
    }, TIMEOUT);

    // ── Bằng chứng nghiệp vụ ─────────────────────────────────────────────────

    /**
     * ACCEPTANCE R3(a). Engine cũ trả +2 cho cả hai case dưới đây vì cả hai đều
     * "có trùng từ". Ở đây phép đếm tách chúng ra: 3 từ so với 1 từ.
     */
    it('ACCEPTANCE R3(a): đếm được SỐ từ chung, không chỉ có/không', async () => {
        const hits = await sharedKeywords(anchorOf());
        const by = new Map(hits.map((h) => [h.notificationId, h]));

        const genuine = by.get('8D-10049030');
        const falsePositive = by.get('8D-10049010');

        expect(genuine).toBeDefined();
        expect(genuine!.count).toBe(3);
        expect(genuine!.detail).toBe('burr, edge, limit');

        expect(falsePositive).toBeDefined();
        expect(falsePositive!.count).toBe(1);
        expect(falsePositive!.detail).toBe('flange');

        expect(genuine!.count).toBeGreaterThan(falsePositive!.count);
    }, TIMEOUT);

    /**
     * ACCEPTANCE R3(b). Triệu chứng sống lấy nguyên văn từ review doc —
     * *"…pocket depth also reading shallow"*. Engine cũ chấm case này **+0** vì
     * cụm khớp nằm ở `symptomShortText`, trường nó không đọc. Ở ngưỡng của D4,
     * đúng một case được qua, và đó phải là case đó.
     */
    it('ACCEPTANCE R3(b): "pocket depth" tìm ra 8D-10048880 — case engine cũ chấm +0', async () => {
        const anchor = anchorOf({
            notificationId: '8D-LIVE-TEST',
            keywords: ['pocket', 'depth', 'shallow', 'housing'],
        });

        const hits = await sharedKeywords(anchor);
        const found = hits.find((h) => h.notificationId === '8D-10048880');
        expect(found).toBeDefined();
        expect(found!.count).toBe(3);

        const scored = scoreEvidence(hits, DEFAULT_STEP_PROFILES.D4);
        expect(scored.map((s) => s.notificationId)).toEqual(['8D-10048880']);
    }, TIMEOUT);

    /**
     * D1 hỏi "ai đã làm loại việc này", nên phép đếm phải là số CASE mỗi người đã
     * tham gia, không phải số dòng nhóm. Người phục vụ nhiều case nhất ở
     * WC-MILL-07 là partner 100001, Quality Engineer.
     */
    it('D1: đếm được số case mỗi người đã tham gia ở một trạm', async () => {
        const rows = await runGraphQuery<{ PERSON: string; FUNC: string; SERVED: number }>({
            cypher:
                `MATCH (c:${NODE.case})-[e1:OCCURRED_AT]->(w:${NODE.workCenter}), `
                + `(c)-[e2:STAFFED_BY]->(p:${NODE.person}) `
                + 'WHERE w.BIZ_KEY = $wc '
                + 'RETURN c.BIZ_KEY AS NID, p.BIZ_KEY AS PERSON, e2.FUNCTION_TITLE AS FUNC',
            params: { wc: 'WC-MILL-07' },
            wrap: (graph) =>
                'SELECT g."PERSON" AS "PERSON", g."FUNC" AS "FUNC", '
                + `COUNT(DISTINCT g."NID") AS "SERVED" FROM ${graph} `
                + 'GROUP BY g."PERSON", g."FUNC" ORDER BY "SERVED" DESC, "PERSON"',
        });

        expect(rows.length).toBeGreaterThan(0);
        expect(rows[0].PERSON).toBe('100001');
        expect(rows[0].FUNC).toBe('Quality Engineer');
        expect(Number(rows[0].SERVED)).toBe(3);
    }, TIMEOUT);

    /**
     * D5 hỏi "cách sửa nào đã đóng được nguyên nhân này". Đi qua `RootCause`,
     * không qua "case trông giống" — và mã nhiệm vụ hay dùng nhất cho nguyên nhân
     * Machine là TSK-3010, xuất hiện ở 4 case.
     */
    it('D5: mã nhiệm vụ khắc phục hay dùng nhất cho một nguyên nhân gốc', async () => {
        const rows = await runGraphQuery<{ TASK_CODE: string; CASES: number }>({
            cypher:
                `MATCH (c:${NODE.case})-[e1:CAUSED_BY]->(r:${NODE.rootCause}), `
                + `(c)-[e2:RESOLVED_BY]->(a:${NODE.action}), `
                + `(a)-[e3:CODED_AS]->(t:${NODE.taskCode}) `
                + `WHERE r.BIZ_KEY = $rc AND e2.ACTION_TYPE = 'Corrective' `
                + 'RETURN c.BIZ_KEY AS NID, t.BIZ_KEY AS TASK_CODE',
            params: { rc: 'Machine' },
            wrap: (graph) =>
                'SELECT g."TASK_CODE" AS "TASK_CODE", COUNT(DISTINCT g."NID") AS "CASES" '
                + `FROM ${graph} GROUP BY g."TASK_CODE" ORDER BY "CASES" DESC, "TASK_CODE"`,
        });

        expect(rows[0].TASK_CODE).toBe('TSK-3010');
        expect(Number(rows[0].CASES)).toBe(4);
    }, TIMEOUT);

    // ── Toàn engine ──────────────────────────────────────────────────────────

    it('trả về đủ tám bước, và các bước KHÔNG cho ra cùng một danh sách', async () => {
        const result = await findPrecedentsByStepGraph(contextOf());

        expect(Object.keys(result.byStep).sort()).toEqual([...STEP_CODES].sort());
        for (const code of STEP_CODES) {
            const step = result.byStep[code];
            expect(step.profileKey).toBe(`graph:${code}`);
            // Rỗng thì PHẢI nói vì sao — "không có tiền lệ" và "engine không chạy"
            // nhìn ngoài giống hệt nhau, và chỉ `reason` phân biệt được.
            if (!step.precedents.length) expect(step.reason).toBeTruthy();
            else expect(step.reason).toBeNull();
        }

        // Chính là điều engine cũ không làm được: shadow run cho thấy nó trả về
        // DANH SÁCH Y HỆT cho cả tám bước, vì cả tám cùng trỏ một profile.
        const perStep = STEP_CODES.map((code) =>
            result.byStep[code].precedents.map((p) => p.notificationId).join('|'));
        expect(new Set(perStep).size).toBeGreaterThan(1);

        // Danh sách hợp nhất được đánh số MỘT LẦN và không được trùng lặp.
        const ids = result.union.map((p) => p.notificationId);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).not.toContain('8D-LIVE-TEST');
    }, TIMEOUT);

    it('tiền lệ mang theo nội dung thật lấy từ bảng quan hệ, không chỉ có khoá', async () => {
        const result = await findPrecedentsByStepGraph(contextOf({
            header: {
                symptomShortText: 'Bracket housing pocket depth reading shallow',
                status: 'Open', foundDate: null, completionDate: null,
                quantityExtent: '12 units', defectQuantity: 12, defectQuantityUom: 'PC', teamSize: null,
            },
        }));
        const top = result.union[0];

        expect(top).toBeDefined();
        expect(top.symptomShortText).toBeTruthy();
        expect(top.sapStatus).toMatch(/Closed|Completed/);
        expect(top.explanation).toMatch(/điểm —/);
        expect(Array.isArray(top.team)).toBe(true);
        expect(Array.isArray(top.actions)).toBe(true);
    }, TIMEOUT);

    // ── Cấu hình admin ───────────────────────────────────────────────────────

    it('seedGraphStepParams bù đủ tám dòng và không đổi hành vi', async () => {
        await seedGraphStepParams();
        resetStepProfilesCache();

        const profiles = await getStepProfiles();
        expect(Object.keys(profiles).sort()).toEqual([...STEP_CODES].sort());

        // Seed đúng bằng con số trong code, nên đọc lại phải ra chính nó. Nếu
        // chỗ này lệch thì việc "seed không đổi hành vi" là một lời hứa suông.
        for (const code of STEP_CODES) {
            expect(profiles[code].weights).toEqual(DEFAULT_STEP_PROFILES[code].weights);
            expect(profiles[code].minScore).toBe(DEFAULT_STEP_PROFILES[code].minScore);
            expect(profiles[code].keywordCap).toBe(DEFAULT_STEP_PROFILES[code].keywordCap);
            expect(profiles[code].actionType).toBe(DEFAULT_STEP_PROFILES[code].actionType);
        }
    }, TIMEOUT);

    /**
     * Chỉnh trọng số phải có hiệu lực NGAY, không cần deploy — đó là toàn bộ lý
     * do bảng này tồn tại. Sửa xong khôi phục lại trong `finally`, vì một test
     * để lại cấu hình lạ sẽ làm mọi test sau đó sai theo một cách rất khó lần.
     */
    it('trọng số sửa trong DB có hiệu lực ngay ở lượt truy hồi kế tiếp', async () => {
        await seedGraphStepParams();
        const db = await cds.connect.to('db');
        const before = await db.run(
            SELECT.one.from(GRAPH_STEP_PARAMS).where({ stepCode: 'D1' }),
        ) as Record<string, unknown>;

        try {
            await db.run(UPDATE(GRAPH_STEP_PARAMS).set({ topN: 1 }).where({ stepCode: 'D1' }));
            resetStepProfilesCache();
            expect((await getStepProfiles()).D1.topN).toBe(1);
        } finally {
            await db.run(
                UPDATE(GRAPH_STEP_PARAMS).set({ topN: before.topN }).where({ stepCode: 'D1' }),
            );
            resetStepProfilesCache();
        }

        expect((await getStepProfiles()).D1.topN).toBe(DEFAULT_STEP_PROFILES.D1.topN);
    }, TIMEOUT);

    /**
     * Bất biến chống R3 phải sống sót qua cả đường cấu hình, không chỉ trong unit
     * test. Ghi một dòng vi phạm vào DB thật rồi kiểm rằng nó bị từ chối.
     */
    it('cấu hình để một từ khoá chung tự qua ngưỡng bị TỪ CHỐI trên DB thật', async () => {
        await seedGraphStepParams();
        const db = await cds.connect.to('db');
        const before = await db.run(
            SELECT.one.from(GRAPH_STEP_PARAMS).where({ stepCode: 'D4' }),
        ) as Record<string, unknown>;

        try {
            await db.run(
                UPDATE(GRAPH_STEP_PARAMS).set({ wKeywords: 9, minScore: 2 }).where({ stepCode: 'D4' }),
            );
            resetStepProfilesCache();

            const profile = (await getStepProfiles()).D4;
            expect(profile.weights.keywords).toBe(DEFAULT_STEP_PROFILES.D4.weights.keywords);
            expect(profile.minScore).toBe(DEFAULT_STEP_PROFILES.D4.minScore);

            // Và bất biến vẫn đứng: một từ khoá chung không đủ điểm.
            const single = scoreEvidence(
                [{ notificationId: 'X', kind: 'keywords', detail: 'flange', count: 1 }],
                profile,
            );
            expect(single).toEqual([]);
        } finally {
            await db.run(UPDATE(GRAPH_STEP_PARAMS).set({
                wKeywords: before.wKeywords, minScore: before.minScore,
            }).where({ stepCode: 'D4' }));
            resetStepProfilesCache();
        }
    }, TIMEOUT);

    // ── Tầng 2: re-rank ──────────────────────────────────────────────────────

    /**
     * Bật re-rank cho D4 trên DB thật rồi chạy cả hai tầng.
     *
     * ── Vì sao KHÔNG assert "phải có mục rerank" ──
     * Tầng 2 gọi model, và nó được phép hỏng: hết giờ, AI Core trục trặc, output
     * không parse được. Khi đó xếp hạng tầng 1 đứng nguyên — đó là hành vi ĐÚNG,
     * nên một test đòi phải có mục rerank sẽ đỏ vì một sự cố bên ngoài chứ không
     * vì code sai. Cái phải luôn đúng là: chạy xong không hỏng, và NẾU có điểm
     * re-rank thì nó đúng khuôn.
     */
    it('bật re-rank D4: chạy trọn hai tầng, và điểm model đúng khuôn', async () => {
        await seedGraphStepParams();
        const db = await cds.connect.to('db');
        const before = await db.run(
            SELECT.one.from(GRAPH_STEP_PARAMS).where({ stepCode: 'D4' }),
        ) as Record<string, unknown>;

        try {
            await db.run(UPDATE(GRAPH_STEP_PARAMS).set({ wRerank: 4 }).where({ stepCode: 'D4' }));
            resetStepProfilesCache();

            const profile = (await getStepProfiles()).D4;
            expect(profile.rerank?.weight).toBe(4);
            expect(profile.rerank!.weight).toBeLessThan(profile.minScore);

            const result = await findPrecedentsByStepGraph(contextOf());

            for (const p of result.byStep.D4.precedents) {
                const rerankRow = p.breakdown.find((b) => b.criterionKey === 'rerank');
                if (!rerankRow) continue;
                expect(rerankRow.points).toBeGreaterThan(0);
                expect(rerankRow.points).toBeLessThanOrEqual(4);
                expect(rerankRow.matchedOn).toMatch(/^\d{1,3}\/100 — /);
                expect(p.explanation).toContain('model xếp hạng');
            }
        } finally {
            await db.run(
                UPDATE(GRAPH_STEP_PARAMS).set({ wRerank: before.wRerank ?? null }).where({ stepCode: 'D4' }),
            );
            resetStepProfilesCache();
        }
    }, TIMEOUT);

    it('re-rank TẮT (mặc định) ⇒ không bước nào sinh bằng chứng rerank', async () => {
        await seedGraphStepParams();
        resetStepProfilesCache();
        const profiles = await getStepProfiles();
        for (const code of STEP_CODES) expect(profiles[code].rerank).toBeUndefined();
    }, TIMEOUT);

    it('buildAnchor gộp defectText và symptomShortText thành cùng một tập token', () => {
        const anchor = buildAnchor(contextOf({
            header: {
                symptomShortText: 'Pocket depth reading shallow',
                status: 'Open', foundDate: null, completionDate: null,
                quantityExtent: '', defectQuantity: null, defectQuantityUom: null, teamSize: null,
            },
        }));

        // `depth` chỉ có ở triệu chứng, `flange` chỉ có ở mô tả lỗi. Cả hai phải
        // cùng vào — đó chính là R3(b).
        expect(anchor.keywords).toEqual(expect.arrayContaining(['depth', 'flange']));
    });
});
