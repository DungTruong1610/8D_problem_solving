/**
 * Nạp các case trong mock-data/ vào DB bằng cách gọi endpoint thật.
 *
 * Khác `run-analyze.ts`: script kia chạy pipeline trong tiến trình và in ra màn
 * hình, KHÔNG lưu gì. Script này đi qua HTTP nên đúng đường mà UI sẽ đi, và để
 * lại dữ liệu thật trong sqlite.db cho Phase 4-5.
 *
 * `analyzeFromJson` trả về NGAY với ID report ở trạng thái `Analyzing`; pipeline
 * chạy ở nền trên server. Script này vì thế phải poll trường `status` — cùng cơ
 * chế mà UI sẽ dùng, nên nó cũng là phép thử cho luồng đó.
 *
 * ── Vì sao cần dọn dẹp ──
 * Mỗi lời gọi `analyzeFromJson` tạo một bản ghi MỚI, kể cả cùng một case. Chạy
 * thử vài lần là DB đầy bản trùng và bản `Failed`, trang list không demo được.
 * Nên script tự dọn: mặc định xoá bản trùng và bản hỏng của đúng những case nó
 * quản, để cuối cùng mỗi case còn đúng một report tốt.
 *
 * Yêu cầu backend đang chạy:
 *   npm run dev:backend
 *
 * Chạy:
 *   npx tsx scripts/seed-reports.ts                bỏ qua case đã Analyzed
 *   npx tsx scripts/seed-reports.ts --force        chạy lại tất cả
 *   npx tsx scripts/seed-reports.ts --clean        xoá SẠCH mọi report rồi chạy lại
 *   npx tsx scripts/seed-reports.ts --prune        chỉ dọn rác, không gọi AI
 *   npx tsx scripts/seed-reports.ts --only 10048651
 *   npx tsx scripts/seed-reports.ts --dirty       nạp bộ dữ liệu bẩn
 *   npx tsx scripts/seed-reports.ts --both        nạp cả clean lẫn dirty (24 case)
 */
import fs from 'node:fs';
import path from 'node:path';
import { Agent } from 'undici';

const HOST = process.env.SEED_HOST ?? 'http://127.0.0.1:4004';
const SRV = `${HOST}/api/cnma/EIGHTD_SRV`;
const USER = process.env.SEED_USER ?? 'admin';
const PASS = process.env.SEED_PASS ?? '123';

/** Mỗi request POST / poll đều chờ cho tới khi AI xong mà không bị ngắt giữa chừng. */
const REQUEST_TIMEOUT_MS = 600_000;
/** Một lượt chạy mất 60-90 giây. Bỏ cuộc sau 10 phút. */
const POLL_TIMEOUT_MS = 600_000;
const POLL_INTERVAL_MS = 3_000;

const MOCK_ROOT = path.resolve(__dirname, '../mock-data');

const args = process.argv.slice(2);
const force = args.includes('--force');
const clean = args.includes('--clean');
const pruneOnly = args.includes('--prune');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

/**
 * Bộ dữ liệu cần nạp.
 *
 * `--both` là thứ đáng xem nhất: 24 report cạnh nhau trong danh sách, mỗi case
 * hai lần — một lần dữ liệu chỉn chu, một lần như SAP thật. Kết luận nguyên
 * nhân gốc của AI trên hai bản phải trùng nhau; chỗ nào lệch là chỗ dữ liệu bẩn
 * đã che mất bằng chứng.
 */
const SETS: string[] = args.includes('--both')
    ? ['clean', 'dirty']
    : args.includes('--dirty') ? ['dirty'] : ['clean'];

const auth = `Basic ${Buffer.from(`${USER}:${PASS}`).toString('base64')}`;

/** Custom dispatcher: disable undici headersTimeout so long AI calls don't get HeadersTimeoutError. */
const dispatcher = new Agent({ headersTimeout: 0, bodyTimeout: 0 });

interface ReportRow {
    ID: string;
    notificationId: string;
    status: string;
    createdAt?: string;
    tokensUsed?: number;
    durationMs?: number;
    origin?: string;
    rootCauseCategory?: string;
}

async function api(method: string, url: string, body?: unknown) {
    const res = await fetch(url, {
        method,
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        ...(body !== undefined && { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        // @ts-ignore — undici dispatcher, not in standard fetch types
        dispatcher,
    });

    const text = await res.text();
    let parsed: any;
    try {
        parsed = text ? JSON.parse(text) : null;
    } catch {
        parsed = text;
    }

    if (!res.ok) {
        const message =
            parsed?.error?.message?.value ?? parsed?.error?.message ?? parsed?.message ?? text ?? res.statusText;
        const details = typeof parsed === 'object' && parsed !== null ? '\n' + JSON.stringify(parsed, null, 2) : '';
        throw new Error(`HTTP ${res.status} — ${message}${details}`);
    }
    return parsed;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function allReports(): Promise<ReportRow[]> {
    const data = await api(
        'GET',
        `${SRV}/Reports?$select=notificationId,status,createdAt,tokensUsed,durationMs,origin,rootCauseCategory` +
        `&$orderby=notificationId,createdAt desc`,
    );
    return data?.value ?? [];
}

async function deleteReport(id: string): Promise<void> {
    await api('DELETE', `${SRV}/Reports(${id})`);
}

/**
 * Giữ lại bản `Analyzed` mới nhất của mỗi case, xoá phần còn lại.
 *
 * Bản `Analyzing` được giữ nguyên — có thể đang chạy thật, xoá đi sẽ làm job nền
 * ghi vào một hàng không còn tồn tại.
 */
async function prune(): Promise<number> {
    const reports = await allReports();
    const keep = new Set<string>();

    const byCase = new Map<string, ReportRow[]>();
    for (const r of reports) {
        if (!byCase.has(r.notificationId)) byCase.set(r.notificationId, []);
        byCase.get(r.notificationId)!.push(r);
    }

    for (const [, rows] of byCase) {
        // allReports() đã sắp createdAt giảm dần, nên bản Analyzed đầu tiên
        // gặp được chính là bản mới nhất.
        const newest = rows.find((r) => r.status === 'Analyzed');
        if (newest) keep.add(newest.ID);
        for (const r of rows) if (r.status === 'Analyzing') keep.add(r.ID);
    }

    const doomed = reports.filter((r) => !keep.has(r.ID));
    for (const r of doomed) await deleteReport(r.ID);
    return doomed.length;
}

async function deleteAll(): Promise<number> {
    const reports = await allReports();
    for (const r of reports) await deleteReport(r.ID);
    return reports.length;
}

/** Chờ report rời khỏi `Analyzing`. Đây chính là vòng poll mà UI sẽ chạy. */
async function waitForCompletion(reportID: string): Promise<{ status: string; error?: string }> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
        await sleep(POLL_INTERVAL_MS);

        const r = await api(
            'GET',
            `${SRV}/Reports(${reportID})?$select=status,errorMessage,tokensUsed,durationMs`,
        );

        if (r.status !== 'Analyzing') {
            return { status: r.status, error: r.errorMessage ?? undefined };
        }
        process.stdout.write('.');
    }

    return { status: 'timeout', error: `Vẫn ở Analyzing sau ${POLL_TIMEOUT_MS / 1000}s` };
}

async function printDb() {
    const reports = await allReports();
    console.log(`\n── Trong DB (${reports.length} report) ──`);
    for (const r of reports) {
        const secs = r.durationMs ? `${(r.durationMs / 1000).toFixed(0)}s` : '-';
        console.log(
            `  ${r.notificationId}  ${String(r.origin).slice(0, 2)}  ` +
            `${String(r.rootCauseCategory ?? '-').padEnd(12)} ${String(r.status).padEnd(10)} ` +
            `${String(r.tokensUsed ?? '-').padStart(7)} token  ${secs}`,
        );
    }
}

async function main() {
    console.log(`Backend: ${HOST}`);

    let existing: ReportRow[];
    try {
        existing = await allReports();
    } catch (e: any) {
        console.error('\n✗ Không gọi được backend:');
        console.error(e);
        console.error('\n  Chạy `npm run dev:backend` ở một cửa sổ khác rồi thử lại.');
        process.exit(1);
    }
    console.log(`Đang có ${existing.length} report trong DB`);

    if (clean) {
        const n = await deleteAll();
        console.log(`🧹 Đã xoá sạch ${n} report\n`);
        existing = [];
    } else {
        const n = await prune();
        if (n) console.log(`🧹 Đã dọn ${n} report trùng/hỏng`);
        existing = await allReports();
        console.log('');
    }

    if (pruneOnly) {
        await printDb();
        return;
    }

    let files = SETS.flatMap((set) => {
        const dir = path.join(MOCK_ROOT, set);
        if (!fs.existsSync(dir)) {
            console.error(`Không tìm thấy thư mục ${dir} — chạy 'python mock-data/generate.py' trước.`);
            process.exit(1);
        }
        return fs.readdirSync(dir)
            .filter((f) => f.startsWith('case-') && f.endsWith('.json'))
            .sort()
            .map((f) => path.join(dir, f));
    });

    if (only) {
        files = files.filter((f) => f.includes(only));
        if (!files.length) {
            console.error(`Không có case nào khớp "${only}".`);
            process.exit(1);
        }
    }

    console.log(`Bộ dữ liệu: ${SETS.join(' + ')} — ${files.length} case\n`);

    const results: Array<[string, string]> = [];

    for (const filePath of files) {
        const file = path.basename(filePath);
        const set = path.basename(path.dirname(filePath));
        const payload = fs.readFileSync(filePath, 'utf-8');
        const notificationId = JSON.parse(payload)?.data?.notifications?.[0]?.notification_id ?? file;

        const current = existing.filter((r) => r.notificationId === notificationId);
        const done = current.find((r) => r.status === 'Analyzed');

        if (done && !force) {
            console.log(`⏭  ${notificationId}  [${set}] đã Analyzed — dùng --force để chạy lại`);
            results.push([notificationId, 'bỏ qua']);
            continue;
        }

        // Chạy lại thì xoá bản cũ trước, nếu không mỗi lần chạy lại thêm một
        // hàng trùng và trang list sẽ đầy bản sao của cùng một case.
        for (const r of current) {
            if (r.status !== 'Analyzing') await deleteReport(r.ID);
        }

        process.stdout.write(`▶  ${notificationId}  [${set}]  `);
        const started = Date.now();

        try {
            const res = await api('POST', `${SRV}/analyzeFromJson`, { payload, title: '' });
            const reportID = res?.value ?? res;
            process.stdout.write('đã xếp lịch ');

            const outcome = await waitForCompletion(reportID);
            const secs = ((Date.now() - started) / 1000).toFixed(0);

            if (outcome.status === 'Analyzed') {
                console.log(` ✓ ${secs}s  → ${reportID}`);
                results.push([notificationId, 'ok']);
            } else {
                console.log(` ✗ ${secs}s  (${outcome.status})`);
                if (outcome.error) console.log(`   ${outcome.error}`);
                results.push([notificationId, outcome.status]);
            }
        } catch (e: any) {
            const secs = ((Date.now() - started) / 1000).toFixed(0);
            console.log(` ✗ ${secs}s`);
            console.error('\n--- Chi tiết lỗi ---');
            console.error(e);
            console.error('--------------------\n');
            results.push([notificationId, 'lỗi']);
        }
    }

    console.log('\n── Tổng kết ──');
    for (const [id, status] of results) console.log(`  ${id}  ${status}`);

    // Đọc lại để xác nhận dữ liệu thật sự nằm trong DB, không chỉ tin vào
    // response của POST.
    try {
        await printDb();
    } catch {
        /* không quan trọng */
    }

    process.exit(results.every(([, s]) => s === 'ok' || s === 'bỏ qua') ? 0 : 1);
}

main().catch((e) => {
    console.error('\n✗ Lỗi ngoài dự kiến:');
    console.error(e);
    process.exit(1);
});
