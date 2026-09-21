/**
 * Đo phân bố cosine thật giữa các case trong kho.
 *
 * Dùng để CHỌN `weight` và `minSimilarity` của tiêu chí ngữ nghĩa bằng số liệu
 * thay vì đoán. Hai con số đó quyết định tiêu chí này có ích hay chỉ gây nhiễu:
 * đặt sàn quá thấp thì mọi case đều được cộng điểm nền và thứ hạng mất ý nghĩa;
 * quá cao thì nó không bao giờ kích hoạt.
 *
 * Chạy lại mỗi khi đổi công thức ghép `searchText` hoặc đổi model nhúng.
 *
 *   npx tsx scripts/measure-similarity.mjs [--case 8D-10048412]
 */
const HOST = process.env.SEED_HOST ?? 'http://localhost:4007';
const AUTH = { Authorization: 'Basic ' + Buffer.from(`${process.env.SEED_USER ?? 'admin'}:${process.env.SEED_PASS ?? '123'}`).toString('base64') };

const args = process.argv.slice(2);
const focusIdx = args.indexOf('--case');
const focus = focusIdx >= 0 ? args[focusIdx + 1] : '8D-10048412';

const res = await fetch(
    `${HOST}/api/cnma/EIGHTD_SRV/HistoricalCases`
    + '?$select=notificationId,sapStatus,workCenterId,materialId,materialFamily,defectCode,defectText,embedding,embeddingModel',
    { headers: AUTH },
);
const rows = (await res.json()).value ?? [];
const withVec = rows.filter((r) => r.embedding);
console.log(`${rows.length} case, ${withVec.length} đã nhúng (${withVec[0]?.embeddingModel ?? '-'})\n`);
if (withVec.length < 2) process.exit(1);

const cos = (a, b) => {
    let d = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return d / (Math.sqrt(na) * Math.sqrt(nb));
};
const vec = new Map(withVec.map((r) => [r.notificationId, JSON.parse(r.embedding)]));

// ── Phân bố toàn bộ các cặp ────────────────────────────────────────────────
const pairs = [];
for (let i = 0; i < withVec.length; i++) {
    for (let j = i + 1; j < withVec.length; j++) {
        pairs.push({
            a: withVec[i].notificationId,
            b: withVec[j].notificationId,
            sim: cos(vec.get(withVec[i].notificationId), vec.get(withVec[j].notificationId)),
        });
    }
}
pairs.sort((x, y) => y.sim - x.sim);
const sims = pairs.map((p) => p.sim);
const q = (p) => sims[Math.min(sims.length - 1, Math.floor(p * (sims.length - 1)))];

console.log(`Phân bố ${pairs.length} cặp:`);
console.log(`   thấp nhất ${sims[sims.length - 1].toFixed(3)}   p25 ${q(0.75).toFixed(3)}`
    + `   trung vị ${q(0.5).toFixed(3)}   p75 ${q(0.25).toFixed(3)}   cao nhất ${sims[0].toFixed(3)}`);

console.log('\n5 cặp giống nhau nhất:');
for (const p of pairs.slice(0, 5)) console.log(`   ${p.sim.toFixed(3)}  ${p.a}  ${p.b}`);

// ── Case đang quan tâm ─────────────────────────────────────────────────────
const me = withVec.find((r) => r.notificationId === focus);
if (!me) { console.log(`\nKhông có ${focus} trong kho.`); process.exit(0); }

console.log(`\n${focus} — "${me.defectText}"  ${me.workCenterId} ${me.materialId} ${me.materialFamily}`);
console.log('   cosine  trạng thái    case          khoá trùng');
for (const r of withVec.filter((x) => x.notificationId !== focus)
    .map((x) => ({ ...x, sim: cos(vec.get(focus), vec.get(x.notificationId)) }))
    .sort((x, y) => y.sim - x.sim)) {
    const shared = [
        r.workCenterId === me.workCenterId ? 'WC' : null,
        r.defectCode === me.defectCode ? 'defect' : null,
        r.materialId === me.materialId ? 'material' : null,
        r.materialId !== me.materialId && r.materialFamily === me.materialFamily ? 'họ vật tư' : null,
    ].filter(Boolean);
    console.log(`   ${r.sim.toFixed(3)}   ${(r.sapStatus ?? '').padEnd(11)} ${r.notificationId}   `
        + (shared.length ? shared.join(', ') : '— không trùng gì —'));
}
