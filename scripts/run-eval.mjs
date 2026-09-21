/**
 * Đánh giá pipeline 8D — bốn phép đo, xếp theo độ tin cậy giảm dần.
 *
 * ── Vì sao KHÔNG phải một điểm chất lượng duy nhất ──
 * Bản đầu của harness này chấm một báo cáo ra `5/38`, rồi chấm LẠI CHÍNH NÓ ra
 * `3.5/38`. Cùng input, `temperature: 0`, hai kết quả. Nghĩa là một con số tuyệt
 * đối ở đây không so được giữa hai lượt chạy — mà so được giữa hai lượt chạy
 * chính là toàn bộ lý do tính năng này tồn tại.
 *
 * Nên thứ tự đọc kết quả là:
 *
 *   1. SÀN NHIỄU   judge tự dao động bao nhiêu trên CÙNG một input
 *                  → không biết số này thì mọi số khác chưa kết luận được gì
 *   2. ĐỘ BỀN      chênh lệch điểm giữa bản sạch và bản bẩn của cùng một case
 *                  → bền với nhiễu (cùng judge chấm cả hai phía), và là phép đo
 *                    ĐÚNG cho sản phẩm này: giá trị của AI là đọc được dữ liệu bẩn
 *   3. TUÂN THỦ    luật đúng/sai, thuần code, đối chiếu được bằng tay
 *   4. CHẤT LƯỢNG  điểm judge — chỉ đọc được sau khi đã trừ sàn nhiễu
 *
 * Ba con số KHÔNG BAO GIỜ trộn vào nhau: trộn một điểm tất định vào ý kiến của
 * một model thì sau đó không còn biết điểm thấp là vì báo cáo phạm luật hay vì
 * judge chấm khắt.
 *
 * Chạy:
 *   npm run eval:judge -- --repeat 3        # ĐO SÀN NHIỄU trước tiên
 *   npm run eval:judge -- --limit 10        # 10 báo cáo mới nhất
 *   npm run eval:judge -- --case 8D-10048412
 *   npm run eval:judge -- --label trước khi sửa prompt D4
 *   npm run eval:judge -- --dry             # chấm nhưng KHÔNG ghi DB
 */

process.env.CDS_ENV = process.env.CDS_ENV || 'graph';

const cds = (await import('@sap/cds')).default;

/**
 * Nạp CDS model TRƯỚC khi chạm DB.
 *
 * `cds.connect.to('db')` không tự nạp nó, và thiếu model thì CQN mất khả năng ánh
 * xạ tên: `INSERT.into(...).entries({ qualityScore })` không map được sang cột và
 * ghi hụt trong im lặng. Xem §10 của `docs/GRAPH-RETRIEVAL-AND-RERANK.md`.
 */
if (!cds.model) {
    cds.model = cds.linked(cds.compile.for.nodejs(await cds.load(cds.resolve('*'))));
}

const { judgeReport, ACTIVITY_JUDGE } = await import('../srv/src/domain/eval/judge.ts');
const { checkCompliance } = await import('../srv/src/domain/eval/compliance.ts');
const { EVAL_DIMENSIONS, EVAL_PHASES } = await import('../srv/src/domain/eval/rubrics.ts');
const {
    averageRatio, closeRun, openRun, saveCaseScores, snapshotConfig,
} = await import('../srv/src/domain/eval/evalRepository.ts');
const { agreement, noiseFloor, robustness } = await import('../srv/src/domain/eval/metrics.ts');
const { rankLevers } = await import('../srv/src/domain/eval/leverCorrelation.ts');

const args = process.argv.slice(2);

/**
 * Đọc một cờ, gom TẤT CẢ token tới cờ kế tiếp.
 *
 * `--label "baseline: seeded stubs"` bị npm tách lại thành ba tham số, nên bản
 * đầu chỉ nhận được "baseline:" — một lượt chạy mang nhãn cắt cụt thì mất đúng
 * cái nó cần: nói được nó đang đo cấu hình nào.
 */
const flag = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    if (i < 0) return fallback;
    const rest = [];
    for (let k = i + 1; k < args.length && !args[k].startsWith('--'); k++) rest.push(args[k]);
    return rest.length ? rest.join(' ') : fallback;
};

const limit = Number(flag('limit', 5));
const onlyCase = flag('case', null);
const label = flag('label', `eval ${new Date().toISOString().slice(0, 16)}`);
const dryRun = args.includes('--dry');
const repeat = Math.max(1, Number(flag('repeat', 1)));

const db = await cds.connect.to('db');

/** LargeString qua raw SQL về dạng Buffer trên HANA. */
const text = (v) => (v == null ? null : Buffer.isBuffer(v) ? v.toString('utf8') : String(v));
const json = (v) => { try { return JSON.parse(text(v) ?? 'null'); } catch { return null; } };
const list = (v) => { const p = json(v); return Array.isArray(p) ? p : []; };
const pct = (v) => (v === null || v === undefined ? 'không đo được' : `${Math.round(v * 100)}%`);

const reports = await db.run(
    `SELECT "ID", "NOTIFICATIONID", "ORIGIN", "AIAGREESWITHRECORD",
            "INTERNALSUMMARY", "CUSTOMERSUMMARY"
     FROM "CNMA_PRORESOLVE_REPORTS"
     WHERE "INTERNALSUMMARY" IS NOT NULL${onlyCase ? ' AND "NOTIFICATIONID" = ?' : ''}
     ORDER BY "NOTIFICATIONID"`,
    onlyCase ? [onlyCase] : [],
);

const selected = onlyCase ? reports : reports.slice(0, limit);
if (!selected.length) {
    console.error(
        onlyCase
            ? `Không có báo cáo nào cho ${onlyCase}.`
            : 'Không có báo cáo nào trong DB. Chạy một lượt phân tích, hoặc `npm run seed:graph`.',
    );
    process.exit(1);
}

console.log(
    `\nChấm ${selected.length} báo cáo · activity=${ACTIVITY_JUDGE}`
    + `${repeat > 1 ? ` · ${repeat} lượt mỗi case (đo sàn nhiễu)` : ''}`
    + `${dryRun ? ' · DRY RUN' : ''}`,
);

const runId = dryRun ? null : await openRun({
    label, mode: 'grade-only', datasetFilter: onlyCase, caseCount: selected.length,
    snapshot: await snapshotConfig(ACTIVITY_JUDGE),
});

const started = Date.now();
const complianceRatios = [];
const qualityRatios = [];
const agreementRows = [];
const perCase = [];
const measuredFloors = [];
const dimensionTotals = {};
const violationsByRule = {};
let repairCount = 0;
let antiFabricationFailures = 0;
let totalAbstain = 0;
let failures = 0;

for (const row of selected) {
    // Báo cáo nằm ở HAI bảng: `Reports` giữ phần tóm tắt, `Disciplines` giữ tám
    // bước. Dựng lại `EightDResult` ở đây thay vì đọc một cột JSON — không có cột
    // nào như thế, và đó là chủ ý: `Disciplines` là thứ UI đọc và người duyệt sửa.
    const steps = await db.run(
        `SELECT "CODE","SEQUENCE","TITLE","SUMMARY","CONTENT","ACTIONITEMS","SOURCES",
                "CONFIDENCE","DATABACKED","VALIDATIONJSON"
         FROM "CNMA_PRORESOLVE_DISCIPLINES" WHERE "REPORT_ID" = ? ORDER BY "SEQUENCE"`,
        [row.ID],
    );

    if (!steps.length) {
        console.log(`\n✗ ${row.NOTIFICATIONID}: không có discipline nào`);
        failures++;
        continue;
    }

    const result = {
        internalSummary: text(row.INTERNALSUMMARY) ?? '',
        customerSummary: text(row.CUSTOMERSUMMARY),
        disciplines: steps.map((d) => ({
            code: d.CODE,
            sequence: Number(d.SEQUENCE),
            title: text(d.TITLE) ?? '',
            summary: text(d.SUMMARY) ?? '',
            content: text(d.CONTENT) ?? '',
            actionItems: list(d.ACTIONITEMS),
            sources: list(d.SOURCES),
            confidence: Number(d.CONFIDENCE) || 0,
            // `null` ở dòng nạp từ kho. Coi là false là đúng hướng an toàn: nó
            // nghĩa là "không khai có dữ liệu", nên phép kiểm sources không nổ oan.
            dataBacked: d.DATABACKED === true,
        })),
    };

    const validation = Object.fromEntries(steps.map((d) => [d.CODE, json(d.VALIDATIONJSON) ?? {}]));

    // Tầng 1 trước — nó là đầu vào ngữ cảnh cho judge, và nó đáng tin tuyệt đối.
    //
    // Vài dữ kiện chỉ có ở lượt phân tích (chuỗi 5-Why AI tự dựng, đường rò bằng
    // chứng mù) nên `grade-only` không có chúng. Truyền giá trị trung tính thay vì
    // để phép kiểm trượt oan rồi kéo điểm tuân thủ xuống.
    const compliance = checkCompliance({
        result,
        isCustomerFacing: String(text(row.ORIGIN) ?? '').startsWith('Q1'),
        hasPreventiveActions: true,
        derivedFiveWhyLength: 2,
        ruledOutCount: 4,
        blindLeaks: [],
        validation,
    });

    for (const [rule, n] of Object.entries(compliance.violationsByRule)) {
        violationsByRule[rule] = (violationsByRule[rule] ?? 0) + n;
    }
    repairCount += compliance.repairCount;
    antiFabricationFailures += compliance.antiFabricationFailures;

    const judgeInput = {
        notificationId: row.NOTIFICATIONID,
        result,
        compliance: {
            failed: compliance.failed,
            antiFabricationFailures: compliance.antiFabricationFailures,
            violationsByRule: compliance.violationsByRule,
        },
    };

    // Lượt đầu là kết quả chính; các lượt sau CHỈ để đo judge tự dao động bao nhiêu.
    const judged = await judgeReport(judgeInput);
    if (repeat > 1) {
        const samples = [judged];
        for (let k = 1; k < repeat; k++) samples.push(await judgeReport(judgeInput));
        const floor = noiseFloor(samples);
        if (floor) measuredFloors.push(floor);
    }

    complianceRatios.push(compliance.ratio);
    qualityRatios.push(judged.ratio);
    perCase.push({ notificationId: row.NOTIFICATIONID, ratio: judged.ratio });
    agreementRows.push({
        notificationId: row.NOTIFICATIONID,
        agreed: row.AIAGREESWITHRECORD == null ? null : Boolean(row.AIAGREESWITHRECORD),
    });
    totalAbstain += judged.abstainCount;

    for (const dim of judged.byDimension) {
        const t = dimensionTotals[dim.dimensionId] ?? { points: 0, maxPoints: 0 };
        t.points += dim.points;
        t.maxPoints += dim.maxPoints;
        dimensionTotals[dim.dimensionId] = t;
    }

    if (!dryRun) await saveCaseScores(runId, judged, compliance, row.ID);

    console.log(`\n━━ ${row.NOTIFICATIONID}`);
    console.log(`   tuân thủ    ${compliance.passed}/${compliance.passed + compliance.failed}`
        + `${compliance.antiFabricationFailures ? `  ⚠ ${compliance.antiFabricationFailures} lỗi chống bịa` : ''}`
        + `${compliance.violationCount ? `  · ${compliance.violationCount} vi phạm ràng buộc` : ''}`);
    console.log(`   chất lượng  ${judged.score}/${judged.maxScore}  ${pct(judged.ratio)}`
        + `${judged.abstainCount ? `  · ${judged.abstainCount} abstain` : ''}`);
    for (const e of judged.errors) console.log(`   ✗ pha ${e.phase}: ${e.message}`);

    // Ma trận 6×3 — thứ đáng nhìn nhất: nó nói chiều nào yếu ở pha nào.
    const w = Math.max(...EVAL_DIMENSIONS.map((d) => d.length));
    console.log(`   ${' '.repeat(w)}  ${EVAL_PHASES.map((p) => p.padEnd(8)).join('')}`);
    for (const dim of judged.byDimension) {
        const cells = EVAL_PHASES.map((p) => String(dim.perPhase[p] ?? '—').padEnd(8)).join('');
        console.log(`   ${dim.dimensionId.padEnd(w)}  ${cells} ${dim.points}/${dim.maxPoints}`);
    }
}

const agreementReport = agreement(agreementRows);
const robustnessReport = robustness(perCase);

/**
 * Sàn nhiễu gộp: lấy spread LỚN NHẤT trong các case đã đo lại.
 *
 * Lấy trung bình sẽ làm một case rất bất định biến mất sau khi bị pha loãng — mà
 * đúng case đó mới là thứ quyết định một chênh lệch có đáng tin hay không.
 */
const worstFloor = measuredFloors.length
    ? measuredFloors.reduce((a, b) => (b.spread > a.spread ? b : a))
    : null;

const totals = {
    complianceScore: averageRatio(complianceRatios),
    qualityScore: averageRatio(qualityRatios),
    agreementRate: agreementReport.measurableRate,
    durationMs: Date.now() - started,
    errorMessage: failures ? `${failures} case không chấm được` : null,
};

if (!dryRun) await closeRun(runId, totals);

// ── Kết quả, xếp theo độ tin cậy giảm dần ───────────────────────────────────

console.log(`\n═══ ${label}`);

console.log('');
if (worstFloor) {
    console.log(`    1· SÀN NHIỄU    ±${Math.round(worstFloor.spread * 100)}%`
        + `   (${worstFloor.samples} lượt trên cùng một báo cáo, sd ${worstFloor.stdDev})`);
    if (worstFloor.unstableDimensions.length) {
        console.log(`         chiều bất định: ${worstFloor.unstableDimensions.join(', ')}`);
        console.log('         → chỗ sửa ĐỊNH NGHĨA thang chấm, không phải chỗ chấp nhận nhiễu');
    }
    console.log(`         mọi chênh lệch nhỏ hơn ${Math.round(worstFloor.spread * 100)}% CHƯA kết luận được`);
} else {
    console.log('    1· SÀN NHIỄU    chưa đo');
    console.log('         → chạy `--repeat 3` trước khi tin bất kỳ chênh lệch nào');
}

console.log('');
if (robustnessReport.pairs.length) {
    console.log(`    2· ĐỘ BỀN       sạch−bẩn trung bình ${pct(robustnessReport.meanGap)}`
        + `   (${robustnessReport.pairs.length} cặp)`);
    if (robustnessReport.worst && robustnessReport.worst.gap !== null) {
        console.log(`         tụt sâu nhất: ${robustnessReport.worst.clean} → `
            + `${robustnessReport.worst.dirty}  ${pct(robustnessReport.worst.gap)}`);
    }
    console.log('         chênh lệch nhỏ = AI đọc được dữ liệu SAP bẩn, đúng giá trị nó phải tạo ra');
} else {
    console.log('    2· ĐỘ BỀN       không có cặp sạch/bẩn nào trong tập đã chấm'
        + `${robustnessReport.unpaired.length ? ` (${robustnessReport.unpaired.length} case lẻ)` : ''}`);
    console.log('         → nạp cả `mock-data/dirty/` để đo được phép đo đáng tin nhất');
}

console.log('');
console.log(`    3· TUÂN THỦ     ${pct(totals.complianceScore)}   (luật đúng/sai, thuần code)`);
if (antiFabricationFailures) {
    console.log(`         ⚠ ${antiFabricationFailures} lỗi CHỐNG BỊA — nặng hơn mọi điểm số khác`);
}

console.log('');
console.log(`    4· CHẤT LƯỢNG   ${pct(totals.qualityScore)}   (judge)`);
console.log(`    ·  ĐỒNG THUẬN   ${pct(agreementReport.measurableRate)}`
    + `   (${agreementReport.measurableCount} case có đáp án không tranh chấp)`);
if (agreementReport.contested.length) {
    console.log('         bất đồng có căn cứ — KHÔNG tính vào tỉ lệ, vì bất đồng ở đây là ĐÚNG:');
    for (const c of agreementReport.contested) {
        console.log(`           ${c.notificationId}  `
            + `${c.correctBehaviour ? '✓ lệch đúng' : '✗ nhường một bản ghi sai'}`);
    }
}
if (agreementReport.unmarkedCount) {
    console.log(`         ${agreementReport.unmarkedCount} case không ai ghi đáp án`
        + ' — không đo được, KHÔNG phải 0%');
}

// ── Advisor tầng 1 — thuần code, không một lượt gọi model nào ───────────────
const dimensionRatios = Object.fromEntries(
    Object.entries(dimensionTotals).map(([id, t]) => [id, t.maxPoints > 0 ? t.points / t.maxPoints : null]),
);
const levers = rankLevers({
    compliance: { violationsByRule, repairCount, antiFabricationFailures },
    dimensionRatios,
    emptyPrecedentCount: 0,
    caseCount: selected.length,
    abstainCount: totalAbstain,
    noise: worstFloor,
});

if (levers.length) {
    console.log('\n    CẦN XEM  (thuần code, không có lượt gọi model nào)');
    for (const l of levers.slice(0, 5)) {
        console.log(`      [${l.type}] ${l.targetKey}`);
        console.log(`        ${l.evidence}`);
    }
}

console.log(`\n    ${Math.round(totals.durationMs / 1000)}s`
    + `${dryRun ? ' · KHÔNG ghi DB' : ` · lượt chạy ${runId}`}`);

process.exit(0);
