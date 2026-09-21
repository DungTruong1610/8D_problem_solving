/**
 * Nạp kho case lịch sử vào container `cnma_proresolve_db_graph`.
 *
 * ── Vì sao cần script này khi `server.ts` đã seed lúc khởi động ──
 * `cds deploy` nạp được 12 file CSV trong `db/data/`, nhưng kho case KHÔNG nằm
 * ở đó: 25 case là JSON trong `srv/data/case-library/`, và `seedLibraryFromBundle`
 * chỉ chạy trong hook khởi động của app. Nghĩa là một container vừa deploy xong
 * có đủ Defects/InspectionLots/FmeaRegister nhưng `HistoricalCases` rỗng — mà đó
 * chính là bảng mọi truy vấn graph đọc.
 *
 * Bật cả app lên chỉ để seed là cách chậm và ồn: nó còn kéo theo AI Core, value
 * help, probe khởi động. Script này gọi thẳng đúng một hàm.
 *
 * ── Vì sao mặc định profile `graph` chứ không `hybrid` ──
 * `hybrid` trỏ vào `cnma_proresolve_db`, container DÙNG CHUNG với các nhánh
 * khác. Mặc định phải là container an toàn; muốn chạy chỗ khác thì phải gõ ra.
 *
 * Chạy:
 *   npm run seed:graph
 *
 * Hoặc trực tiếp (cần `cds bind --exec` để đổi binding thành credentials thật):
 *   node node_modules/@sap/cds-dk/bin/cds.js bind --exec --profile graph -- \
 *     node --import ./node_modules/tsx/dist/loader.mjs scripts/seed-graph-library.mjs
 */

const profile = process.env.CDS_ENV || 'graph';
process.env.CDS_ENV = profile;

if (profile !== 'graph') {
    console.warn(
        `[seed-graph-library] CDS_ENV=${profile} — đang nạp vào container của profile này, `
        + 'không phải container graph. Dừng lại nếu đó không phải điều bạn muốn.',
    );
}

const cds = (await import('@sap/cds')).default;
const { seedLibraryFromBundle } = await import('../srv/src/domain/eightd/precedent/librarySeeder.ts');

const db = await cds.connect.to('db');
const [{ SCHEMA }] = await db.run('SELECT CURRENT_SCHEMA AS SCHEMA FROM DUMMY');
console.log(`[seed-graph-library] profile=${profile} schema=${SCHEMA}`);

const report = await seedLibraryFromBundle();
console.log(
    report
        ? `[seed-graph-library] ${JSON.stringify(report)}`
        : '[seed-graph-library] Kho đã đủ case của bộ đóng gói — không nạp thêm.',
);

const [{ N }] = await db.run('SELECT COUNT(*) AS N FROM "CNMA_PRORESOLVE_HISTORICALCASES"');
console.log(`[seed-graph-library] HistoricalCases hiện có ${N} dòng.`);

process.exit(0);
