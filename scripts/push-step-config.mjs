/**
 * Đẩy cấu hình 8 bước D từ code xuống bảng `StepPrompts` trong DB.
 *
 * ── Vì sao cần script này ──
 * `srv/src/domain/eightd/precedent/defaults.ts` chỉ là SEED. Sửa nó xong mà
 * không đẩy xuống thì app vẫn chạy bản cũ trong DB — và không có gì báo, vì cả
 * hai bản đều hợp lệ. Đây là chỗ đã làm mất thời gian nhiều lần: sửa prompt, sửa
 * schema, chạy lại, không thấy khác gì.
 *
 * Trước đây việc này phải gọi bằng `curl`. Không phải ai cũng có curl hay
 * Postman, và một lệnh curl dài với header và JSON escape là chỗ rất dễ gõ sai.
 *
 * ── Nó làm gì ──
 * Gọi action `resetRetrievalConfig` của `AiAdminService`: XOÁ hàng StepPrompts
 * của các bước được chọn rồi seed lại từ code.
 *
 * ⚠️ Chỉnh tay trên trang AI Settings của những bước đó sẽ MẤT. Script hỏi lại
 * trước khi chạy, trừ khi truyền `--yes`.
 *
 * Cách dùng:
 *
 *     npm run push:prompts              # cả 8 bước
 *     npm run push:prompts -- D4        # riêng D4
 *     npm run push:prompts -- --yes     # không hỏi
 *
 * Backend phải đang chạy (`npm run dev`).
 */

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const args = process.argv.slice(2);
const skipConfirm = args.includes('--yes') || args.includes('-y');
const steps = args.filter((a) => /^D[1-8]$/i.test(a)).map((a) => a.toUpperCase());

const BASE = process.env.BACKEND_URL ?? 'http://localhost:4008';
const USER = process.env.CNMA_ADMIN_USER ?? 'admin';
const PASS = process.env.CNMA_ADMIN_PASS ?? '123';
const ACTION = `${BASE}/api/cnma/AI_SRV/resetRetrievalConfig`;

// Một lần gọi chỉ nhận một scope. Không truyền bước nào thì dùng 'prompts' —
// rẻ hơn tám lần gọi 'prompt:Dx' và cũng là thứ thường cần.
const scopes = steps.length ? steps.map((code) => `prompt:${code}`) : ['prompts'];

async function confirm() {
    if (skipConfirm) return true;
    const what = steps.length ? steps.join(', ') : 'CẢ 8 BƯỚC D1..D8';
    const rl = createInterface({ input: stdin, output: stdout });
    const answer = await rl.question(
        `\nSẽ xoá và seed lại cấu hình của ${what} trong DB.\n`
        + 'Mọi chỉnh tay trên trang AI Settings của các bước đó sẽ MẤT.\n'
        + 'Tiếp tục? (y/N) ',
    );
    rl.close();
    return /^y(es)?$/i.test(answer.trim());
}

async function push(scope) {
    const res = await fetch(ACTION, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // Auth mocked của profile development. Trên môi trường thật thì đặt
            // CNMA_ADMIN_USER / CNMA_ADMIN_PASS.
            Authorization: `Basic ${Buffer.from(`${USER}:${PASS}`).toString('base64')}`,
        },
        body: JSON.stringify({ scope }),
    });

    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${text.slice(0, 300)}`);
    return text;
}

try {
    // Kiểm tra backend TRƯỚC khi hỏi: không có gì bực bằng gõ 'y' xong mới biết
    // server chưa bật.
    try {
        await fetch(`${BASE}/`, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    } catch {
        console.error(
            `\n✗ Không kết nối được ${BASE}\n`
            + '  Bật backend trước: npm run dev\n'
            + '  Cổng khác thì đặt BACKEND_URL, ví dụ BACKEND_URL=http://localhost:4009\n',
        );
        process.exit(1);
    }

    if (!(await confirm())) {
        console.log('Đã huỷ. Không có gì thay đổi.');
        process.exit(0);
    }

    for (const scope of scopes) {
        await push(scope);
        console.log(`✓ ${scope}`);
    }

    console.log(
        '\nXong. Cấu hình trong DB giờ khớp với code.\n'
        + 'Bước tiếp theo: mở một report và bấm Re-analyze.\n',
    );
} catch (error) {
    console.error(`\n✗ Đẩy cấu hình thất bại: ${error.message}\n`);
    process.exit(1);
}
