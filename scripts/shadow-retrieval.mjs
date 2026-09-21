/**
 * Chạy CÙNG một case qua CẢ HAI engine truy hồi rồi in bảng so sánh.
 *
 * ── Vì sao cần script này ──
 * Cách hiển nhiên để giảm rủi ro khi đổi engine là bật dần từng bước: D4 chạy
 * graph, bảy bước còn lại giữ nguyên. Cách đó hỏng âm thầm — `mergeStepPrecedents`
 * gộp tám bước thành MỘT danh sách đánh số một lần và giữ bản điểm cao nhất, nên
 * một báo cáo lai đang so điểm graph với điểm thang 16 bằng phép `>`, và
 * `precedents#1` thôi không còn là case mạnh nhất. Không lớp nào bắt được: kiểm
 * trích dẫn chỉ khớp `^(team\.|precedents#)`, mà trích dẫn sai vẫn đúng cú pháp.
 *
 * Nên công tắc engine là toàn cục, và chỗ đối chiếu hai engine là ĐÂY — ngoài
 * luồng sinh báo cáo, nơi so sánh không thể rò vào output cho người dùng.
 *
 * ── Vì sao lấy case ngay trong kho làm case "đang mở" ──
 * Cả hai engine đều tự loại chính nó, nên một case lịch sử là bài thử thật nhất
 * mà không cần dựng payload giả: nó có đủ work center, vật tư, mã lỗi, mô tả và
 * triệu chứng đúng như một case thật, vì nó LÀ một case thật.
 *
 * Chạy:
 *   npm run shadow:graph                          # cả 25 case trong kho
 *   npm run shadow:graph -- 8D-10048412           # đúng một case
 *   npm run shadow:graph -- 8D-10048412 --rerank  # bật tầng 2 cho D4/D5
 *
 * ── Vì sao `--rerank` phải sống ở đây chứ không ở jest ──
 * Provider của CDK nạp ESM động, thứ ts-jest chạy ở chế độ CJS không làm được:
 * gọi model trong jest chết với `Unexpected token 'export'`. Script này chạy dưới
 * tsx/ESM đúng như production, nên đây là chỗ DUY NHẤT chứng minh được lượt gọi
 * model thật. Trong jest, đường thành công được chứng minh bằng một provider giả
 * (`graph/__tests__/rerankWiring.test.ts`).
 */

process.env.CDS_ENV = process.env.CDS_ENV || 'graph';

const cds = (await import('@sap/cds')).default;
const { mapCase } = await import('../srv/src/domain/eightd/caseMapper.ts');
const { findPrecedentsByStepGraph } = await import('../srv/src/domain/eightd/graph/engine.ts');
const { findPrecedentsByStep } = await import('../srv/src/domain/eightd/precedent/findPrecedents.ts');
const { STEP_CODES } = await import('../srv/src/domain/eightd/graph/stepProfiles.ts');
const { resetStepProfilesCache } = await import('../srv/src/domain/eightd/graph/settings.ts');

const args = process.argv.slice(2);
const only = args.find((a) => !a.startsWith('-'));
const withRerank = args.includes('--rerank');

/**
 * Nạp CDS model TRƯỚC khi chạm DB.
 *
 * `cds.connect.to('db')` không tự nạp nó, và thiếu model thì CQN mất khả năng
 * ánh xạ tên: `UPDATE(...).set({ wRerank: 4 })` không map được sang cột `WRERANK`
 * nên KHÔNG ghi gì, im lặng, không lỗi. Bản đầu của cờ `--rerank` chạy trót lọt
 * và in ra một bảng "đã bật re-rank" trong khi tầng 2 chưa từng chạy.
 */
if (!cds.model) {
    cds.model = cds.linked(cds.compile.for.nodejs(await cds.load(cds.resolve('*'))));
}

const db = await cds.connect.to('db');

// Bật tầng 2 cho D4/D5 rồi trả lại nguyên trạng — script đo, không được để lại
// một cấu hình khác lúc nó bắt đầu.
const GRAPH_STEP_PARAMS = 'cnma.proresolve.GraphStepParams';
let restoreRerank = null;
if (withRerank) {
    const before = await db.run(
        SELECT.from(GRAPH_STEP_PARAMS).columns('stepCode', 'wRerank', 'minScore')
            .where({ stepCode: { in: ['D4', 'D5'] } }),
    );
    // `minScore - 1`, KHÔNG phải một con số cố định: `normalizeStepParams` từ chối
    // mọi dòng có `wRerank >= minScore`, vì để lọt nghĩa là model thích case nào
    // thì case đó thành tiền lệ. Bản đầu của script đặt cứng 4 cho cả hai bước và
    // D5 (minScore 4) bị từ chối im lặng — bảng in ra "đã bật" trong khi D5 chưa
    // từng chạy tầng 2.
    for (const r of before) {
        await db.run(UPDATE(GRAPH_STEP_PARAMS)
            .set({ wRerank: Math.max(1, Number(r.minScore) - 1) })
            .where({ stepCode: r.stepCode }));
    }
    resetStepProfilesCache();
    restoreRerank = async () => {
        for (const r of before) {
            await db.run(UPDATE(GRAPH_STEP_PARAMS).set({ wRerank: r.wRerank ?? null }).where({ stepCode: r.stepCode }));
        }
        resetStepProfilesCache();
    };
    console.log(
        '[shadow] re-rank BẬT: '
        + before.map((r) => `${r.stepCode} wRerank=${Math.max(1, Number(r.minScore) - 1)}`).join(', ')
        + ' — sẽ trả lại sau khi chạy xong.',
    );
}

const rows = await db.run(
    'SELECT "NOTIFICATIONID", "SOURCEPAYLOAD" FROM "CNMA_PRORESOLVE_HISTORICALCASES"'
    + (only ? ' WHERE "NOTIFICATIONID" = ?' : '')
    + ' ORDER BY "NOTIFICATIONID"',
    only ? [only] : [],
);

if (!rows.length) {
    console.error(only ? `Không có case ${only} trong kho.` : 'Kho rỗng — chạy `npm run seed:graph` trước.');
    process.exit(1);
}

const pad = (v, n) => String(v ?? '').padEnd(n).slice(0, n);
const totals = { graphOnly: 0, scoringOnly: 0, both: 0, graphEmpty: 0, scoringEmpty: 0 };

for (const row of rows) {
    let context;
    try {
        context = mapCase(JSON.parse(row.SOURCEPAYLOAD));
    } catch (e) {
        console.log(`\n${row.NOTIFICATIONID}: không dựng được CaseContext (${e.message}) — bỏ qua.`);
        continue;
    }

    const [graph, scoring] = [
        await findPrecedentsByStepGraph(context),
        await findPrecedentsByStep(context, JSON.parse(row.SOURCEPAYLOAD)),
    ];

    console.log(`\n═══ ${row.NOTIFICATIONID} — ${context.header.symptomShortText}`);
    console.log(`    ${pad('step', 5)}${pad('graph', 40)}${pad('scoring (hiện tại)', 40)}`);

    for (const code of STEP_CODES) {
        const g = graph.byStep[code].precedents;
        const s = scoring.byStep[code].precedents;
        const fmt = (list) => list.length
            ? list.map((p) => `${p.notificationId}:${p.score}`).join(' ')
            : '— không có';
        console.log(`    ${pad(code, 5)}${pad(fmt(g), 40)}${pad(fmt(s), 40)}`);

        const gs = new Set(g.map((p) => p.notificationId));
        const ss = new Set(s.map((p) => p.notificationId));
        for (const id of gs) (ss.has(id) ? totals.both++ : totals.graphOnly++);
        for (const id of ss) if (!gs.has(id)) totals.scoringOnly++;
        if (!g.length) totals.graphEmpty++;
        if (!s.length) totals.scoringEmpty++;
    }

    const top = graph.union[0];
    if (top) console.log(`    union#1 (graph) ${top.notificationId} — ${top.explanation}`);
}

console.log('\n═══ tổng hợp trên %d case × %d bước', rows.length, STEP_CODES.length);
console.log(`    cả hai engine cùng tìm ra   ${totals.both}`);
console.log(`    chỉ graph tìm ra            ${totals.graphOnly}`);
console.log(`    chỉ engine cũ tìm ra        ${totals.scoringOnly}`);
console.log(`    graph nói "không có"        ${totals.graphEmpty} / ${rows.length * STEP_CODES.length} ô`);
console.log(`    engine cũ nói "không có"    ${totals.scoringEmpty} / ${rows.length * STEP_CODES.length} ô`);

if (restoreRerank) {
    await restoreRerank();
    console.log('[shadow] đã trả lại wRerank như trước khi chạy.');
}

process.exit(0);
