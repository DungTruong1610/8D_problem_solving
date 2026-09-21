/**
 * Di trú db.sqlite cho Phase 1.7 — bảng dải số do server cấp.
 *
 * `cds deploy --to sqlite` sẽ dựng lại toàn bộ database và xoá sạch report,
 * bản nháp, mọi thứ người dùng đã tạo. Ở đây chỉ thêm một bảng.
 *
 * ── Vì sao suy `currentValue` từ dữ liệu thật, không lấy từ CSV ──
 * File CSV seed mang con số đúng tại thời điểm viết. Database của mỗi máy thì
 * khác nhau — ai đó vừa nhập thêm 50 lô. Đặt bộ đếm thấp hơn số lớn nhất đang có
 * nghĩa là mọi lần cấp kế tiếp đều phải quay vòng qua vòng kiểm-tra-trùng, và
 * nếu vòng đó có sai sót thì hậu quả là một mã trùng trong sổ có tính pháp lý.
 * Đọc max() một lần ở đây rẻ hơn nhiều.
 *
 * Idempotent: chạy lại chỉ kéo bộ đếm LÊN, không bao giờ hạ xuống.
 *
 * Chạy: node scripts/migrate-number-ranges.cjs
 */

const { DatabaseSync } = require('node:sqlite');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const db = new DatabaseSync(path.join(ROOT, 'db.sqlite'));

const RANGES = [
    {
        object: 'DEFECT',
        prefix: '8D-',
        width: 8,
        description: 'Quality notification / 8D case number (QMEL)',
        source: { table: 'cnma_proresolve_HistoricalCases', column: 'notificationId' },
    },
    {
        object: 'INSPLOT',
        prefix: '',
        width: 10,
        description: 'Inspection lot number (QALS)',
        source: { table: 'cnma_proresolve_InspectionLots', column: 'lotId' },
    },
];

console.log('1. Tạo bảng cnma_proresolve_NumberRanges');
const has = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cnma_proresolve_NumberRanges'").get();
if (has) {
    console.log('  = đã có');
} else {
    // Lấy đúng câu CREATE TABLE do cds sinh ra, không viết tay: viết tay là tạo
    // ra một bản sao thứ hai của schema sẽ lệch ngay lần sửa kế tiếp.
    const sql = execFileSync('npx', ['cds', 'compile', 'srv', '--to', 'sql', '--dialect', 'sqlite'], {
        cwd: ROOT, encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024, shell: true,
    });
    const stmt = sql.split(/;\s*\n/).map((s) => s.trim())
        .find((s) => /^CREATE TABLE cnma_proresolve_NumberRanges\b/i.test(s));
    if (!stmt) throw new Error('Không tìm thấy CREATE TABLE cho NumberRanges trong đầu ra cds compile');
    db.exec(stmt);
    console.log('  + đã tạo');
}

console.log('2. Đặt bộ đếm theo dữ liệu đang có');
const now = new Date().toISOString();
for (const r of RANGES) {
    const rows = db.prepare(`SELECT "${r.source.column}" AS v FROM "${r.source.table}"`).all();
    let max = 0;
    for (const row of rows) {
        const m = String(row.v ?? '').match(/(\d+)\s*$/);
        if (m) max = Math.max(max, Number(m[1]));
    }

    const existing = db.prepare('SELECT currentValue FROM cnma_proresolve_NumberRanges WHERE object = ?').get(r.object);
    if (!existing) {
        db.prepare(
            'INSERT INTO cnma_proresolve_NumberRanges (object, prefix, currentValue, width, description, createdAt, modifiedAt) '
            + 'VALUES (?, ?, ?, ?, ?, ?, ?)',
        ).run(r.object, r.prefix, max, r.width, r.description, now, now);
        console.log(`  + ${r.object} = ${max} (từ ${rows.length} dòng ${r.source.table})`);
    } else if (max > Number(existing.currentValue)) {
        db.prepare('UPDATE cnma_proresolve_NumberRanges SET currentValue = ?, modifiedAt = ? WHERE object = ?')
            .run(max, now, r.object);
        console.log(`  ↑ ${r.object} ${existing.currentValue} → ${max}`);
    } else {
        console.log(`  = ${r.object} đã ở ${existing.currentValue}, dữ liệu cao nhất là ${max}`);
    }
}

console.log('3. Kiểm chứng');
for (const row of db.prepare('SELECT object, prefix, currentValue, width FROM cnma_proresolve_NumberRanges ORDER BY object').all()) {
    const next = String(Number(row.currentValue) + 1).padStart(row.width, '0');
    console.log(`  ${row.object}: số kế tiếp sẽ là ${row.prefix ?? ''}${next}`);
}

db.close();
console.log('Xong.');
