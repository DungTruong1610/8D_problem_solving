/**
 * Chạy trọn luồng nghiệp vụ của 8D Copilot trên một sự vụ MỚI.
 *
 * ── Khác gì với các script test khác ──
 * `measure-similarity.mjs` đo khoảng cách giữa các case ĐÃ nằm trong kho.
 * `seed-library.ts --verify` chấm điểm hai case đều đã có sẵn.
 * Cả hai đều bỏ qua câu hỏi thật.
 *
 * Ở đây đầu vào là một sự vụ **chưa có trong kho**, mỏng đúng như lúc vừa được
 * ghi nhận: có triệu chứng và bối cảnh, CHƯA có nguyên nhân, chưa có 5-Why,
 * chưa có action, chưa có nhóm. Đó là tình huống thật mà công cụ phải giúp được.
 *
 * Bốn chặng:
 *   ① tiếp nhận      sự vụ → CaseContext (thuần code, xác thực và chuẩn hoá)
 *   ② nhúng          mô tả sự vụ → vector 1536 chiều
 *   ③ tìm tiền lệ    chấm điểm cả kho, cắt ngưỡng, lấy top-N  (thuần code)
 *   ④ dựng báo cáo   AI viết D1–D8, có trích nguồn            (AI)
 *
 * Chạy:
 *   npx tsx scripts/run-e2e.ts
 *   npx tsx scripts/run-e2e.ts --only A
 *   npx tsx scripts/run-e2e.ts --no-ai       dừng sau chặng ③
 */
import fs from 'node:fs';
import path from 'node:path';

const HOST = process.env.SEED_HOST ?? 'http://127.0.0.1:4004';
const EIGHTD = `${HOST}/api/cnma/EIGHTD_SRV`;
const AI = `${HOST}/api/cnma/AI_SRV`;

const TOKEN = process.env.SEED_TOKEN ?? '';
const AUTH = TOKEN
    ? { Authorization: `Bearer ${TOKEN}` }
    : {
        Authorization: 'Basic ' + Buffer.from(
            `${process.env.SEED_USER ?? 'admin'}:${process.env.SEED_PASS ?? '123'}`,
        ).toString('base64'),
    };

const INCOMING = path.resolve(__dirname, '../mock-data/incoming');

const args = process.argv.slice(2);
const noAi = args.includes('--no-ai');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? args[onlyIdx + 1]?.toUpperCase() : null;

async function call(url: string, body?: unknown): Promise<any> {
    const res = await fetch(url, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${url}\n${text.slice(0, 400)}`);
    return text ? JSON.parse(text) : null;
}
/** CAP gói kết quả action trong `value` dạng chuỗi JSON. */
const act = (r: any) => (typeof r?.value === 'string' ? JSON.parse(r.value) : r);

const rule = (s = '') => console.log(`\n${'─'.repeat(78)}\n${s}`);
const money = (n: number | null) => (n == null ? '—' : `€${Number(n).toLocaleString('de-DE')}`);

async function runIssue(file: string) {
    const raw = fs.readFileSync(path.join(INCOMING, file), 'utf8');
    const issue = JSON.parse(raw);

    rule(`SỰ VỤ ${issue.notificationId}  ·  ${issue.origin}`);
    console.log(`  "${issue.symptomShortText}"`);
    console.log(`  ${issue.workCenter?.workCenterId}  ${issue.material?.materialId} (${issue.material?.description})`);
    console.log(`  lỗi ${issue.defect?.defectCode} — ${issue.defect?.defectText}`);
    console.log(`  phát hiện ${issue.foundDate} · ${issue.quantityExtent}`);
    console.log(`  điều tra đã có: ${issue.causesIshikawa?.length ?? 0} nhánh Ishikawa · `
        + `${issue.fiveWhyChain?.length ?? 0} bước 5-Why · ${issue.actions?.length ?? 0} action · `
        + `${issue.teamAssignments?.length ?? 0} thành viên nhóm`);

    // ── ① Tiếp nhận ──────────────────────────────────────────────────────────
    const t0 = Date.now();
    const { value: reportID } = await call(`${EIGHTD}/analyzeFromJson`, {
        payload: raw,
        title: `E2E — ${issue.symptomShortText}`,
    });
    console.log(`\n① TIẾP NHẬN — report ${reportID}  (${Date.now() - t0}ms)`);

    const ctxRow = await call(`${EIGHTD}/Reports('${reportID}')?$select=caseContext`);
    const ctx = JSON.parse(ctxRow.caseContext);
    console.log(`   chuẩn hoá xong. Hệ thống tự ghi nhận ${ctx.gaps.length} lỗ hổng dữ liệu:`);
    for (const g of ctx.gaps.slice(0, 4)) console.log(`     · ${g}`);
    if (ctx.gaps.length > 4) console.log(`     · … còn ${ctx.gaps.length - 4} mục`);

    // ── ②③ Tìm tiền lệ ───────────────────────────────────────────────────────
    const t1 = Date.now();
    const resp = act(await call(`${EIGHTD}/findPrecedents(reportID='${reportID}')`));
    console.log(`\n②③ TÌM TIỀN LỆ  (${Date.now() - t1}ms)`);

    const isPerStep = Boolean(resp?.byStep && resp?.union);
    const precedents: any[] = isPerStep ? resp.union : (resp?.precedents ?? []);
    const sampleStep: any = isPerStep ? (resp.byStep.D1 ?? Object.values(resp.byStep)[0]) : resp;

    if (isPerStep) {
        console.log(`   kho ${sampleStep?.libraryCount ?? 0} case · danh sách hợp nhất: ${precedents.length} tiền lệ (từ ${Object.keys(resp.byStep).length} bước D)`);
        for (const [code, stepResult] of Object.entries<any>(resp.byStep)) {
            console.log(`     · ${code} (${stepResult.profileLabel}): ${stepResult.precedents.length} case (ngưỡng ${stepResult.settings?.minScore}/${stepResult.maxScore}, top ${stepResult.settings?.topN})`);
        }
        console.log(`   nhúng mô tả sự vụ: ${sampleStep?.semanticUsed ? 'thành công — tiêu chí ngữ nghĩa có tham gia' : 'KHÔNG dùng'}`);
    } else if (sampleStep?.settings) {
        console.log(`   kho ${sampleStep.libraryCount} case · chấm ${sampleStep.candidatesScored} ứng viên · `
            + `ngưỡng ${sampleStep.settings.minScore}/${sampleStep.maxScore} · lấy tối đa ${sampleStep.settings.topN}`);
        console.log(`   nhúng mô tả sự vụ: ${sampleStep.semanticUsed ? 'thành công — tiêu chí ngữ nghĩa có tham gia' : 'KHÔNG dùng'}`);
    }

    if (!precedents.length) {
        console.log(`\n   ✗ KHÔNG CÓ TIỀN LỆ`);
        console.log(`     ${sampleStep?.reason ?? 'No matching precedents found.'}`);
    }
    for (const pr of precedents) {
        console.log(`\n   ${pr.notificationId}   ${pr.score}/${pr.maxScore}   ${pr.sapStatus}`);
        console.log(`      ${pr.explanation}`);
        console.log(`      vì sao: ${pr.breakdown.map((b: any) => `${b.criterionKey}=${b.level}(+${b.points})`).join('  ')}`);
        console.log(`      nguyên nhân gốc đã xác nhận: ${pr.rootCauseCategory ?? '—'} · thiệt hại ${money(pr.copqEur)}`);
        console.log(`      nhóm đã xử lý: ${pr.team.map((t: any) => `${t.partnerName} (${t.functionTitle})`).join(' · ') || '—'}`);
        const byType: Record<string, string[]> = {};
        for (const a of pr.actions as Array<{ actionType: string; actionText: string }>) {
            const list: string[] = byType[a.actionType] ?? [];
            list.push(a.actionText);
            byType[a.actionType] = list;
        }
        for (const [k, v] of Object.entries(byType)) {
            console.log(`      ${k}: ${v[0].slice(0, 84)}${v[0].length > 84 ? '…' : ''}`);
        }
    }

    // ── Gợi ý D1 rút ra từ tiền lệ (thuần code) ──────────────────────────────
    if (precedents.length) {
        const byPerson = new Map<string, { name: string; fn: string; n: number; cases: string[] }>();
        const byFn = new Map<string, number>();
        for (const pr of precedents) {
            for (const t of pr.team) {
                const e = byPerson.get(t.partnerId)
                    ?? { name: t.partnerName, fn: t.functionTitle, n: 0, cases: [] as string[] };
                e.n++; e.cases.push(pr.notificationId);
                byPerson.set(t.partnerId, e);
                byFn.set(t.functionTitle, (byFn.get(t.functionTitle) ?? 0) + 1);
            }
        }
        console.log(`\n   → D1 rút ra được (đếm bằng code, không phải AI đoán):`);
        console.log(`     vai trò cần: ${[...byFn].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f}×${n}`).join(' · ')}`);
        for (const [, v] of [...byPerson].sort((a, b) => b[1].n - a[1].n).slice(0, 4)) {
            console.log(`     ${v.n}× ${v.name.padEnd(15)} ${v.fn.padEnd(26)} ${v.cases.join(', ')}`);
        }
    }

    if (noAi) return;

    // ── ④ Dựng báo cáo ───────────────────────────────────────────────────────
    console.log(`\n④ DỰNG BÁO CÁO 8D — đang chờ AI (60-360 giây)…`);
    const started = Date.now();
    let row: any = null;
    for (let i = 0; i < 120; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        try {
            row = await call(`${EIGHTD}/Reports('${reportID}')`
                + '?$select=status,errorMessage,aiModelAnalyze,aiRootCause,aiAgreesWithRecord,tokensUsed,durationMs,internalSummary,customerSummary');
            if (row) {
                process.stdout.write(`\r   ${Math.round((Date.now() - started) / 1000)}s — ${row.status}      `);
                if (row.status !== 'Analyzing') break;
            }
        } catch (pollErr: any) {
            process.stdout.write(`\r   ${Math.round((Date.now() - started) / 1000)}s — Đang chờ backend... (${pollErr.message?.slice(0, 30)})      `);
        }
    }
    console.log('');

    if (!row || row.status !== 'Analyzed') {
        console.log(`   ✗ ${row?.status ?? 'Timeout'}: ${row?.errorMessage ?? 'Quá thời gian chờ'}`);
        return;
    }

    console.log(`   ✓ ${row.aiModelAnalyze} · ${row.tokensUsed} token · ${Math.round(row.durationMs / 1000)}s`);
    console.log(`   chẩn đoán mù: AI tự chọn ${row.aiRootCause}`
        + (row.aiAgreesWithRecord === null ? ' (sự vụ mới chưa có đáp án để đối chiếu)' : ''));

    const d = await call(`${EIGHTD}/Disciplines?$filter=report_ID eq '${reportID}'`
        + '&$select=code,title,summary,dataBacked,confidence,sources&$orderby=sequence');
    console.log('');
    for (const x of d.value) {
        const src = JSON.parse(x.sources || '[]');
        console.log(`   ${x.code}  ${String(x.title).padEnd(30)} ${x.dataBacked ? 'có nguồn ' : 'SUY LUẬN'} conf=${x.confidence}  ${src.length} trích dẫn`);
        console.log(`        ${String(x.summary).replace(/\s+/g, ' ').slice(0, 100)}…`);
    }

    console.log(`\n   Tóm tắt đối nội: ${String(row.internalSummary).replace(/\s+/g, ' ').slice(0, 190)}…`);
    if (row.customerSummary) {
        console.log(`   Tóm tắt đối ngoại: ${String(row.customerSummary).replace(/\s+/g, ' ').slice(0, 190)}…`);
    }
}

async function main() {
    const files = fs.readdirSync(INCOMING)
        .filter((f) => f.startsWith('issue-') && f.endsWith('.json'))
        .filter((f) => !only || f.startsWith(`issue-${only}`))
        .sort();

    if (!files.length) {
        console.error(`Không thấy sự vụ nào trong ${INCOMING}` + (only ? ` khớp --only ${only}` : ''));
        process.exit(1);
    }

    console.log(`Host: ${HOST}`);
    console.log(`Sự vụ: ${files.join(', ')}${noAi ? '   (bỏ bước AI)' : ''}`);

    for (const f of files) await runIssue(f);

    rule('XONG');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
