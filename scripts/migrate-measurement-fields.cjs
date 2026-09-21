/**
 * Di trú db.sqlite cho Phase 1.4 — số lượng có đơn vị, giới hạn spec, valuation,
 * và cột work center thật của lô kiểm tra.
 *
 * ── Vì sao không dùng `cds deploy --to sqlite` ──
 * Lệnh đó dựng lại toàn bộ database từ schema rồi nạp CSV. Mọi 8D report, mọi
 * bản nháp, mọi thứ người dùng đã tạo trong lúc demo sẽ biến mất. Ở đây chỉ thêm
 * cột, giữ nguyên dữ liệu.
 *
 * ── Vì sao phải dựng lại VIEW ──
 * CAP sinh view cho service với danh sách cột LIỆT KÊ TƯỜNG MINH, không phải
 * `SELECT *`. Thêm cột vào bảng gốc thôi thì OData vẫn không thấy nó — view cũ
 * không hề nhắc tới cột mới. Nên: drop rồi tạo lại đúng 33 view từ SQL do
 * `cds compile` sinh ra, thay vì viết tay.
 *
 * Idempotent: chạy lại là vô hại. Sao lưu db.sqlite trước cho chắc.
 *
 * Chạy: node scripts/migrate-measurement-fields.cjs
 */

const { DatabaseSync } = require('node:sqlite');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DB = path.join(ROOT, 'db.sqlite');
const CSV = path.join(ROOT, 'db/data/cnma.proresolve-InspectionLots.csv');

const db = new DatabaseSync(DB);

function columns(table) {
    return db.prepare(`PRAGMA table_info("${table}")`).all().map((r) => r.name);
}

/** Thêm cột nếu chưa có. Chạy lại script lần hai phải là chuyện vô hại. */
function addColumn(table, name, type) {
    if (columns(table).includes(name)) {
        console.log(`  = ${table}.${name} đã có`);
        return;
    }
    db.exec(`ALTER TABLE "${table}" ADD COLUMN ${name} ${type}`);
    console.log(`  + ${table}.${name}`);
}

console.log('1. Thêm cột');
addColumn('cnma_proresolve_Reports', 'defectQuantity', 'DECIMAL(13,3)');
addColumn('cnma_proresolve_Reports', 'defectQuantityUom', 'NVARCHAR(3)');
addColumn('cnma_proresolve_InspectionLots', 'workCenterId', 'NVARCHAR(30)');

/**
 * Back-fill từ CSV.
 *
 * Nguồn là chính file mà generator vừa ghi ra, khớp theo `lotId`. Không suy từ
 * mã equipment: quy ước `<trạm>-<đồ gá>` là quy ước của bộ dữ liệu mẫu, và một
 * script di trú không phải chỗ để đoán.
 */
console.log('2. Back-fill InspectionLots.workCenterId từ CSV');
const lines = fs.readFileSync(CSV, 'utf-8').split(/\r?\n/).filter(Boolean);
const header = lines[0].split(';');
const iLot = header.indexOf('lotId');
const iWc = header.indexOf('workCenterId');
if (iLot < 0 || iWc < 0) throw new Error('CSV thiếu cột lotId hoặc workCenterId');

const upd = db.prepare('UPDATE cnma_proresolve_InspectionLots SET workCenterId = ? WHERE lotId = ? AND (workCenterId IS NULL OR workCenterId = \'\')');
let filled = 0;
for (const line of lines.slice(1)) {
    const cells = line.split(';');
    const r = upd.run(cells[iWc], cells[iLot]);
    filled += r.changes;
}
const missing = db.prepare("SELECT COUNT(*) AS n FROM cnma_proresolve_InspectionLots WHERE workCenterId IS NULL OR workCenterId = ''").get().n;
console.log(`  ${filled} dòng được điền, ${missing} dòng còn trống`);

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

// Các câu lệnh cách nhau bằng ';' ở cuối dòng. Chỉ lấy CREATE VIEW: bảng đã tồn
// tại và có dữ liệu, đụng vào là mất.
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

// Kiểm chứng: đọc thật qua view của service, không chỉ tin là đã chạy xong.
console.log('4. Kiểm chứng');
const check = db.prepare('SELECT lotId, workCenterId FROM EightDService_InspectionLots WHERE workCenterId IS NOT NULL LIMIT 3').all();
console.log('  EightDService_InspectionLots:', JSON.stringify(check));
const cols = db.prepare('PRAGMA table_info(EightDService_Reports)').all().map((r) => r.name);
console.log('  EightDService_Reports có defectQuantity:', cols.includes('defectQuantity'), '/ defectQuantityUom:', cols.includes('defectQuantityUom'));

db.close();
console.log('Xong.');
