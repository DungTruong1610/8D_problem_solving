/**
 * Di trú db.sqlite cho Phase 4 — năm cột Quality Task trên `HistoricalActions`.
 *
 *   taskCode        NVARCHAR(20)  mã nhiệm vụ (catalog type 2), suy ra bằng luật
 *   taskCodeGroup   NVARCHAR(20)  nhóm của mã đó
 *   taskProcessor   NVARCHAR(120) SAP Task Processor
 *   timeEffort      DECIMAL(5,1)  SAP Time Effort, theo ngày
 *   plannedEndDate  DATE          hạn dự kiến
 *
 * ── Vì sao chỉ hai cột đầu được back-fill ──
 * Dataset nguồn không mang người thực hiện, công sức, hay hạn của từng hành động
 * — nó chỉ mang một câu văn và một trạng thái. Ba cột sau để NULL trên toàn bộ
 * case nhập từ dataset. Đó không phải dữ liệu thiếu, đó là câu trả lời đúng:
 * cùng thái độ đã áp cho `HistoricalTeamMembers.email`/`phone`. Case đóng TRONG
 * app đi qua `closedCaseWriteBack` và mang đủ cả năm.
 *
 * ── Vì sao script này là .mts chạy bằng tsx, không phải .cjs như các migration khác ──
 * Nó cần `classifyTaskCode`, một bộ 30 luật regex có thứ tự. Các migration cũ
 * chép lại hàm nguồn sang CJS kèm ghi chú "cùng luật với..." — chấp nhận được với
 * một regex bốn dòng, KHÔNG chấp nhận được với 30 luật mà thứ tự là một phần của
 * luật. Bản chép sẽ lệch, và lệch lặng lẽ: cột vẫn có giá trị, chỉ là giá trị
 * khác với thứ server ghi ra hôm sau. Import thẳng thì không có bản thứ hai để
 * lệch.
 *
 * ── Vì sao phải dựng lại VIEW ──
 * `EightDService_HistoricalActions` liệt kê cột TƯỜNG MINH. Thêm cột vào bảng
 * gốc thôi thì OData vẫn không thấy nó.
 *
 * Idempotent: back-fill ghi lại đúng giá trị suy ra từ `actionText`, nên lần chạy
 * thứ hai không đổi gì. Chỉ ghi đè `taskCode` khi ô đang trống — mã ai đó sửa tay
 * trên hệ thống thắng bộ luật.
 *
 * Server phải TẮT khi chạy: CAP giữ db.sqlite.
 *
 * Chạy: npx tsx scripts/migrate-task-codes.mts
 */

import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { classifyTaskCode, taskCodeTextOf } from '../shared/task-catalogue';

// `import.meta.url` sẽ gọn hơn, nhưng `module` của tsconfig gốc không cho phép
// và đổi nó là đổi cho cả backend. Lấy thư mục làm việc rồi KIỂM TRA — chạy nhầm
// chỗ thì dừng ngay với một câu đọc được, thay vì lặng lẽ tạo một db.sqlite rỗng
// ở đâu đó và báo "0 hành động".
const ROOT = process.cwd();
if (!fs.existsSync(path.join(ROOT, 'db.sqlite'))) {
    throw new Error(`Không thấy db.sqlite trong ${ROOT} — chạy script này từ thư mục gốc của repo.`);
}
const db = new DatabaseSync(path.join(ROOT, 'db.sqlite'));

const ACTIONS = 'cnma_proresolve_HistoricalActions';

function columns(table: string): string[] {
    return (db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>).map((r) => r.name);
}

function addColumn(table: string, name: string, type: string): void {
    if (columns(table).includes(name)) {
        console.log(`  = ${table}.${name} đã có`);
        return;
    }
    db.exec(`ALTER TABLE "${table}" ADD COLUMN ${name} ${type}`);
    console.log(`  + ${table}.${name}`);
}

console.log('1. Thêm cột');
addColumn(ACTIONS, 'taskCode', 'NVARCHAR(20)');
addColumn(ACTIONS, 'taskCodeGroup', 'NVARCHAR(20)');
addColumn(ACTIONS, 'taskProcessor', 'NVARCHAR(120)');
addColumn(ACTIONS, 'timeEffort', 'DECIMAL(5,1)');
addColumn(ACTIONS, 'plannedEndDate', 'DATE');

console.log('2. Back-fill taskCode + taskCodeGroup từ actionText');
const rows = db.prepare(
    `SELECT ID, actionType, actionText FROM ${ACTIONS}
     WHERE taskCode IS NULL OR TRIM(taskCode) = ''`,
).all() as Array<{ ID: string; actionType: string; actionText: string }>;

const setCode = db.prepare(`UPDATE ${ACTIONS} SET taskCode = ?, taskCodeGroup = ? WHERE ID = ?`);
const distribution = new Map<string, number>();
const misses: string[] = [];

for (const row of rows) {
    const hit = classifyTaskCode(row.actionText);
    if (!hit) {
        misses.push(`${row.actionType} — ${row.actionText}`);
        continue;
    }
    setCode.run(hit.taskCode, hit.taskCodeGroup, row.ID);
    distribution.set(hit.taskCode, (distribution.get(hit.taskCode) ?? 0) + 1);
}

const coded = rows.length - misses.length;
console.log(`  ${coded}/${rows.length} hành động được mã hoá, ${misses.length} không nhận ra`);
for (const code of [...distribution.keys()].sort()) {
    console.log(`    ${code}  ${String(distribution.get(code)).padStart(2)}  ${taskCodeTextOf(code)}`);
}
// In ra chứ không đoán: dòng không mã hoá được là dòng cần một luật mới, hoặc
// một mã mới trong catalogue. Cả hai là quyết định của người, không của script.
if (misses.length) {
    console.log('  ⚠ chưa mã hoá được — cần thêm luật vào shared/task-catalogue.ts:');
    for (const m of misses) console.log(`      ${m}`);
}

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
    const name = stmt.match(/^CREATE VIEW\s+([^\s(]+)/i)![1];
    db.exec(`DROP VIEW IF EXISTS ${name}`);
    db.exec(stmt);
    rebuilt++;
}
console.log(`  ${rebuilt} view được dựng lại`);

// Kiểm chứng QUA VIEW của service, không chỉ qua bảng gốc. Đây là chỗ duy nhất
// phát hiện được "cột đã thêm nhưng OData vẫn không thấy".
console.log('4. Kiểm chứng');
const viewCols = columns('EightDService_HistoricalActions');
for (const c of ['taskCode', 'taskCodeGroup', 'taskProcessor', 'timeEffort', 'plannedEndDate']) {
    console.log(`  EightDService_HistoricalActions có ${c}:`, viewCols.includes(c));
}
const totals = db.prepare(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN taskCode IS NOT NULL THEN 1 ELSE 0 END) AS withCode
     FROM EightDService_HistoricalActions`,
).get() as { total: number; withCode: number };
console.log(`  ${totals.withCode}/${totals.total} hành động có mã nhiệm vụ`);

const sample = db.prepare(
    `SELECT actionType, taskCodeGroup, taskCode, SUBSTR(actionText, 1, 64) AS actionText
     FROM EightDService_HistoricalActions ORDER BY taskCode LIMIT 6`,
).all();
console.log('  Mẫu:', JSON.stringify(sample, null, 1));

db.close();
console.log('Xong.');
