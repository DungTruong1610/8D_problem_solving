/**
 * Xuất 8 prompt bước 8D ra Markdown để dán tay vào bảng `StepPrompts`.
 *
 * ── Vì sao sinh từ code chứ không chép tay ──
 * Prompt thật gửi cho model được ghép ở hai tầng (`DEFAULT_DISCIPLINE_GUIDE` +
 * phần FIELD MECHANICS của D1-D4). Chép tay sang một file .md là tạo ra bản thứ
 * ba, và bản đó lệch ngay lần đầu ai sửa code mà không có gì báo. File này đọc
 * thẳng `DEFAULT_STEP_PROMPTS`, nên nội dung xuất ra luôn đúng bằng thứ app gửi.
 *
 * ── Vì sao ghi rõ dán vào ô nào ──
 * Runtime đọc prompt bằng `combinedPrompt ?? systemPrompt` (xem
 * `getDisciplineGuide`). `combinedPrompt` CHE hoàn toàn `systemPrompt`. Dán vào
 * sai ô nghĩa là lưu thành công, hiện đúng trên UI, và không đổi gì hết.
 *
 * Chạy (cần loader tsx vì nguồn là TypeScript):
 *
 *     npm run export:prompts
 *
 * hoặc trực tiếp:
 *
 *     node --import ./node_modules/tsx/dist/loader.mjs scripts/export-step-prompts.mjs [đích]
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { DEFAULT_STEP_PROMPTS } = await import('../srv/src/domain/eightd/precedent/defaults.ts');

const out = resolve(process.argv[2] ?? 'docs/8d-step-prompts.md');

const lines = [
    '# 8D Step Prompts',
    '',
    'Sinh tự động bằng `node scripts/export-step-prompts.mjs` — **đừng sửa file này**.',
    'Nguồn: `srv/src/domain/eightd/prompts.ts` (`DEFAULT_DISCIPLINE_GUIDE`) và',
    '`srv/src/domain/eightd/precedent/defaults.ts` (`STRUCTURED_CONFIG_OVERRIDES`).',
    '',
    '## Cách nhanh: không cần dán tay',
    '',
    'Bật backend rồi chạy:',
    '',
    '```bash',
    'npm run push:prompts          # cả 8 bước',
    'npm run push:prompts -- D4    # riêng D4',
    '```',
    '',
    'Lệnh này xoá và seed lại cấu hình từ code, đúng bằng nội dung file này.',
    '⚠️ Chỉnh tay trên trang AI Settings của các bước đó sẽ mất — lệnh có hỏi lại.',
    '',
    '## Dán tay: mỗi bước có BA ô, không phải một',
    '',
    'Prompt một mình là chưa đủ. Giới hạn độ dài từng ô, danh sách giá trị hợp lệ,',
    'hình dạng phần tử mảng và mô tả từng trường đều nằm trong hai schema JSON —',
    'và **chính chúng mới ràng buộc model lúc sinh token**, còn prompt chỉ là lời',
    'khuyên. Dán prompt mà bỏ schema thì phần lớn thay đổi không có tác dụng, và',
    'không có gì báo cho bạn biết.',
    '',
    'Runtime đọc prompt bằng `combinedPrompt ?? systemPrompt`, nên **`combinedPrompt`',
    'che hoàn toàn `systemPrompt`** chứ không bổ sung cho nó. Dán nhầm ô thì lưu vẫn',
    'thành công, UI vẫn hiện, và prompt không đổi.',
    '',
    '| Bước | Ô cần dán | Số từ prompt |',
    '|---|---|---|',
];

for (const step of DEFAULT_STEP_PROMPTS) {
    const field = step.combinedPrompt ? 'combinedPrompt' : 'systemPrompt';
    const text = (step.combinedPrompt ?? step.systemPrompt ?? '').trim();
    const boxes = [field, step.inputSchemaJson && 'inputSchemaJson', step.formSchemaJson && 'formSchemaJson']
        .filter(Boolean).map((name) => `\`${name}\``).join(' + ');
    lines.push(`| ${step.stepCode} — ${step.label} | ${boxes} | ${text.split(/\s+/).length} |`);
}
lines.push('');

for (const step of DEFAULT_STEP_PROMPTS) {
    const field = step.combinedPrompt ? 'combinedPrompt' : 'systemPrompt';
    const text = (step.combinedPrompt ?? step.systemPrompt ?? '').trim();
    lines.push(
        '---',
        '',
        `## ${step.stepCode} — ${step.label}`,
        '',
        `${step.description}`,
        '',
        `### 1. Prompt → ô \`${field}\``,
        '',
        `Dòng \`stepCode = '${step.stepCode}'\` trong bảng \`StepPrompts\`.`,
        '',
        '```text',
        text,
        '```',
        '',
    );

    // Prompt MỘT MÌNH là chưa đủ. Giới hạn độ dài từng ô, danh sách giá trị hợp
    // lệ, hình dạng phần tử mảng và mô tả từng trường đều nằm trong hai schema
    // JSON dưới đây — chúng mới là thứ ràng buộc model lúc sinh token, còn prompt
    // chỉ là lời khuyên. Dán prompt mà bỏ schema thì phần lớn thay đổi không có
    // tác dụng, và không có gì báo.
    for (const [label, json] of [
        ['Data Schema', step.inputSchemaJson],
        ['Form Editor', step.formSchemaJson],
    ]) {
        if (!json) continue;
        lines.push(
            `### ${label === 'Data Schema' ? 2 : 3}. ${label} → ô \`${label === 'Data Schema' ? 'inputSchemaJson' : 'formSchemaJson'}\``,
            '',
            '```json',
            json.trim(),
            '```',
            '',
        );
    }
}

writeFileSync(out, lines.join('\n'), 'utf8');
console.log(`OK: ${DEFAULT_STEP_PROMPTS.length} bước -> ${out}`);
