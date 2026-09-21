/**
 * Nạp kho case tiền lệ từ `mock-data/` qua HTTP.
 *
 * ── Vì sao đi qua HTTP thay vì ghi thẳng DB ──
 * Trên Cloud Foundry không ai cầm được credential của HDI container, nên không
 * có đường ghi thẳng. Đi qua action `seedCaseLibrary` thì cùng một script chạy
 * được cả local lẫn trên cloud — chỉ đổi host và cách xác thực.
 *
 * Nạp thay thế theo `notificationId`, nên chạy lại nhiều lần là an toàn.
 *
 * Chạy local (backend đang chạy: `npm run dev:backend`):
 *   npx tsx scripts/seed-library.ts
 *   npx tsx scripts/seed-library.ts --clear        xoá sạch kho rồi nạp lại
 *   npx tsx scripts/seed-library.ts --dirty        nạp thêm bộ dữ liệu bẩn
 *   npx tsx scripts/seed-library.ts --verify 8D-10048412
 *
 * Chạy với app đã deploy:
 *   SEED_HOST=https://<srv-url> SEED_TOKEN=<bearer> npx tsx scripts/seed-library.ts
 */
import fs from 'node:fs';
import path from 'node:path';

const HOST = process.env.SEED_HOST ?? 'http://127.0.0.1:4004';
const EIGHTD = `${HOST}/api/cnma/EIGHTD_SRV`;
const AI = `${HOST}/api/cnma/AI_SRV`;

/** Basic auth cho profile local; bearer token khi chạy với app trên CF. */
const TOKEN = process.env.SEED_TOKEN ?? '';
const USER = process.env.SEED_USER ?? 'admin';
const PASS = process.env.SEED_PASS ?? '123';

const MOCK_ROOT = path.resolve(__dirname, '../mock-data');

const args = process.argv.slice(2);
const doClear = args.includes('--clear');
const withDirty = args.includes('--dirty');
const verifyIdx = args.indexOf('--verify');
const verifyCase = verifyIdx >= 0 ? args[verifyIdx + 1] : null;

function authHeader(): Record<string, string> {
    if (TOKEN) return { Authorization: `Bearer ${TOKEN}` };
    return { Authorization: `Basic ${Buffer.from(`${USER}:${PASS}`).toString('base64')}` };
}

async function call(url: string, body?: unknown): Promise<any> {
    const res = await fetch(url, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
        throw new Error(`${res.status} ${url}\n${text.slice(0, 600)}`);
    }
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

/**
 * Bóc giá trị trả về của một action.
 *
 * CAP bọc kết quả action trong `{ value: "<chuỗi JSON>" }`. CHỈ dùng cho action:
 * response của một collection OData cũng có trường `value`, nhưng đó là mảng bản
 * ghi — bóc nó ra rồi đọc `.value` lần nữa sẽ ra undefined, im lặng.
 */
function unwrapAction(res: any): any {
    const raw = typeof res === 'string' ? res : res?.value ?? res;
    if (typeof raw !== 'string') return raw;
    try {
        return JSON.parse(raw);
    } catch {
        return raw;
    }
}

function loadCases(dir: string): unknown[] {
    const full = path.join(MOCK_ROOT, dir);
    return fs.readdirSync(full)
        .filter((f) => f.startsWith('case-') && f.endsWith('.json'))
        .sort()
        .map((f) => JSON.parse(fs.readFileSync(path.join(full, f), 'utf-8')));
}

async function main() {
    console.log(`Host: ${HOST}`);

    if (doClear) {
        const r = unwrapAction(await call(`${EIGHTD}/clearCaseLibrary`, {}));
        console.log(`Đã xoá ${r.deleted} case khỏi kho.`);
    }

    const cases = [...loadCases('clean'), ...(withDirty ? loadCases('dirty') : [])];
    console.log(`Nạp ${cases.length} case…`);

    const report = unwrapAction(await call(`${EIGHTD}/seedCaseLibrary`, { payload: JSON.stringify(cases) }));
    console.log(
        `  ${report.inserted} mới · ${report.replaced} ghi đè · ${report.skipped?.length ?? 0} bỏ qua`,
    );
    for (const s of report.skipped ?? []) {
        console.log(`  ✗ #${s.index} ${s.notificationId ?? ''}: ${s.reason}`);
    }

    // Kho nạp xong mà không tìm được tiền lệ nào thì coi như chưa xong — kiểm
    // ngay tại đây thay vì để phát hiện lúc demo.
    if (verifyCase) {
        console.log(`\nChấm thử ${verifyCase} với từng case còn lại:`);
        // GET collection: đọc thẳng `value`, KHÔNG qua unwrapAction.
        const all = await call(
            `${EIGHTD}/HistoricalCases?$select=notificationId,sapStatus&$orderby=notificationId`,
        );
        const others = (all.value ?? []).filter((c: any) => c.notificationId !== verifyCase);

        for (const other of others) {
            const r = unwrapAction(
                await call(
                    `${AI}/previewScore(caseA='${encodeURIComponent(verifyCase)}',`
                    + `caseB='${encodeURIComponent(other.notificationId)}')`,
                ),
            );
            if (r.error) {
                console.log(`  ! ${other.notificationId}: ${r.error}`);
                continue;
            }
            const mark = r.score >= 3 ? '★' : ' ';
            console.log(`  ${mark} ${other.notificationId}  ${String(r.score).padStart(2)}/${r.maxScore}`
                + `  ${other.sapStatus?.padEnd(11) ?? ''}  ${r.explanation}`);
        }
    }
}

main().catch((e) => {
    console.error(e.message);
    process.exit(1);
});
