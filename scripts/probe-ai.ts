/**
 * Smoke test AI Core — chạy TRƯỚC khi build domain layer.
 *
 * ── Vì sao script này là một ma trận chứ không phải một lời gọi ──
 * Lần probe đầu đặt `max_tokens: 50` và kết luận sai rằng `responseSchema`
 * không hoạt động. Thực tế `gemini-2.5-pro` là reasoning model: nó đốt
 * completion token cho phần suy nghĩ nội bộ TRƯỚC khi sinh ra chữ nào, và
 * `max_tokens` đếm cả thinking lẫn output. Budget nhỏ thì thinking ăn sạch,
 * output bị cắt giữa chừng và `finishReason` trả về 'length'.
 *
 * Ma trận dưới đây tách bạch ba giả thuyết:
 *   A. max_tokens quá nhỏ          → tăng budget là hết
 *   B. thinking ăn hết budget      → đặt thinkingBudget thấp là hết
 *   C. responseSchema thật sự hỏng → phải tự bóc JSON ở tầng ứng dụng
 *
 * Chạy:
 *   npx tsx scripts/probe-ai.ts
 */
import 'dotenv/config';
import { registerAppActivities } from '../srv/src/core/ai/activities';
import { registerAppEmbeddingCorpora } from '../srv/src/core/ai/embeddingCorpora';
import { initEmbeddings, complete } from '../srv/src/core/ai/llmClient';
import { AICORE_DEFAULT_MODEL } from '../srv/src/config/ai';
import type { AIResponse } from '@cnma/sap-aicore-integrate/types';

const DEFECT_PROMPT =
    'A milling tool ran to 11,800 cycles against an 8,000-cycle limit, producing ' +
    'a 0.32mm burr where the spec allows 0.10mm max. Return the root cause ' +
    'category and the measured values.';

const DEFECT_SCHEMA = {
    type: 'object',
    properties: {
        rootCauseCategory: {
            type: 'string',
            enum: ['Man', 'Machine', 'Method', 'Material', 'Measurement', 'Environment'],
        },
        measuredValue: { type: 'string' },
        specValue: { type: 'string' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
    },
    required: ['rootCauseCategory', 'measuredValue', 'specValue', 'confidence'],
};

interface TestCase {
    name: string;
    prompt: string;
    maxTokens: number;
    thinkingBudget?: number;
    schema?: Record<string, unknown>;
    /** Kiểm tra kết quả; trả về null nếu đạt, hoặc lý do không đạt. */
    check: (res: AIResponse) => string | null;
}

const TESTS: TestCase[] = [
    {
        name: 'A1 · plain · max_tokens 50 (tái hiện lỗi cũ)',
        prompt: 'Reply with exactly these three words: AI CORE OK',
        maxTokens: 50,
        check: (r) => (r.content.includes('OK') ? null : `output cụt: ${JSON.stringify(r.content)}`),
    },
    {
        name: 'A2 · plain · max_tokens 2000',
        prompt: 'Reply with exactly these three words: AI CORE OK',
        maxTokens: 2000,
        check: (r) => (r.content.includes('OK') ? null : `output cụt: ${JSON.stringify(r.content)}`),
    },
    {
        name: 'B1 · plain · max_tokens 200 + thinkingBudget 0',
        prompt: 'Reply with exactly these three words: AI CORE OK',
        maxTokens: 200,
        thinkingBudget: 0,
        check: (r) => (r.content.includes('OK') ? null : `output cụt: ${JSON.stringify(r.content)}`),
    },
    {
        name: 'C1 · structured · max_tokens 500 (tái hiện lỗi cũ)',
        prompt: DEFECT_PROMPT,
        maxTokens: 500,
        schema: DEFECT_SCHEMA,
        check: checkDefectJson,
    },
    {
        name: 'C2 · structured · max_tokens 4000',
        prompt: DEFECT_PROMPT,
        maxTokens: 4000,
        schema: DEFECT_SCHEMA,
        check: checkDefectJson,
    },
    {
        name: 'C3 · structured · max_tokens 4000 + thinkingBudget 512',
        prompt: DEFECT_PROMPT,
        maxTokens: 4000,
        thinkingBudget: 512,
        schema: DEFECT_SCHEMA,
        check: checkDefectJson,
    },
    {
        name: 'D1 · structured LỚN · max_tokens 16000 (cỡ payload 8D thật)',
        prompt:
            'Draft a minimal 8D report skeleton for the milling burr defect above. ' +
            DEFECT_PROMPT,
        maxTokens: 16000,
        schema: {
            type: 'object',
            properties: {
                disciplines: {
                    type: 'array',
                    minItems: 8,
                    maxItems: 8,
                    items: {
                        type: 'object',
                        properties: {
                            code: {
                                type: 'string',
                                enum: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'],
                            },
                            summary: { type: 'string' },
                        },
                        required: ['code', 'summary'],
                    },
                },
            },
            required: ['disciplines'],
        },
        check: (r) => {
            try {
                const p = JSON.parse(stripFence(r.content));
                const n = p.disciplines?.length;
                if (n !== 8) return `chỉ trả ${n} discipline, cần đúng 8`;
                const codes = p.disciplines.map((d: any) => d.code).join(',');
                return codes === 'D1,D2,D3,D4,D5,D6,D7,D8' ? null : `sai thứ tự code: ${codes}`;
            } catch (e: any) {
                return `parse hỏng: ${e.message}`;
            }
        },
    },
];

function stripFence(s: string): string {
    return s.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

function checkDefectJson(r: AIResponse): string | null {
    try {
        const p = JSON.parse(stripFence(r.content));
        if (p.rootCauseCategory !== 'Machine') {
            return `parse được nhưng category = ${p.rootCauseCategory}, kỳ vọng Machine`;
        }
        return null;
    } catch (e: any) {
        return `parse hỏng: ${e.message}`;
    }
}

async function run(t: TestCase) {
    const started = Date.now();
    process.stdout.write(`\n${t.name}\n`);
    try {
        const res = await complete([{ role: 'user', content: t.prompt }], {
            activity: t.schema ? 'analyzeDefect' : 'parseData',
            temperature: 0,
            max_tokens: t.maxTokens,
            ...(t.thinkingBudget !== undefined && { thinkingBudget: t.thinkingBudget }),
            ...(t.schema && {
                responseMimeType: 'application/json',
                responseSchema: t.schema,
            }),
        });

        const ms = Date.now() - started;
        const u = res.usage ?? {};
        const problem = t.check(res);

        console.log(`   ${problem ? '✗' : '✓'} finishReason=${res.finishReason}  ` +
            `prompt=${u.promptTokens} completion=${u.completionTokens} total=${u.totalTokens}  ${ms}ms`);
        if (problem) {
            console.log(`     ${problem}`);
            console.log(`     raw: ${JSON.stringify(res.content).slice(0, 200)}`);
        }
        return { name: t.name, ok: !problem, finishReason: res.finishReason, usage: u, ms };
    } catch (e: any) {
        console.log(`   ✗ NÉM LỖI: ${e.message}`);
        return { name: t.name, ok: false, error: e.message, ms: Date.now() - started };
    }
}

async function main() {
    if (process.env.MOCK_LLM === 'true') {
        console.warn('⚠️  MOCK_LLM=true — script này sẽ KHÔNG gọi AI Core thật.');
    }

    registerAppActivities();
    registerAppEmbeddingCorpora();
    initEmbeddings();

    console.log(`\nModel mặc định: ${AICORE_DEFAULT_MODEL}`);
    console.log('Chạy ma trận probe — mất vài phút vì reasoning model chậm.');
    console.log('═'.repeat(72));

    const results = [];
    for (const t of TESTS) results.push(await run(t));

    console.log('\n' + '═'.repeat(72));
    console.log('KẾT LUẬN\n');

    const byName = Object.fromEntries(results.map((r) => [r.name.slice(0, 2), r]));

    if (byName.A1?.ok === false && byName.A2?.ok) {
        console.log('  ✓ Giả thuyết A đúng: max_tokens nhỏ làm cắt output.');
    }
    if (byName.B1?.ok) {
        console.log('  ✓ Giả thuyết B đúng: thinkingBudget thấp giải phóng budget cho output.');
    }
    if (byName.C2?.ok || byName.C3?.ok) {
        console.log('  ✓ responseSchema HOẠT ĐỘNG — chỉ cần đủ token. Pipeline 8D giữ nguyên thiết kế.');
    } else {
        console.log('  ✗ responseSchema KHÔNG dùng được kể cả khi đủ token.');
        console.log('    → Phase 2 phải tự bóc JSON: prompt yêu cầu JSON thuần + parser chịu lỗi + retry.');
    }
    if (byName.D1?.ok) {
        console.log('  ✓ Ràng buộc minItems/maxItems 8 có hiệu lực — model trả đúng 8 discipline.');
    } else {
        console.log('  ⚠️  Model KHÔNG tôn trọng minItems 8 — postProcess phải tự điền chỗ thiếu.');
    }

    const slowest = results.reduce((a, b) => (a.ms > b.ms ? a : b));
    console.log(`\n  Lời gọi chậm nhất: ${slowest.ms}ms (${slowest.name}).`);
    console.log('  Pipeline 8D là 2 lời gọi nối tiếp trên payload lớn hơn nhiều —');
    console.log('  hãy tính timeout client theo bội số của con số này.');

    const failed = results.filter((r) => !r.ok).map((r) => r.name.slice(0, 2));
    console.log(`\n  Không đạt: ${failed.length ? failed.join(', ') : 'không có'}`);
}

main().catch((e) => {
    console.error('\n✗ Probe thất bại:', e?.message ?? e);
    console.error('\nKiểm tra theo thứ tự:');
    console.error('  1. .env có AICORE_SERVICE_KEY hoặc đủ bộ AICORE_AUTH_URL/CLIENT_ID/CLIENT_SECRET/BASE_URL');
    console.error('  2. AICORE_RESOURCE_GROUP khớp resource group thật');
    console.error('  3. Đã bấm Sync Models ở trang AI Settings → tab Model Registry');
    console.error('  4. Model được định tuyến có tồn tại trong resource group đó');
    process.exit(1);
});
