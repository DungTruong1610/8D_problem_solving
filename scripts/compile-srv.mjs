/**
 * Biên dịch `srv/` sang JavaScript trong `gen/srv/`, rồi bỏ file .ts đi.
 *
 * ── Vì sao bước này bắt buộc ──
 * `@sap/cds` không đọc được TypeScript; khả năng đó nằm ở `cds-dk`, vốn là
 * devDependency và không có trên Cloud Foundry. Deploy nguyên .ts thì
 * `cds-serve` bỏ qua `srv/server.ts` MÀ KHÔNG BÁO GÌ — app lên, entity phục vụ
 * bình thường, nhưng không handler nào được đăng ký và không seed gì cả.
 *
 * Triệu chứng để nhận ra: `GET /health` trả `{"status":"UP"}` của CAP thay vì
 * payload của `server.ts`.
 *
 * ── Vì sao xoá .ts sau khi biên dịch ──
 * Để artifact chỉ còn một bản. Còn cả hai thì tuỳ môi trường mà CAP chọn bản
 * khác nhau, và sự khác nhau đó chỉ lộ ra khi đã deploy.
 *
 * Chạy tự động sau `cds build` trong `npm run build`.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GEN_SRV = path.join(ROOT, 'gen', 'srv', 'srv');

if (!fs.existsSync(GEN_SRV)) {
    console.error('[compile-srv] Không thấy gen/srv/srv — chạy `cds build` trước.');
    process.exit(1);
}

const tsc = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
execFileSync(process.execPath, [tsc, '-p', path.join(ROOT, 'tsconfig.build.json')], {
    cwd: ROOT,
    stdio: 'inherit',
});

/** Xoá mọi .ts trong artifact; giữ nguyên .json, csn, i18n. */
function stripTs(dir) {
    let removed = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) removed += stripTs(full);
        else if (entry.name.endsWith('.ts')) { fs.rmSync(full); removed++; }
    }
    return removed;
}

const removed = stripTs(GEN_SRV);

// Không có server.js thì toàn bộ bootstrap không chạy — thà fail ở đây còn hơn
// phát hiện sau khi deploy xong.
const serverJs = path.join(GEN_SRV, 'server.js');
if (!fs.existsSync(serverJs)) {
    console.error('[compile-srv] Biên dịch xong nhưng KHÔNG có gen/srv/srv/server.js — dừng build.');
    process.exit(1);
}

const count = (d) => fs.readdirSync(d, { withFileTypes: true })
    .reduce((n, e) => n + (e.isDirectory() ? count(path.join(d, e.name)) : e.name.endsWith('.js') ? 1 : 0), 0);

console.log(`[compile-srv] Đã biên dịch ${count(GEN_SRV)} file .js, xoá ${removed} file .ts khỏi artifact.`);
