/**
 * Di trú db.sqlite cho Phase 5 — nguồn gốc của mỗi dòng trong kho tiền lệ.
 *
 * Thêm hai cột vào `HistoricalCases`:
 *
 *   provenance      'imported' | 'closed-in-app'
 *   sourceReportID  lượt chạy 8D đã đóng case (null với dòng import)
 *
 * ── Vì sao không dùng `cds deploy --to sqlite` ──
 * Lệnh đó dựng lại toàn bộ database từ schema rồi nạp CSV. Mọi 8D report, mọi bản
 * nháp, mọi thứ người dùng đã tạo trong lúc demo sẽ biến mất. Ở đây chỉ thêm cột.
 *
 * ── Vì sao phải dựng lại VIEW ──
 * CAP sinh view cho service với danh sách cột LIỆT KÊ TƯỜNG MINH, không phải
 * `SELECT *`. Thêm cột vào bảng gốc thôi thì OData vẫn không thấy nó.
 *
 * ── Vì sao back-fill là 'imported' chứ không để null ──
 * Mọi dòng đang có trong kho đều vào bằng đúng một đường: nạp hàng loạt. Để null
 * thì màn hình phải hiện một ô trống mà không ai giải thích được, và câu hỏi "case
 * này từ đâu ra" — lý do duy nhất khiến cột này tồn tại — vẫn không trả lời được
 * cho đúng những dòng đang có.
 *
 * Idempotent: chạy lại là vô hại. Back-fill chỉ chạm dòng còn null.
 *
 * Chạy: node scripts/migrate-case-provenance.cjs
 */

const { DatabaseSync } = require('node:sqlite');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const db = new DatabaseSync(path.join(ROOT, 'db.sqlite'));

const TABLE = 'cnma_proresolve_HistoricalCases';

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

console.log('1. Thêm cột');
addColumn(TABLE, 'provenance', 'NVARCHAR(20)');
addColumn(TABLE, 'sourceReportID', 'NVARCHAR(36)');

console.log("2. Back-fill provenance = 'imported'");
const filled = db.prepare(
    `UPDATE ${TABLE} SET provenance = 'imported' WHERE provenance IS NULL OR provenance = ''`,
).run().changes;
const total = db.prepare(`SELECT COUNT(*) AS n FROM ${TABLE}`).get().n;
console.log(`  ${filled} dòng được điền / ${total} dòng trong kho`);

/**
 * Dựng lại view.
 *
 * `cds compile --dialect sqlite` là NGUỒN SỰ THẬT duy nhất cho hình dạng view.
 * Chép tay danh sách cột ở đây là tạo ra một bản sao thứ hai sẽ lệch ngay lần
 * sửa schema kế tiếp.
 */
console.log('3. Dựng lại view từ cds compile');
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
console.log('4. Kiểm chứng');
const cols = db.prepare('PRAGMA table_info(EightDService_HistoricalCases)').all().map((r) => r.name);
console.log('  EightDService_HistoricalCases có provenance:', cols.includes('provenance'),
    '/ sourceReportID:', cols.includes('sourceReportID'));
const sample = db.prepare(
    'SELECT notificationId, provenance, sourceReportID FROM EightDService_HistoricalCases ORDER BY notificationId LIMIT 3',
).all();
console.log('  Mẫu:', JSON.stringify(sample));
const byProvenance = db.prepare(
    'SELECT provenance, COUNT(*) AS n FROM EightDService_HistoricalCases GROUP BY provenance',
).all();
console.log('  Phân bố:', JSON.stringify(byProvenance));

db.close();
console.log('Xong.');
