/**
 * Script so sánh định lượng giữa GraphDB và Vector Search (Scoring):
 * 1. Đo lường thời gian thực thi (Latency / Performance)
 * 2. Đo lường chất lượng kết quả tiền lệ (Precision, Relevance, Evidence Paths)
 * 
 * Chạy:
 *   npm run compare:engines                  # chạy trên case mặc định 8D-10048880
 *   npm run compare:engines -- 8D-10048412   # chạy trên 1 case cụ thể
 */

process.env.CDS_ENV = process.env.CDS_ENV || 'graph';

const cds = (await import('@sap/cds')).default;
const { mapCase } = await import('../srv/src/domain/eightd/caseMapper.ts');
const { findPrecedentsByStepGraph } = await import('../srv/src/domain/eightd/graph/engine.ts');
const { findPrecedentsByStep } = await import('../srv/src/domain/eightd/precedent/findPrecedents.ts');
const { STEP_CODES } = await import('../srv/src/domain/eightd/graph/stepProfiles.ts');

const args = process.argv.slice(2);
const targetCaseId = args.find((a) => !a.startsWith('-')) || '8D-10048880';

if (!cds.model) {
    cds.model = cds.linked(cds.compile.for.nodejs(await cds.load(cds.resolve('*'))));
}

const db = await cds.connect.to('db');

const rows = await db.run(
    'SELECT "NOTIFICATIONID", "SOURCEPAYLOAD" FROM "CNMA_PRORESOLVE_HISTORICALCASES" WHERE "NOTIFICATIONID" = ?',
    [targetCaseId],
);

if (!rows.length) {
    console.error(`\n❌ Không tìm thấy case [${targetCaseId}] trong kho HistoricalCases.`);
    process.exit(1);
}

const payload = JSON.parse(rows[0].SOURCEPAYLOAD);
const context = mapCase(payload);

console.log(`\n========================================================================================`);
console.log(`🔍 BENCHMARK: GRAPH DB vs VECTOR SEARCH (RAG / SCORING)`);
console.log(`📌 Case thử nghiệm: ${targetCaseId} - "${context.header.symptomShortText}"`);
console.log(`   - Vật tư: ${context.material?.materialId ?? 'N/A'} (${context.material?.materialGroup ?? 'N/A'})`);
console.log(`   - Trạm máy: ${context.workCenter?.workCenterId ?? 'N/A'}`);
console.log(`   - Mã lỗi: ${context.defect?.defectCode ?? 'N/A'} - ${context.defect?.defectText ?? 'N/A'}`);
console.log(`========================================================================================\n`);

// 1. Benchmark GraphDB
console.log(`⏳ Đang chạy engine [1/2]: SAP HANA Knowledge Graph (OpenCypher)...`);
const startGraph = performance.now();
const graphResult = await findPrecedentsByStepGraph(context);
const timeGraph = (performance.now() - startGraph).toFixed(2);

// 2. Benchmark Vector Search & Scoring
console.log(`⏳ Đang chạy engine [2/2]: Vector Search & Heuristic Scoring (Legacy)...`);
const startScoring = performance.now();
const scoringResult = await findPrecedentsByStep(context, payload);
const timeScoring = (performance.now() - startScoring).toFixed(2);

console.log(`\n📊 1. SO SÁNH THỜI GIAN THỰC THI (ANALYSIS LATENCY):`);
console.log(`----------------------------------------------------------------------------------------`);
console.log(`  🚀 SAP HANA GraphDB   : ${timeGraph.padStart(8)} ms  (In-Memory Cypher traversal, 0 tokens)`);
console.log(`  🐢 Vector Search/RAG  : ${timeScoring.padStart(8)} ms  (Gồm AI Core Embedding call + in-memory scoring)`);
const speedDiff = ((timeScoring - timeGraph) / timeScoring * 100).toFixed(1);
console.log(`  ⚡ Chênh lệch         : GraphDB nhanh hơn ~${speedDiff}%`);
console.log(`----------------------------------------------------------------------------------------\n`);

console.log(`🎯 2. SO SÁNH KẾT QUẢ THEO TỪNG BƯỚC D (QUALITY & PRECISION):`);
console.log(`----------------------------------------------------------------------------------------`);
const pad = (v, n) => String(v ?? '').padEnd(n).slice(0, n);

console.log(`  ${pad('Bước', 6)} ${pad('GraphDB (Tiền lệ : Điểm)', 36)} ${pad('Vector/Scoring (Tiền lệ : Điểm)', 36)}`);
console.log(`  --------------------------------------------------------------------------------------`);

for (const code of STEP_CODES) {
    const gList = graphResult.byStep[code].precedents;
    const sList = scoringResult.byStep[code].precedents;

    const gStr = gList.length
        ? gList.map((p) => `${p.notificationId}(${p.score})`).join(', ')
        : '— không có';
    const sStr = sList.length
        ? sList.map((p) => `${p.notificationId}(${p.score})`).join(', ')
        : '— không có';

    console.log(`  ${pad(code, 6)} ${pad(gStr, 36)} ${pad(sStr, 36)}`);
}
console.log(`----------------------------------------------------------------------------------------\n`);

console.log(`🔍 3. MINH CHỨNG VỀ CHẤT LƯỢNG & TÍNH GIẢI TRÌNH (EXPLAINABILITY):`);
console.log(`----------------------------------------------------------------------------------------`);
const topGraph = graphResult.union[0];
const topScoring = scoringResult.union[0];

console.log(`  • Top 1 Tiền Lệ của GraphDB : ${topGraph ? topGraph.notificationId : 'None'}`);
if (topGraph) {
    console.log(`    - Điểm số bằng chứng : ${topGraph.score} điểm`);
    console.log(`    - Căn cứ logic       : ${topGraph.explanation || 'Matches multiple relations'}`);
    if (topGraph.evidence && topGraph.evidence.length) {
        console.log(`    - Evidence Paths     :`);
        topGraph.evidence.forEach(e => {
            console.log(`       └─ [${e.kind}] ${e.detail} (+${e.points} pts)`);
        });
    }
}

console.log(`\n  • Top 1 Tiền Lệ của Vector/Scoring : ${topScoring ? topScoring.notificationId : 'None'}`);
if (topScoring) {
    console.log(`    - Điểm số tổng hợp   : ${topScoring.score}`);
    console.log(`    - Giải thích         : Điểm số tính theo trọng số bảng, không có liên kết đồ thị.`);
}
console.log(`----------------------------------------------------------------------------------------\n`);
