/**
 * Di trú db.sqlite cho Phase 3 — bốn cột mà worklist cần để sắp xếp, lọc và hiển thị.
 *
 * Thêm vào `Reports`:
 *
 *   slaResponseDue  DATE          hạn phản hồi khách (Q1); null ở Q2/Q3
 *   coordinator     NVARCHAR(100) người điều phối notification
 *   teamLeader      NVARCHAR(100) trưởng nhóm 8D đã chốt ở D1
 *   customerRef     NVARCHAR(50)  số hiệu khiếu nại của khách (Q1); null ở Q2/Q3
 *
 * ── Vì sao ba cột này phải tồn tại ──
 * Cả ba đã nằm trong `caseContext` (và `teamLeader` nằm trong `resultJson` của
 * D1). Nhưng cả hai đều là LargeString chứa JSON: OData không `$orderby` được
 * theo chúng và không `$filter` được theo chúng. Một cột "Due Date" đọc từ JSON
 * là một cột không sắp xếp được — tức là không trả lời được câu hỏi duy nhất nó
 * sinh ra để trả lời.
 *
 * ── Vì sao không dùng `cds deploy --to sqlite` ──
 * Lệnh đó dựng lại toàn bộ database từ schema rồi nạp CSV. Mọi 8D report, mọi
 * bản nháp, mọi thứ người dùng đã tạo trong lúc demo sẽ biến mất. Ở đây chỉ
 * thêm cột.
 *
 * ── Vì sao phải dựng lại VIEW ──
 * CAP sinh view cho service với danh sách cột LIỆT KÊ TƯỜNG MINH, không phải
 * `SELECT *`. Thêm cột vào bảng gốc thôi thì OData vẫn không thấy nó.
 *
 * ── Vì sao back-fill bỏ qua giá trị không phải ngày ──
 * `customer.slaResponseDue` là chuỗi tự do. Trong dữ liệu hiện có nó nhận hai
 * dạng: ngày ISO (case Q1) và sentinel 'N/A' / 'N/A - Internal Defect' (case nội
 * bộ). Cột mới là kiểu DATE và tồn tại để so với hôm nay — nên mọi thứ không
 * phải ngày thật đều để null, và số dòng bị bỏ qua được in ra. Chuỗi gốc vẫn
 * nguyên vẹn trong `caseContext`: không mất gì, chỉ là không giả vờ nó là ngày.
 *
 * Quyết định Q12 của kế hoạch nói thẳng: KHÔNG bịa hạn cho case Q2/Q3. Null ở
 * đây không phải dữ liệu thiếu, nó là câu trả lời đúng.
 *
 * Idempotent: chạy lại là vô hại — back-fill ghi đè bằng chính giá trị suy ra
 * từ dữ liệu nguồn, nên lần chạy thứ hai không đổi gì.
 *
 * Chạy: node scripts/migrate-worklist-fields.cjs
 */

const { DatabaseSync } = require('node:sqlite');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const db = new DatabaseSync(path.join(ROOT, 'db.sqlite'));

const REPORTS = 'cnma_proresolve_Reports';
const DISCIPLINES = 'cnma_proresolve_Disciplines';

function columns(table) {
    return db.prepare(`PRAGMA table_info("${table}")`).all().map((r) => r.name);
}

function addColumn(table, name, type) {
    if (columns(table).includes(name)) {
        console.log(`  = ${table}.${name} đã có`);
        return;
    }
    db.exec(`ALTER TABLE "${table}" ADD COLUMN ${name} ${type}`);
    console.log(`  + ${table}.${name}`);
}

/** Ngày ISO, hoặc null. Cùng luật với `isoDateOrNull` ở eightDRepository.ts. */
function isoDateOrNull(v) {
    if (typeof v !== 'string') return null;
    const s = v.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    return Number.isNaN(Date.parse(s)) ? null : s;
}

/** Số hiệu khiếu nại. Cùng luật với `customerRefOrNull` ở eightDRepository.ts. */
function customerRefOrNull(v) {
    if (typeof v !== 'string') return null;
    const s = v.trim();
    if (!s) return null;
    if (/^n\s*\/?\s*a\b/i.test(s)) return null;
    return s.slice(0, 50);
}

/** Trưởng nhóm trong `team.assignedRoster`. Cùng luật với `teamLeaderRefFrom`. */
function teamLeaderRefFrom(resultJson) {
    let data;
    try { data = JSON.parse(resultJson || '{}'); } catch { return null; }
    const roster = Array.isArray(data?.team?.assignedRoster) ? data.team.assignedRoster : [];
    const leader = roster.find((r) => r?.partnerRole === '8D Team Leader');
    if (!leader) return null;
    const name = String(leader.partnerName ?? '').trim();
    const partnerId = String(leader.partnerId ?? '').trim().replace(/^BP-/i, '');
    if (!name && !partnerId) return null;
    return { name: name || null, partnerId: partnerId || null };
}

/**
 * Danh bạ số hiệu → tên, dựng một lần từ `HistoricalTeamMembers`.
 *
 * Bảng nhân sự của D1 chỉ lưu `partnerId`; worklist cần một cái tên đọc được.
 * Cùng nguồn mà widget bảng nhân sự dùng, nên hai chỗ không thể nói tên khác nhau.
 */
function partnerDirectory() {
    const map = new Map();
    const rows = db.prepare(
        `SELECT partnerId, partnerName FROM cnma_proresolve_HistoricalTeamMembers
         WHERE partnerName IS NOT NULL AND TRIM(partnerName) <> ''`,
    ).all();
    for (const row of rows) {
        const id = String(row.partnerId ?? '').trim().replace(/^BP-/i, '');
        if (id && !map.has(id)) map.set(id, String(row.partnerName).trim());
    }
    return map;
}

console.log('1. Thêm cột');
addColumn(REPORTS, 'slaResponseDue', 'DATE');
addColumn(REPORTS, 'coordinator', 'NVARCHAR(100)');
addColumn(REPORTS, 'teamLeader', 'NVARCHAR(100)');
addColumn(REPORTS, 'customerRef', 'NVARCHAR(50)');

console.log('2. Back-fill customerRef + slaResponseDue + coordinator từ caseContext');
const reports = db.prepare(`SELECT ID, caseContext FROM ${REPORTS}`).all();
const setHeader = db.prepare(
    `UPDATE ${REPORTS} SET slaResponseDue = ?, coordinator = ?, customerRef = ? WHERE ID = ?`,
);

let dueSet = 0, dueSkipped = 0, coordSet = 0, refSet = 0, refSkipped = 0, unreadable = 0;
for (const r of reports) {
    let ctx;
    try { ctx = JSON.parse(r.caseContext || '{}'); } catch { unreadable++; continue; }

    const raw = ctx?.customer?.slaResponseDue ?? null;
    const due = isoDateOrNull(raw);
    if (due) dueSet++;
    else if (raw != null && String(raw).trim() !== '') dueSkipped++;

    const coord = ctx?.responsibility?.coordinator ?? null;
    const coordValue = typeof coord === 'string' && coord.trim() ? coord.trim() : null;
    if (coordValue) coordSet++;

    const rawRef = ctx?.customer?.complaintReference ?? null;
    const ref = customerRefOrNull(rawRef);
    if (ref) refSet++;
    else if (rawRef != null && String(rawRef).trim() !== '') refSkipped++;

    setHeader.run(due, coordValue, ref, r.ID);
}
console.log(`  ${dueSet} hạn phản hồi được ghi, ${dueSkipped} giá trị không phải ngày để trống`);
console.log(`  ${coordSet} người điều phối được ghi / ${reports.length} báo cáo`);
console.log(`  ${refSet} số hiệu khiếu nại được ghi, ${refSkipped} sentinel 'N/A…' để trống`);
if (unreadable) console.log(`  ⚠ ${unreadable} báo cáo có caseContext không đọc được — bỏ qua`);

console.log('3. Back-fill teamLeader từ resultJson của D1');
const d1 = db.prepare(
    `SELECT report_ID, resultJson FROM ${DISCIPLINES} WHERE code = 'D1' AND resultJson IS NOT NULL`,
).all();
const setLeader = db.prepare(`UPDATE ${REPORTS} SET teamLeader = ? WHERE ID = ?`);
const directory = partnerDirectory();
console.log(`  danh bạ có ${directory.size} người có tên`);

let byName = 0, byLookup = 0, byId = 0, noLeader = 0;
for (const row of d1) {
    const ref = teamLeaderRefFrom(row.resultJson);
    let leader = null;
    if (!ref) noLeader++;
    else if (ref.name) { leader = ref.name; byName++; }
    else if (directory.has(ref.partnerId)) { leader = directory.get(ref.partnerId); byLookup++; }
    else { leader = ref.partnerId; byId++; }
    setLeader.run(leader, row.report_ID);
}
console.log(`  ${byName} lấy tên thẳng từ D1, ${byLookup} tra được trong danh bạ, ${byId} chỉ còn số hiệu, ${noLeader} chưa chốt`);

/**
 * Dựng lại view.
 *
 * `cds compile --dialect sqlite` là NGUỒN SỰ THẬT duy nhất cho hình dạng view.
 * Chép tay danh sách cột ở đây là tạo ra một bản sao thứ hai sẽ lệch ngay lần
 * sửa schema kế tiếp.
 */
console.log('4. Dựng lại view từ cds compile');
const sql = execFileSync('npx', ['cds', 'compile', 'srv', '--to', 'sql', '--dialect', 'sqlite'], {
    cwd: ROOT, encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024, shell: true,
});

const statements = sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
const views = statements.filter((s) => /^CREATE VIEW/i.test(s));
if (!views.length) throw new Error('Không tìm thấy CREATE VIEW nào — đầu ra của cds compile đã đổi hình dạng?');

db.exec('PRAGMA foreign_keys = OFF');
let rebuilt = 0;
for (const stmt of views) {
    const name = stmt.match(/^CREATE VIEW\s+([^\s(]+)/i)[1];
    db.exec(`DROP VIEW IF EXISTS ${name}`);
    db.exec(stmt);
    rebuilt++;
}
console.log(`  ${rebuilt} view được dựng lại`);

// Kiểm chứng: đọc thật QUA VIEW của service, không chỉ tin là đã chạy xong. Đây
// là chỗ duy nhất phát hiện được "cột đã thêm nhưng OData vẫn không thấy".
console.log('5. Kiểm chứng');
const cols = columns('EightDService_Reports');
for (const c of ['slaResponseDue', 'coordinator', 'teamLeader', 'customerRef']) {
    console.log(`  EightDService_Reports có ${c}:`, cols.includes(c));
}
const withDue = db.prepare(
    'SELECT COUNT(*) AS n FROM EightDService_Reports WHERE slaResponseDue IS NOT NULL',
).get().n;
const withLeader = db.prepare(
    'SELECT COUNT(*) AS n FROM EightDService_Reports WHERE teamLeader IS NOT NULL',
).get().n;
console.log(`  Báo cáo có hạn phản hồi: ${withDue} · có trưởng nhóm: ${withLeader}`);
const sample = db.prepare(
    `SELECT notificationId, origin, customerRef, slaResponseDue, coordinator, teamLeader
     FROM EightDService_Reports ORDER BY createdAt DESC LIMIT 4`,
).all();
console.log('  Mẫu:', JSON.stringify(sample, null, 1));

db.close();
console.log('Xong.');
