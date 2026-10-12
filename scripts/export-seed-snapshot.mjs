/**
 * Chụp các case 8D đang có trong `db.sqlite` local thành CSV seed ở `db/data/`.
 *
 * ── Vì sao cần bước này ──
 * Bản deploy (Render free) dựng DB mới từ `db/data/*.csv` ở MỖI lần build — ổ
 * đĩa không giữ lại gì giữa hai lần chạy. Muốn deploy có đúng những case đang
 * làm ở local (bản nháp AI, trạng thái từng D-step, nhật ký duyệt) thì phải đưa
 * chúng vào CSV, vì `mock-data/clean/` chỉ chở dữ liệu nguồn và để seeder tự
 * sinh lại các bước.
 *
 * ── Vì sao không chở TaskEvidences ──
 * Bằng chứng là file nhị phân (PDF, ảnh) lưu thẳng trong DB. Đưa vào CSV nghĩa
 * là commit file đó vào git dưới dạng base64 — nặng, và thường là file thử.
 *
 * Chạy tay khi muốn cập nhật snapshot: `npm run export:seed`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB_FILE = path.join(ROOT, process.argv[2] ?? 'db.sqlite');
const OUT_DIR = path.join(ROOT, 'db', 'data');

const TABLES = [
    { table: 'cnma_proresolve_Reports', file: 'cnma.proresolve-Reports.csv', orderBy: 'createdAt, ID' },
    { table: 'cnma_proresolve_Disciplines', file: 'cnma.proresolve-Disciplines.csv', orderBy: 'report_ID, sequence, ID' },
    { table: 'cnma_proresolve_ReviewEvents', file: 'cnma.proresolve-ReviewEvents.csv', orderBy: 'at, ID' },
];

/** Cùng quy ước với các CSV sẵn có: `;`, mọi giá trị trong ngoặc kép, NULL là ô trống. */
function csvCell(value) {
    if (value === null || value === undefined) return '';
    return `"${String(value).replace(/"/g, '""')}"`;
}

if (!fs.existsSync(DB_FILE)) {
    console.error(`[export-seed] Không thấy ${DB_FILE}.`);
    process.exit(1);
}

const db = new Database(DB_FILE, { readonly: true });

for (const { table, file, orderBy } of TABLES) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    const rows = db.prepare(`SELECT * FROM ${table} ORDER BY ${orderBy}`).all();
    const lines = [
        columns.join(';'),
        ...rows.map((row) => columns.map((c) => csvCell(row[c])).join(';')),
    ];
    fs.writeFileSync(path.join(OUT_DIR, file), lines.join('\n'), 'utf8');
    console.log(`[export-seed] ${file}: ${rows.length} dòng`);
}

db.close();
