/**
 * Di trú db.sqlite cho Phase 2.1 — tách bản ghi LỖI ra khỏi báo cáo 8D.
 *
 * Ba việc:
 *   1. Dựng `Defects` + `DefectCharacteristics`.
 *   2. Thêm `Reports.sourceDefectId`.
 *   3. Back-fill MỘT lỗi cho mỗi báo cáo đang có, rồi nối hai bên lại.
 *
 * ── Vì sao không dùng `cds deploy --to sqlite` ──
 * Lệnh đó dựng lại toàn bộ database từ schema rồi nạp CSV. Mọi 8D report, mọi bản
 * nháp, mọi thứ người dùng đã tạo trong lúc demo sẽ biến mất.
 *
 * ── Vì sao phải dựng lại VIEW ──
 * CAP sinh view cho service với danh sách cột LIỆT KÊ TƯỜNG MINH, không phải
 * `SELECT *`. Thêm bảng và thêm cột thôi thì OData vẫn không thấy chúng.
 *
 * ── Vì sao lỗi back-fill DÙNG LẠI số của báo cáo ──
 * Bên SAP, thông báo lỗi CHÍNH LÀ vật mà 8D mở ra từ đó — không phải hai đối
 * tượng mang hai số rồi đối chiếu với nhau. Cấp một số MỚI cho những lỗi này là
 * bịa ra 25 lỗi chưa từng tồn tại, và tệ hơn: kho tiền lệ khoá theo
 * `notificationId`, nên một con số mới sẽ cắt đứt đúng cái liên kết mà bước này
 * sinh ra để dựng. Chỉ báo cáo KHÔNG có số mới phải xin số từ dải `DEFECT`.
 *
 * ── Vì sao đặc tính kiểm tra chỉ chép được một phần ──
 * Payload đời đầu ghi quy cách thành một câu ('max 0.10mm', '0.05mm +/-0'), còn
 * `DefectCharacteristics` cần hai giới hạn SỐ. Đoán ra số từ những câu đó là mời
 * một con số sai vào đúng chỗ mà D2 dùng để phán "ngoài dung sai" — nên để null
 * và ghi lại đã bỏ bao nhiêu dòng. Câu chữ gốc vẫn còn nguyên trong
 * `Reports.sourcePayload`.
 *
 * Idempotent: chạy lại chỉ bổ sung phần còn thiếu.
 *
 * Chạy: node scripts/migrate-defects.cjs
 */

const { DatabaseSync } = require('node:sqlite');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const db = new DatabaseSync(path.join(ROOT, 'db.sqlite'));

const REPORTS = 'cnma_proresolve_Reports';
const DEFECTS = 'cnma_proresolve_Defects';
const CHARS = 'cnma_proresolve_DefectCharacteristics';
const RANGES = 'cnma_proresolve_NumberRanges';

// `cds compile --dialect sqlite` là NGUỒN SỰ THẬT duy nhất cho hình dạng bảng và
// view. Chép tay ở đây là tạo ra một bản sao thứ hai sẽ lệch ngay lần sửa schema
// kế tiếp.
console.log('0. Biên dịch schema');
const sql = execFileSync('npx', ['cds', 'compile', 'srv', '--to', 'sql', '--dialect', 'sqlite'], {
    cwd: ROOT, encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024, shell: true,
});
const statements = sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);

function ddlFor(table) {
    const stmt = statements.find((s) => new RegExp(`^CREATE TABLE ${table}\\b`, 'i').test(s));
    if (!stmt) throw new Error(`Không tìm thấy CREATE TABLE cho ${table} trong đầu ra cds compile`);
    return stmt;
}

function tableExists(name) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name);
}

function columns(table) {
    return db.prepare(`PRAGMA table_info("${table}")`).all().map((r) => r.name);
}

console.log('1. Tạo bảng');
for (const t of [DEFECTS, CHARS]) {
    if (tableExists(t)) {
        console.log(`  = ${t} đã có`);
    } else {
        db.exec(ddlFor(t));
        console.log(`  + ${t}`);
    }
}

console.log('2. Thêm cột Reports.sourceDefectId');
if (columns(REPORTS).includes('sourceDefectId')) {
    console.log('  = đã có');
} else {
    db.exec(`ALTER TABLE "${REPORTS}" ADD COLUMN sourceDefectId NVARCHAR(30)`);
    console.log('  + đã thêm');
}

/**
 * Trạng thái của lỗi suy từ trạng thái của báo cáo.
 *
 * Lỗi đã có 8D thì không bao giờ còn `Open` — đó là toàn bộ ý nghĩa của cột này.
 * Chỉ khi case đã chốt thì lỗi mới `Completed`.
 */
function defectStatusFor(report) {
    const sap = String(report.sapStatus ?? '').trim();
    if (report.status === 'Closed' || sap === 'Closed' || sap === 'Completed') return 'Completed';
    return 'In Process';
}

function parsePayload(raw) {
    if (typeof raw !== 'string' || !raw.trim()) return {};
    try {
        const p = JSON.parse(raw);
        return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
    } catch {
        return {};
    }
}

const text = (v) => {
    const s = v == null ? '' : String(v).trim();
    return s || null;
};

console.log('3. Back-fill một lỗi cho mỗi báo cáo');
const reports = db.prepare(
    `SELECT ID, notificationId, sourceDefectId, origin, symptomShortText, status, sapStatus,`
    + ` foundDate, completionDate, defectQuantity, defectQuantityUom, entryMode, inspectionLotId,`
    + ` referenceNumber, plant, materialId, materialDesc, batchId, defectCodeGroup, defectCode,`
    + ` defectText, defectClass, workCenterId, workCenterDesc, sourcePayload`
    + ` FROM ${REPORTS} ORDER BY notificationId`,
).all();

// Bộ đếm chỉ dùng cho báo cáo KHÔNG có số. Đọc một lần, kéo lên một lần ở cuối:
// mỗi lần chạm bảng dải số là một lần có thể va với server đang chạy.
const range = db.prepare(`SELECT currentValue, prefix, width FROM ${RANGES} WHERE object = 'DEFECT'`).get();
if (!range) throw new Error(`Dải số DEFECT chưa tồn tại — chạy scripts/migrate-number-ranges.cjs trước.`);
let counter = Number(range.currentValue);
const startCounter = counter;

const insertDefect = db.prepare(
    `INSERT INTO ${DEFECTS} (ID, createdAt, createdBy, modifiedAt, modifiedBy, defectId, origin, status,`
    + ` symptomShortText, foundDate, completionDate, defectQuantity, defectQuantityUom, referenceNumber,`
    + ` plant, materialId, materialDesc, materialGroup, batchId, workCenterId, workCenterDesc,`
    + ` defectCodeGroup, defectCode, defectText, defectClass, entryMode, inspectionLotId,`
    + ` reportedBy, coordinator, department, complaintReference, customerPlantContact, slaResponseDue)`
    + ` VALUES (${new Array(33).fill('?').join(', ')})`,
);
const insertChar = db.prepare(
    `INSERT INTO ${CHARS} (ID, createdAt, createdBy, modifiedAt, modifiedBy, defect_ID, lineNo,`
    + ` characteristic, measuredValue, specLowerLimit, specUpperLimit, specUom, valuation, equipment)`
    + ` VALUES (${new Array(14).fill('?').join(', ')})`,
);
const linkReport = db.prepare(`UPDATE ${REPORTS} SET sourceDefectId = ? WHERE ID = ?`);
const findDefect = db.prepare(`SELECT ID, defectId FROM ${DEFECTS} WHERE defectId = ?`);

const now = new Date().toISOString();
const BY = 'migrate-defects';
let created = 0, linked = 0, skipped = 0, allocated = 0, charRows = 0, droppedSpecs = 0;

for (const r of reports) {
    if (text(r.sourceDefectId)) { skipped++; continue; }

    const payload = parsePayload(r.sourcePayload);
    const material = payload.material ?? {};
    const responsibility = payload.responsibility ?? {};
    const customer = payload.customerReference ?? {};

    let defectId = text(r.notificationId);
    if (!defectId) {
        counter += 1;
        defectId = `${range.prefix ?? ''}${String(counter).padStart(Number(range.width) || 8, '0')}`;
        allocated++;
    }

    // Chạy lại sau một lần chạy dở: lỗi đã có rồi thì chỉ nối lại, không tạo đôi.
    let row = findDefect.get(defectId);
    if (!row) {
        const id = randomUUID();
        insertDefect.run(
            id, now, BY, now, BY,
            defectId,
            text(r.origin) ?? 'Q3 - Internal Defect',
            defectStatusFor(r),
            text(r.symptomShortText),
            text(r.foundDate),
            text(r.completionDate),
            r.defectQuantity == null ? null : Number(r.defectQuantity),
            text(r.defectQuantityUom),
            text(r.referenceNumber),
            text(r.plant) ?? text(material.plant),
            text(r.materialId) ?? text(material.materialId),
            text(r.materialDesc) ?? text(material.description),
            // `materialGroup` chưa bao giờ có cột trên Reports — chỉ payload giữ.
            text(material.materialGroup),
            text(r.batchId),
            text(r.workCenterId),
            text(r.workCenterDesc),
            text(r.defectCodeGroup),
            text(r.defectCode),
            text(r.defectText),
            text(r.defectClass),
            text(r.entryMode),
            text(r.inspectionLotId),
            text(responsibility.reportedBy),
            text(responsibility.coordinator),
            text(responsibility.department),
            text(customer.complaintReference),
            text(customer.customerPlantContact),
            text(customer.slaResponseDue),
        );
        row = { ID: id, defectId };
        created++;

        let lineNo = 0;
        for (const c of Array.isArray(payload.inspections) ? payload.inspections : []) {
            const name = text(c?.characteristic);
            if (!name) continue;
            lineNo++;
            if (text(c?.specValue) && c?.specLowerLimit == null && c?.specUpperLimit == null) droppedSpecs++;
            insertChar.run(
                randomUUID(), now, BY, now, BY,
                row.ID, lineNo, name,
                text(c?.measuredValue),
                c?.specLowerLimit == null ? null : Number(c.specLowerLimit),
                c?.specUpperLimit == null ? null : Number(c.specUpperLimit),
                text(c?.specUom),
                text(c?.valuation),
                text(c?.equipment),
            );
            charRows++;
        }
    }

    linkReport.run(row.defectId, r.ID);
    linked++;
}

console.log(`  ${created} lỗi được tạo, ${linked} báo cáo được nối, ${skipped} đã nối từ trước`);
console.log(`  ${charRows} dòng đặc tính kiểm tra (${droppedSpecs} dòng có quy cách dạng câu chữ, để trống giới hạn số)`);
if (allocated) console.log(`  ${allocated} lỗi phải xin số mới từ dải DEFECT`);

// Kéo bộ đếm lên cho vượt qua mọi số vừa dùng lại. Không có bước này thì lần cấp
// số kế tiếp có thể trả về một mã đã nằm trong bảng `Defects`.
console.log('4. Kéo bộ đếm DEFECT');
let maxUsed = counter;
for (const row of db.prepare(`SELECT defectId AS v FROM ${DEFECTS}`).all()) {
    const m = String(row.v ?? '').match(/(\d+)\s*$/);
    if (m) maxUsed = Math.max(maxUsed, Number(m[1]));
}
if (maxUsed > startCounter) {
    db.prepare(`UPDATE ${RANGES} SET currentValue = ?, modifiedAt = ? WHERE object = 'DEFECT'`)
        .run(maxUsed, now);
    console.log(`  ↑ ${startCounter} → ${maxUsed}`);
} else {
    console.log(`  = đã ở ${startCounter}, số cao nhất đang dùng là ${maxUsed}`);
}

console.log('5. Dựng lại view từ cds compile');
const views = statements.filter((s) => /^CREATE VIEW/i.test(s));
if (!views.length) throw new Error('Không tìm thấy CREATE VIEW nào — đầu ra của cds compile đã đổi hình dạng?');
db.exec('PRAGMA foreign_keys = OFF');
for (const stmt of views) {
    const name = stmt.match(/^CREATE VIEW\s+([^\s(]+)/i)[1];
    db.exec(`DROP VIEW IF EXISTS ${name}`);
    db.exec(stmt);
}
console.log(`  ${views.length} view được dựng lại`);

// Kiểm chứng: đọc thật QUA VIEW của service, không chỉ tin là đã chạy xong. Đây
// là chỗ duy nhất phát hiện được "cột đã thêm nhưng OData vẫn không thấy".
console.log('6. Kiểm chứng');
const reportCols = columns('EightDService_Reports');
console.log('  EightDService_Reports có sourceDefectId:', reportCols.includes('sourceDefectId'));
console.log('  EightDService_Defects tồn tại:',
    !!db.prepare("SELECT name FROM sqlite_master WHERE type='view' AND name='EightDService_Defects'").get());
console.log('  EightDService_DefectCharacteristics tồn tại:',
    !!db.prepare("SELECT name FROM sqlite_master WHERE type='view' AND name='EightDService_DefectCharacteristics'").get());

const orphans = db.prepare(
    `SELECT COUNT(*) AS n FROM EightDService_Reports r`
    + ` LEFT JOIN EightDService_Defects d ON d.defectId = r.sourceDefectId`
    + ` WHERE r.sourceDefectId IS NULL OR d.defectId IS NULL`,
).get().n;
console.log(`  Báo cáo chưa nối được với lỗi nào: ${orphans}`);

const dupes = db.prepare(
    `SELECT sourceDefectId, COUNT(*) AS n FROM EightDService_Reports`
    + ` WHERE sourceDefectId IS NOT NULL GROUP BY sourceDefectId HAVING n > 1`,
).all();
console.log(`  Lỗi mang nhiều hơn một 8D: ${dupes.length}`, dupes.length ? JSON.stringify(dupes) : '');

console.log('  Phân bố trạng thái lỗi:', JSON.stringify(
    db.prepare('SELECT status, COUNT(*) AS n FROM EightDService_Defects GROUP BY status').all()));
console.log('  Mẫu:', JSON.stringify(
    db.prepare('SELECT defectId, status, materialId, workCenterId FROM EightDService_Defects ORDER BY defectId LIMIT 3').all()));

db.close();
console.log('Xong.');
