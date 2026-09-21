/**
 * Chạy pipeline 8D từ dòng lệnh — không cần khởi động CAP server.
 *
 * Đây là vòng lặp phát triển chính cho Phase 2: sửa prompt, chạy lại, đọc kết
 * quả. Nhanh hơn nhiều so với bấm qua UI, và in ra đủ thứ cần để đánh giá chất
 * lượng: sources, dataBacked, confidence, token, thời gian, và mọi chỗ
 * postProcess phải chữa.
 *
 * Chạy:
 *   npx tsx scripts/run-analyze.ts mock-data/case-8D-10048412.json
 *   npx tsx scripts/run-analyze.ts mock-data/case-8D-10048651.json --full
 *   npx tsx scripts/run-analyze.ts --all
 *
 *   --full   in cả phần content markdown của từng discipline
 *   --all    chạy lần lượt cả 4 case trong mock-data/
 *   --save   ghi kết quả ra .out.json cạnh file input
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { registerAppActivities } from '../srv/src/core/ai/activities';
import { registerAppEmbeddingCorpora } from '../srv/src/core/ai/embeddingCorpora';
import { initEmbeddings } from '../srv/src/core/ai/llmClient';
import { analyze } from '../srv/src/domain/eightd/eightDAnalyzer';
import { PipelineError } from '../srv/src/domain/eightd/types';

const MOCK_DIR = path.resolve(__dirname, "../mock-data/clean");

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const files = args.filter((a) => !a.startsWith('--'));

function bar(char = '─', n = 78) {
    return char.repeat(n);
}

function pct(n: number) {
    return `${Math.round(n * 100)}%`;
}

async function runOne(file: string) {
    const abs = path.resolve(file);
    if (!fs.existsSync(abs)) {
        console.error(`Không tìm thấy file: ${abs}`);
        return false;
    }

    console.log(`\n${bar('═')}`);
    console.log(`▶  ${path.basename(abs)}`);
    console.log(bar('═'));

    const payload = fs.readFileSync(abs, 'utf-8');

    let outcome;
    try {
        outcome = await analyze(payload);
    } catch (e: any) {
        console.error(`\n✗ THẤT BẠI (${e instanceof PipelineError ? e.code : 'unknown'}): ${e.message}`);
        console.error(e.stack);
        if (e instanceof PipelineError && e.details) {
            console.error('  chi tiết:', e.details);
        }
        return false;
    }

    const { context, result, models, tokensUsed, durationMs, repairs } = outcome;
    const independent = outcome.independent as any;

    // ── Ngữ cảnh ──
    console.log(`\nCase        ${context.notificationId}  ·  ${context.origin}`);
    console.log(`Sản phẩm    ${context.product.materialId} ${context.product.materialDesc}`);
    console.log(`Lỗi         ${context.product.defectCode} ${context.product.defectText}`);
    console.log(`Root cause  ${context.rootCause?.category ?? '(chưa xác định)'}`);
    console.log(`Actions     containment=${context.actions.containment.length} ` +
        `corrective=${context.actions.corrective.length} preventive=${context.actions.preventive.length}`);

    if (context.gaps.length) {
        console.log(`\nLỗ hổng dữ liệu (${context.gaps.length}):`);
        for (const g of context.gaps) console.log(`  · ${g}`);
    }

    // ── Chẩn đoán mù: phần chứng minh AI suy luận chứ không parse ──
    if (independent?.finding) {
        const { finding, verdict, leaks } = independent;
        console.log(`\n${bar('━')}`);
        console.log('CHẨN ĐOÁN ĐỘC LẬP  (AI không hề thấy đáp án)');
        console.log(bar('━'));

        console.log(`  Kỹ sư ghi   : ${verdict.recordedCategory}`);
        console.log(`  AI tự chọn  : ${verdict.aiCategory}   (confidence ${pct(finding.confidence)})`);
        console.log(`  → ${verdict.agrees ? '✓ TRÙNG NHAU' : '✗ LỆCH — xem lập luận bên dưới'}`);
        console.log(`  Độ sâu 5-Why: AI ${verdict.aiStepCount} bước · kỹ sư ${verdict.recordedStepCount} bước`);
        if (leaks?.length) console.log(`  ⚠ RÒ ĐÁP ÁN: ${leaks.join(' ')}`);

        console.log(`\n  Kết luận: ${finding.rootCauseStatement}`);

        console.log('\n  Chuỗi 5-Why AI tự dựng:');
        for (const s of finding.derivedFiveWhy ?? []) {
            console.log(`    ${s.stepNo}. ${s.question}`);
            console.log(`       → ${s.answer}`);
            console.log(`       bằng chứng: ${s.evidence}`);
        }

        console.log('\n  Loại trừ:');
        for (const r of finding.ruledOut ?? []) {
            console.log(`    ${r.category.padEnd(12)} ${r.reason}`);
        }

        if (finding.runnerUpCategory) {
            console.log(`\n  Khả dĩ thứ hai: ${finding.runnerUpCategory} — ${finding.runnerUpReason}`);
        }
        if (finding.evidenceGaps?.length) {
            console.log('\n  Muốn có thêm dữ liệu:');
            for (const g of finding.evidenceGaps) console.log(`    · ${g}`);
        }
    }

    // ── Tóm tắt ──
    console.log(`\n${bar()}`);
    console.log('INTERNAL SUMMARY');
    console.log(bar());
    console.log(result.internalSummary);

    console.log(`\n${bar()}`);
    console.log(`CUSTOMER SUMMARY  ${context.isCustomerFacing ? '' : '(kỳ vọng null — case Q3)'}`);
    console.log(bar());
    console.log(result.customerSummary ?? '(null)');

    // ── 8 discipline ──
    console.log(`\n${bar()}`);
    console.log('DISCIPLINES');
    console.log(bar());

    for (const d of result.disciplines) {
        const flag = d.dataBacked ? '  ' : '⚠ ';
        console.log(`\n${flag}${d.code}  ${d.title}`);
        console.log(`    confidence ${pct(d.confidence)}  ·  dataBacked ${d.dataBacked}  ·  ` +
            `${d.actionItems.length} action items`);
        console.log(`    sources: ${d.sources.length ? d.sources.join(', ') : '(rỗng)'}`);
        console.log(`    ${d.summary}`);

        if (flags.has('--full')) {
            console.log();
            for (const line of d.content.split('\n')) console.log(`    │ ${line}`);
            if (d.actionItems.length) {
                console.log('    │');
                for (const a of d.actionItems) console.log(`    │ → ${a}`);
            }
        }
    }

    // ── Kiểm tra tự động ──
    console.log(`\n${bar()}`);
    console.log('KIỂM TRA');
    console.log(bar());

    const checks: Array<[string, boolean, string]> = [
        ['đủ 8 discipline', result.disciplines.length === 8, `${result.disciplines.length}`],
        ['đúng thứ tự D1..D8',
            result.disciplines.map((d) => d.code).join(',') === 'D1,D2,D3,D4,D5,D6,D7,D8',
            result.disciplines.map((d) => d.code).join(',')],
        ['D6 dataBacked = false',
            result.disciplines.find((d) => d.code === 'D6')?.dataBacked === false, ''],
        ['customerSummary khớp origin',
            context.isCustomerFacing ? !!result.customerSummary : result.customerSummary === null, ''],
        ['mọi discipline dataBacked đều có sources',
            result.disciplines.every((d) => !d.dataBacked || d.sources.length > 0), ''],
        ['internalSummary không rỗng', result.internalSummary.trim().length > 0, ''],
        ['bằng chứng mù không rò đáp án',
            (independent?.leaks?.length ?? 0) === 0, (independent?.leaks ?? []).join(' ')],
        ['AI tự dựng được chuỗi 5-Why >= 2 bước',
            (independent?.finding?.derivedFiveWhy?.length ?? 0) >= 2, ''],
        ['AI loại trừ đủ các nhánh còn lại',
            (independent?.finding?.ruledOut?.length ?? 0) >= 4, ''],
    ];

    // Case thiếu preventive action thì D7 PHẢI được đánh dấu là không có dữ liệu.
    // Đây là phép thử chống bịa quan trọng nhất — xem mock-data/README.md.
    if (context.actions.preventive.length === 0) {
        const d7 = result.disciplines.find((d) => d.code === 'D7');
        checks.push(['D7 dataBacked = false (case không có preventive action)',
            d7?.dataBacked === false, `dataBacked=${d7?.dataBacked}`]);
    }

    let failed = 0;
    for (const [label, ok, detail] of checks) {
        if (!ok) failed++;
        console.log(`  ${ok ? '✓' : '✗'} ${label}${detail && !ok ? ` — ${detail}` : ''}`);
    }

    if (repairs.length) {
        console.log(`\n  postProcess phải chữa ${repairs.length} chỗ:`);
        for (const r of repairs) console.log(`    · ${r}`);
    }

    console.log(`\n  model  parse=${models.parse}  analyze=${models.analyze}`);
    console.log(`  token  ${tokensUsed.toLocaleString()}  ·  thời gian ${(durationMs / 1000).toFixed(1)}s`);

    if (flags.has('--save')) {
        const out = abs.replace(/\.json$/, '.out.json');
        fs.writeFileSync(out, JSON.stringify(outcome, null, 2), 'utf-8');
        console.log(`  đã ghi ${path.basename(out)}`);
    }

    return failed === 0;
}

async function main() {
    registerAppActivities();
    registerAppEmbeddingCorpora();
    initEmbeddings();

    let targets = files;
    if (flags.has('--all') || targets.length === 0) {
        targets = fs.readdirSync(MOCK_DIR)
            .filter((f) => f.startsWith('case-') && f.endsWith('.json') && !f.endsWith('.out.json'))
            .sort()
            .map((f) => path.join(MOCK_DIR, f));
        if (!flags.has('--all')) {
            console.log('Không truyền file — chạy toàn bộ mock-data/. Dùng --all để khỏi thấy dòng này.\n');
        }
    }

    const results: Array<[string, boolean]> = [];
    for (const f of targets) results.push([path.basename(f), await runOne(f)]);

    if (results.length > 1) {
        console.log(`\n${bar('═')}`);
        console.log('TỔNG KẾT');
        console.log(bar('═'));
        for (const [name, ok] of results) console.log(`  ${ok ? '✓' : '✗'} ${name}`);
    }

    process.exit(results.every(([, ok]) => ok) ? 0 : 1);
}

main().catch((e) => {
    console.error('\n✗ Lỗi ngoài dự kiến:', e);
    process.exit(1);
});
