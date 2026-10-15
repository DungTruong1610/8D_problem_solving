/**
 * MLAI Hackathon 2026 — Track 1: OrganizationAI
 * Sprint 1 Automated 90-Second Verify Harness & Test Suite
 * 
 * Compliant with:
 * - Section 3.b: Automated Verify Harness (1-Click / Single command under 90s, pass/fail table, timestamp)
 * - Section 3.b: Mandatory Safe Refusal / Escalation scenario (TC-04)
 * - Section 4 - Criterion 2: 12/12 Points Verify Harness
 * - Section 4 - Criterion 3: 8/8 Points Judge Live Input Defense (Two-Tier Architecture)
 *
 * Usage:
 *   npx tsx scripts/verify-sprint1-harness.ts
 *   npx tsx scripts/verify-sprint1-harness.ts --json
 *   npx tsx scripts/verify-sprint1-harness.ts --judge-input <path-to-json>
 */

import fs from 'node:fs';
import path from 'node:path';
import cds from '@sap/cds';
import { validateDataset, blockingIssues } from '../srv/src/domain/eightd/datasetValidator';
import { firstNumber, mapCase } from '../srv/src/domain/eightd/caseMapper';
import { findPrecedentsByStep } from '../srv/src/domain/eightd/precedent/findPrecedents';
import {
    contradictingEvidence,
    evaluateStops,
    incompleteInputStop,
    notManufacturingStop,
    primaryStopType,
    type Stop,
    type StopType,
} from '../srv/src/domain/eightd/stops';
import type { JudgeEvaluation, JudgeStop } from '../shared/judge-evaluation';

export interface TestCaseResult {
    id: string;
    title: string;
    category: string;
    inputSummary: string;
    expectedBehavior: string;
    actualBehavior: string;
    status: 'PASS' | 'FAIL';
    durationMs: number;
    details: Record<string, any>;
    reportId?: string;
    notificationId?: string;
    /** Loại dừng chính theo `stops.ts`; null = AI được đi tiếp. */
    stopType: StopType | null;
    stops: JudgeStop[];
}

const toJudgeStop = (s: Stop): JudgeStop => ({
    id: s.id,
    type: s.type,
    step: s.step,
    reason: s.reason,
    questionForHuman: s.questionForHuman,
    requiredRole: s.requiredRole,
    blocking: s.blocking,
});

export interface VerifyHarnessReport {
    suite: string;
    track: string;
    challenge: string;
    executedAt: string;
    totalDurationMs: number;
    targetDurationLimitMs: number;
    passed: number;
    failed: number;
    total: number;
    verdict: 'PASS' | 'FAIL';
    results: TestCaseResult[];
    judgeInputEvaluation?: {
        tested: boolean;
        fileName?: string;
        decision: 'HANDLED_APPROPRIATELY' | 'GRACEFULLY_REFUSED' | 'ESCALATED';
        reason: string;
        stopType: StopType | null;
    };
}

const { SELECT } = cds.ql;
/**
 * Thư mục chứa 4 file test.
 *
 * Trên deploy, server chạy từ artifact `gen/srv/` — ở đó KHÔNG có `mock-data/`.
 * `scripts/bundle-library.mjs` (chạy trong `npm run build`) chép các file test
 * vào `srv/data/sprint1-test-cases/`, và `cds build` mang thư mục đó theo. Chạy
 * từ repo thì đọc thẳng `mock-data/`. Không thấy chỗ nào thì báo lỗi rõ ràng —
 * không có file test thì không có gì để chấm.
 */
const TEST_CASE_DIR_CANDIDATES = [
    path.resolve(__dirname, '../srv/data/sprint1-test-cases'),
    path.resolve(__dirname, '../mock-data/sprint1-test-cases'),
];

function testCasesDir(): string {
    const found = TEST_CASE_DIR_CANDIDATES.find((d) => fs.existsSync(path.join(d, 'tc-01-happy-path.json')));
    if (!found) {
        throw new Error(`Test case files not found. Looked in: ${TEST_CASE_DIR_CANDIDATES.join(', ')}. Run "npm run bundle:library" (part of "npm run build").`);
    }
    return found;
}

async function initDatabaseConnection() {
    try {
        if (!cds.model) {
            (cds.model as any) = await cds.load('*');
        }
        const db = await cds.connect.to('db');
        await db.run(SELECT.one.from('cnma.proresolve.HistoricalCases'));
        return db;
    } catch {
        // Fallback to local SQLite database (db.sqlite)
        (cds.env.requires as any).db = {
            kind: 'sqlite',
            credentials: { url: 'db.sqlite' },
        };
        if (!cds.model) {
            (cds.model as any) = await cds.load('*');
        }
        return cds.connect.to('db');
    }
}

/**
 * ── Vì sao KHÔNG còn `ensureDisciplinesCompleted` ──
 * Bản cũ ghi thẳng `reviewStatus = 'Approved'` cho MỌI bước của các report mẫu,
 * ký tên "AI Lead / Quality Manager", không để lại dòng vết nào — mỗi lần ai đó
 * bấm Verify. Đó chính là "máy duyệt thay người" mà sản phẩm phải chứng minh
 * ngược lại, và nó ghi đè quyết định thật trong DB. Verify giờ chỉ ĐỌC.
 */

/**
 * ── Luật chung cho bốn test case ─────────────────────────────────────────────
 *
 * Mỗi test chạy ĐÚNG đường mà app chạy cho một case thật — không có đường tắt
 * riêng cho harness:
 *   - kiểm tra dữ liệu: `validateDataset` / `mapCase`
 *   - tiền lệ: `findPrecedentsByStep(...).byStep.D4`, đúng nguồn mà
 *     `getCaseStops` dùng để quyết định dừng "không có tiền lệ"
 *   - lần dừng: `evaluateStops`
 *
 * Đáp án đúng KHÔNG nằm trong file này: nó là `$expectedOutcome` của chính file
 * test trong `mock-data/sprint1-test-cases/`. Harness chỉ so kết quả đo được với
 * đáp án đó. Không có câu "kết quả" nào viết sẵn: mọi chi tiết trong `details`
 * đều đọc từ thứ vừa chạy, hoặc từ DB.
 *
 * Không gọi model sinh văn bản (D1-D8 drafting), nên chạy nhanh — dưới một
 * giây là bình thường. Thứ tốn thời gian duy nhất là engine tiền lệ (có thể gọi
 * embedding nếu tiêu chí ngữ nghĩa đang bật).
 */

function loadTestCase(file: string): { raw: any; expected: Record<string, any> } {
    const raw = JSON.parse(fs.readFileSync(path.join(testCasesDir(), file), 'utf8'));
    const expected = raw?.$expectedOutcome;
    if (!expected || typeof expected !== 'object') {
        throw new Error(`${file} has no $expectedOutcome — the test has nothing to compare against.`);
    }
    return { raw, expected };
}

interface D4PrecedentCheck {
    count: number;
    ids: string[];
    top: { notificationId: string; explanation: string }[];
    reason: string | null;
    basis: string;
}

/**
 * Tiền lệ cho D4, chạy bằng engine thật của app.
 *
 * Bỏ chính case đang xét nếu nó đã có trong kho (case đóng được nạp lại làm
 * input) — một case tự khớp với chính nó thì không chứng minh được gì.
 */
async function realD4Precedents(ctx: any, raw: any): Promise<D4PrecedentCheck> {
    const perStep = await findPrecedentsByStep(ctx, raw);
    const d4 = perStep.byStep.D4;
    const self = String(ctx.notificationId ?? '');
    const precedents = d4.precedents.filter((p) => p.notificationId !== self);
    return {
        count: precedents.length,
        ids: precedents.map((p) => p.notificationId),
        top: precedents.slice(0, 3).map((p) => ({ notificationId: p.notificationId, explanation: p.explanation })),
        reason: d4.reason,
        basis: `${precedents.length} precedent(s) qualified for D4 (${d4.candidatesScored} candidates scored, min score ${d4.settings.minScore})`,
    };
}

/** Report của chính case test, nếu DB có. Không có thì null — không bịa ID. */
async function existingReportId(db: any, notificationId: string): Promise<string | undefined> {
    const rep = await db.run(SELECT.one.from('cnma.proresolve.Reports').columns('ID').where({ notificationId }));
    return rep?.ID ?? undefined;
}

/**
 * Executes TC-01: Happy Path End-to-End Workflow (Strong Precedent Match)
 */
async function runTC01(db: any): Promise<TestCaseResult> {
    const t0 = Date.now();
    const { raw, expected } = loadTestCase('tc-01-happy-path.json');
    const base = {
        id: 'TC-01',
        title: 'Milling Burr Defect (Happy Path - Strong Precedent Match)',
        category: 'Quadrant 1 - Perfect End-to-End Workflow',
        inputSummary: raw.symptomShortText,
        expectedBehavior: `Clean validation, D4 precedent search returns ${expected.topPrecedent}, symptom and measurements present, no blocking stop`,
        notificationId: raw.notificationId,
    };

    const blocking = blockingIssues(validateDataset(raw));
    if (blocking.length > 0) {
        return {
            ...base,
            actualBehavior: `Validation failed with blocking issues: ${blocking.map((b) => b.message).join('; ')}`,
            status: 'FAIL',
            durationMs: Date.now() - t0,
            stopType: null,
            stops: [],
            details: { blocking },
        };
    }

    const ctx = mapCase(raw);
    const prec = await realD4Precedents(ctx, raw);
    const precedentFound = prec.ids.includes(expected.topPrecedent);

    const stops = evaluateStops({ caseContext: ctx, precedents: { count: prec.count, reason: prec.reason, basis: prec.basis } });
    const blockingStops = stops.filter((s) => s.blocking);
    const hasSymptom = Boolean(ctx.header.symptomShortText);
    const hasMeasurements = (ctx.inspections?.length ?? 0) > 0;
    const isOk = expected.precedentFound === true && precedentFound && hasSymptom && hasMeasurements && blockingStops.length === 0;

    // Bài học của tiền lệ đó, đọc từ kho — không viết sẵn.
    const library = precedentFound
        ? await db.run(SELECT.one.from('cnma.proresolve.HistoricalCases')
            .columns('rootCauseCategory', 'symptomShortText')
            .where({ notificationId: expected.topPrecedent }))
        : null;

    return {
        ...base,
        actualBehavior: isOk
            ? `D4 precedent search returned ${prec.count} case(s) including ${expected.topPrecedent} (${prec.top.find((p) => p.notificationId === expected.topPrecedent)?.explanation ?? 'qualified'}); symptom and ${ctx.inspections.length} measurement(s) present; no blocking stop.`
            : !precedentFound
                ? `Expected precedent ${expected.topPrecedent} was not returned. D4 got: ${prec.ids.join(', ') || 'none'}${prec.reason ? ` (${prec.reason})` : ''}.`
                : blockingStops.length > 0
                    ? `Unexpected blocking stop on a clean case: ${blockingStops.map((s) => s.id).join(', ')}`
                    : `Input incomplete: symptom ${hasSymptom}, measurements ${ctx.inspections?.length ?? 0}.`,
        status: isOk ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0,
        reportId: await existingReportId(db, raw.notificationId),
        stopType: primaryStopType(stops),
        stops: stops.map(toJudgeStop),
        details: {
            precedentsReturned: prec.top,
            precedentBasis: prec.basis,
            expectedPrecedent: expected.topPrecedent,
            precedentRootCause: library?.rootCauseCategory ?? null,
            expectedRootCauseCategory: expected.rootCauseCategory ?? null,
            measurement: ctx.inspections[0] ? `${ctx.inspections[0].characteristic}: ${ctx.inspections[0].measuredValue} (${ctx.inspections[0].specValue})` : null,
        },
    };
}

/**
 * Executes TC-02: Dirty SAP QM Normalization (Real-world Fault Tolerance)
 */
async function runTC02(db: any): Promise<TestCaseResult> {
    const t0 = Date.now();
    const { raw, expected } = loadTestCase('tc-02-dirty-sap.json');

    // 1. Dữ liệu bẩn không được làm chặn cứng.
    const val = validateDataset(raw);
    const isCleanOfBlocking = blockingIssues(val).length === 0;

    // 2. Chuẩn hoá bằng mapper thật.
    const ctx = mapCase(raw);
    const rawMaterial = String(raw.material?.materialId ?? '');
    const idTrimmed = ctx.product.materialId === rawMaterial.trim() && rawMaterial !== rawMaterial.trim();

    // 3. Số đo bóc bằng CHÍNH hàm parse của app, từ dòng đo đầu tiên của mapper.
    const first = ctx.inspections?.[0];
    const parsedNumber = first ? firstNumber(String(first.measuredValue ?? '')) : null;
    const expectedValue = Number(expected.extractedMeasurements?.measuredValue);
    const metricExtracted = parsedNumber !== null && parsedNumber === expectedValue;

    // 4. Phải báo khoảng trống dữ liệu, không lấp bằng đoán.
    const hasGapsReported = ctx.gaps.length > 0;

    // 5. Số bóc từ chữ tự do phải dừng chờ QE xác nhận (dừng loại 1).
    const prec = await realD4Precedents(ctx, raw);
    const stops = evaluateStops({ caseContext: ctx, precedents: { count: prec.count, reason: prec.reason, basis: prec.basis } });
    const factStopRaised = stops.some((s) => s.id === 'unverified-facts:ambiguous-measurement:D4' && s.blocking);

    const isOk = isCleanOfBlocking && idTrimmed && metricExtracted && hasGapsReported && factStopRaised;

    return {
        id: 'TC-02',
        title: 'Dirty SAP QM Flange Defect (Messy Real-World Normalization)',
        category: 'Quadrant 2 - Messy / Real-World Fault Tolerance',
        inputSummary: `Free-text measurement "${String(raw.inspections?.[0]?.measuredValue ?? '')}", material ID "${rawMaterial}"`,
        expectedBehavior: `No crash, whitespace trimmed, ${expectedValue} parsed from free text, gaps reported, and a stop until a QE confirms the parsed value`,
        actualBehavior: isOk
            ? `Trimmed material ID to '${ctx.product.materialId}', parsed ${parsedNumber} from "${first?.measuredValue}", reported ${ctx.gaps.length} data gap(s), and stopped at D4 for QE confirmation of the parsed value.`
            : `Dirty data handling failed. Blocking-free: ${isCleanOfBlocking}, trimmed: ${idTrimmed}, parsed: ${parsedNumber} (expected ${expectedValue}), gaps: ${ctx.gaps.length}, fact stop: ${factStopRaised}`,
        status: isOk ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0,
        reportId: await existingReportId(db, raw.notificationId),
        notificationId: raw.notificationId,
        stopType: primaryStopType(stops),
        stops: stops.map(toJudgeStop),
        details: {
            extractedMeasurement: parsedNumber,
            expectedMeasurement: expectedValue,
            normalizedMaterialId: ctx.product.materialId,
            reportedGapsCount: ctx.gaps.length,
            sampleGap: ctx.gaps[0] ?? null,
            precedentBasis: prec.basis,
        },
    };
}

/**
 * Executes TC-03: Confirmation Bias Hunter (Blind Diagnosis & Human-in-the-loop)
 */
async function runTC03(db: any): Promise<TestCaseResult> {
    const t0 = Date.now();
    const { raw, expected } = loadTestCase('tc-03-bias-hunter.json');
    const ctx = mapCase(raw);

    // Kết luận "ghi sai" lấy từ luật thật của app (`contradictingEvidence`, cũng
    // là thứ sinh ra lần dừng bên dưới) — không so chuỗi trong harness.
    const evidence = contradictingEvidence(ctx);
    const recorded = evidence?.flagged ?? null;
    const measuredCategory = evidence?.measured?.category ?? null;

    const prec = await realD4Precedents(ctx, raw);
    const stops = evaluateStops({ caseContext: ctx, precedents: { count: prec.count, reason: prec.reason, basis: prec.basis } });
    const contradictionStop = stops.some((s) => s.id === 'unverified-facts:record-contradicts-evidence:D4' && s.blocking);

    const biasDetected = recorded === expected.engineerClaim
        && measuredCategory === expected.aiDetermination
        && !evidence?.flaggedMetric;
    const isOk = expected.biasDetected === true && biasDetected && contradictionStop;

    return {
        id: 'TC-03',
        title: 'Pocket Depth Deviation (Confirmation Bias Hunter - Human-in-the-Loop)',
        category: 'Quadrant 3 - Decision Support & Blind Diagnosis',
        inputSummary: `Record blames "${recorded ?? '?'}"; ${measuredCategory ?? 'no other cause'} has a measured value (${evidence?.measured?.metric ?? 'none'})`,
        expectedBehavior: `Flag that the recorded cause (${expected.engineerClaim}) has no evidence while ${expected.aiDetermination} has a measured deviation, and stop D4 for the QE to decide`,
        actualBehavior: isOk
            ? `Stopped at D4: the record blames '${recorded}' with no metric, while '${measuredCategory}' shows ${evidence?.measured?.metric}. The QE must confirm or change the root cause; the AI does not overwrite it.`
            : `Bias check failed. Recorded: ${recorded ?? 'none'} (expected ${expected.engineerClaim}), evidence points to: ${measuredCategory ?? 'none'} (expected ${expected.aiDetermination}), contradiction stop: ${contradictionStop}`,
        status: isOk ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0,
        reportId: await existingReportId(db, raw.notificationId),
        notificationId: raw.notificationId,
        stopType: primaryStopType(stops),
        stops: stops.map(toJudgeStop),
        details: {
            recordedRootCause: recorded,
            recordedEvidence: evidence?.flaggedMetric ?? null,
            evidenceRootCause: measuredCategory,
            evidenceMetric: evidence?.measured?.metric ?? null,
            expected: { engineerClaim: expected.engineerClaim, aiDetermination: expected.aiDetermination },
        },
    };
}

/**
 * Executes TC-04: Graceful Refusal & Safe Escalation (Mandatory Rule)
 */
async function runTC04(db: any): Promise<TestCaseResult> {
    const t0 = Date.now();
    const { raw, expected } = loadTestCase('tc-04-graceful-refusal.json');
    const ctx = mapCase(raw);

    // Đúng nguồn mà app dùng để quyết định dừng "ngoài phạm vi" ở D4.
    const prec = await realD4Precedents(ctx, raw);
    const stops = evaluateStops({ caseContext: ctx, precedents: { count: prec.count, reason: prec.reason, basis: prec.basis } });
    const scopeStop = stops.find((s) => s.id === 'outside-scope:no-precedent:D4');

    // Câu hỏi chuyển cho người là câu hỏi của chính lần dừng "ngoài phạm vi" (và
    // các lần dừng khác nếu có) — không viết sẵn.
    const escalating = scopeStop ? [scopeStop, ...stops.filter((s) => s !== scopeStop && s.blocking)] : [];
    const questions = escalating.map((s) => s.questionForHuman);
    const refused = prec.count === 0;
    const isOk = expected.precedentFound === false && refused && Boolean(scopeStop) && questions.length > 0;

    return {
        id: 'TC-04',
        title: 'Wire Harness Crimp Defect (Safe Escalation & Precedent Refusal)',
        category: 'Quadrant 4 - Safe Refusal & Escalation (Mandatory Rule)',
        inputSummary: `${ctx.product.workCenterId}, ${ctx.product.materialId}, out-of-domain defect ${ctx.product.defectCode}: ${raw.symptomShortText}`,
        expectedBehavior: 'D4 precedent search returns nothing, so the AI stops (outside scope), cites no precedent, and hands concrete questions to a person',
        actualBehavior: isOk
            ? `Refused to cite a precedent: ${prec.basis}. Stopped at D4 and escalated with ${questions.length} question(s) for a person.`
            : refused
                ? (scopeStop ? 'Outside-scope stop raised, but it carries no question for a person.' : 'No precedent returned, but no outside-scope stop was raised.')
                : `Refusal failed: D4 precedent search returned ${prec.count} case(s) for an out-of-domain defect (${prec.top.map((p) => `${p.notificationId} ${p.explanation}`).join('; ')}), so the AI would cite them.`,
        status: isOk ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0,
        reportId: await existingReportId(db, raw.notificationId),
        notificationId: raw.notificationId,
        stopType: primaryStopType(stops),
        stops: stops.map(toJudgeStop),
        details: {
            precedentBasis: prec.basis,
            precedentsReturned: prec.top,
            escalationQuestions: questions,
            escalateTo: [...new Set(escalating.map((s) => s.requiredRole))],
        },
    };
}

const NON_MANUFACTURING = (raw: any) => Boolean(
    raw?.invoiceId ||
    raw?.amountVnd ||
    raw?.claimant ||
    (typeof raw?.department === 'string' && /finance|accounting|hr|payroll/i.test(raw.department))
);

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * Đánh giá một đầu vào giám khảo chưa từng thấy.
 *
 * Chỉ báo những gì đã thật sự kiểm: dữ kiện bóc từ chính đầu vào, số case trong
 * kho đã đếm, và các lần dừng theo `stops.ts`. KHÔNG tạo report — và nói thế.
 * Bản cũ in "similarity 88%/24%" gán cứng và "D1–D8 drafting completed" dù
 * không có gì được soạn.
 */
export async function evaluateJudgeInput(rawInput: unknown, db: any): Promise<JudgeEvaluation> {
    const t0 = Date.now();
    const timestamp = new Date().toISOString();
    const raw = rawInput as any;
    const emptyFacts = (documentType: string): JudgeEvaluation['facts'] => ({
        notificationId: str(raw?.notificationId) ?? str(raw?.invoiceId),
        documentType,
        symptom: str(raw?.symptomShortText) ?? str(raw?.description),
        materialId: str(raw?.material?.materialId) ?? str(raw?.materialId),
        workCenterId: str(raw?.workCenter?.workCenterId) ?? str(raw?.workCenterId),
        defectCode: str(raw?.defect?.defectCode),
        measurements: [],
        gaps: [],
    });
    const noPrecedentCheck = { performed: false, matchingCases: 0, basis: 'Not run — input was refused first.', sample: [] };
    const refuse = (stop: Stop, documentType: string, reason: string, blocking: string[] = []): JudgeEvaluation => ({
        decision: 'GRACEFULLY_REFUSED',
        reason,
        timestamp,
        durationMs: Date.now() - t0,
        primaryStopType: stop.type,
        stops: [toJudgeStop(stop)],
        facts: emptyFacts(documentType),
        validation: { blocking, warnings: 0 },
        precedentCheck: noPrecedentCheck,
        nextStep: { title: 'Refused', summary: reason, questions: [stop.questionForHuman], roles: [stop.requiredRole] },
    });

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return refuse(incompleteInputStop(['a JSON object']), 'Not a JSON object', 'The input is not a JSON object, so there is no defect to evaluate.');
    }

    if (NON_MANUFACTURING(raw)) {
        const reason = `This looks like a ${raw.invoiceId || raw.amountVnd ? 'finance / reimbursement' : 'non-manufacturing'} document, not a quality notification. It is not an 8D case, so it was refused.`;
        return refuse(notManufacturingStop(reason), 'Non-manufacturing document', reason);
    }

    const val = validateDataset(raw);
    const blocking = blockingIssues(val);
    const missingCore = !raw.notificationId && !raw.symptomShortText && !raw.defect;
    if (blocking.length > 0 || missingCore) {
        const missing = blocking.length > 0 ? blocking.map((b) => b.message) : ['notificationId', 'symptomShortText or defect'];
        return refuse(
            incompleteInputStop(missing),
            'Incomplete quality notification',
            `The defect cannot be identified: ${missing.join('; ')}.`,
            blocking.map((b) => b.message),
        );
    }

    try {
        const ctx = mapCase(raw);
        const wc = str(ctx.product.workCenterId);
        const code = str(ctx.product.defectCode);
        // Cùng engine tiền lệ mà app dùng cho D4 - không phải một câu lọc riêng.
        const prec = await realD4Precedents(ctx, raw);
        const matching = prec.ids.map((notificationId) => ({ notificationId }));
        const basis = prec.basis;

        const stops = evaluateStops({
            caseContext: ctx,
            precedents: { count: prec.count, reason: prec.reason, basis },
        });
        const primary = primaryStopType(stops);
        const needsPerson = stops.filter((s) => s.type !== 'exceeds-authority');
        const signOffs = stops.filter((s) => s.type === 'exceeds-authority');

        const measurements = (ctx.inspections || []).map((i) => ({
            characteristic: i.characteristic || 'Inspection',
            measured: String(i.measuredValue ?? ''),
            spec: String(i.specValue ?? ''),
        }));

        const decision = needsPerson.length > 0 ? 'ESCALATED' as const : 'HANDLED_APPROPRIATELY' as const;
        const reason = decision === 'ESCALATED'
            ? `Valid manufacturing defect, but the AI stopped: ${needsPerson.map((s) => s.reason).join(' ')}`
            : `Valid manufacturing defect with ${measurements.length} measurement(s) and ${matching.length} matching closed case(s) (${basis}). The AI can proceed`
                + (signOffs.length
                    ? `; closing the case will need sign-off: ${signOffs.map((s) => `${s.requiredRole} (${s.reason})`).join(' ')}`
                    : ' — no stop raised.');

        return {
            decision,
            reason,
            timestamp,
            durationMs: Date.now() - t0,
            primaryStopType: primary,
            stops: stops.map(toJudgeStop),
            facts: {
                notificationId: str(ctx.notificationId),
                documentType: 'Quality notification',
                symptom: str(ctx.header.symptomShortText),
                materialId: str(ctx.product.materialId),
                workCenterId: wc,
                defectCode: code,
                measurements,
                gaps: ctx.gaps || [],
            },
            validation: { blocking: [], warnings: val.length },
            precedentCheck: {
                performed: true,
                matchingCases: matching.length,
                basis,
                sample: matching.slice(0, 3).map((m) => String(m.notificationId)),
            },
            nextStep: decision === 'ESCALATED'
                ? {
                    title: 'Stopped — a person has to answer first',
                    summary: 'The AI will not draft a root cause on this input until the questions below are answered.',
                    questions: needsPerson.map((s) => s.questionForHuman),
                    roles: [...new Set(needsPerson.map((s) => s.requiredRole))],
                }
                : {
                    title: 'Ready to open an 8D draft',
                    summary: 'This sandbox only evaluates the input — it does not create a report. Opening an 8D runs the AI drafting, and every discipline still needs a human approval.'
                        + (signOffs.length ? ` Closing it will also need: ${signOffs.map((s) => s.requiredRole).join(', ')}.` : ''),
                    questions: signOffs.map((s) => s.questionForHuman),
                    roles: [...new Set(signOffs.map((s) => s.requiredRole))],
                },
        };
    } catch (e: any) {
        const reason = `The input could not be processed (${e?.message ?? 'unknown error'}), so it was refused rather than guessed at.`;
        return refuse(incompleteInputStop(['a parseable quality notification']), 'Unprocessable input', reason);
    }
}

/**
 * Main Runner Function
 */
export async function runVerifyHarness(customJudgeInputFile?: string): Promise<VerifyHarnessReport> {
    const startAll = Date.now();
    const executedAt = new Date().toISOString();

    const db = await initDatabaseConnection();

    // Run all 4 test cases sequentially with transparent time measurement
    const r1 = await runTC01(db);
    const r2 = await runTC02(db);
    const r3 = await runTC03(db);
    const r4 = await runTC04(db);

    const results = [r1, r2, r3, r4];
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const total = results.length;
    const totalDurationMs = Date.now() - startAll;

    let judgeEval: VerifyHarnessReport['judgeInputEvaluation'];
    if (customJudgeInputFile && fs.existsSync(customJudgeInputFile)) {
        const customRaw = JSON.parse(fs.readFileSync(customJudgeInputFile, 'utf8'));
        const evalRes = await evaluateJudgeInput(customRaw, db);
        judgeEval = {
            tested: true,
            fileName: path.basename(customJudgeInputFile),
            decision: evalRes.decision,
            reason: evalRes.reason,
            stopType: evalRes.primaryStopType,
        };
    }

    const report: VerifyHarnessReport = {
        suite: 'MLAI Hackathon 2026 — Sprint 1 Verify Suite',
        track: 'Track 1: OrganizationAI',
        challenge: 'Challenge B: The Whole Workflow (8D Copilot)',
        executedAt,
        totalDurationMs,
        targetDurationLimitMs: 90000, // 90 seconds limit per BTC rules
        passed,
        failed,
        total,
        verdict: (passed === 4 && totalDurationMs <= 90000) ? 'PASS' : 'FAIL',
        results,
        judgeInputEvaluation: judgeEval
    };

    // Save report artifact
    const reportPath = path.resolve(__dirname, '../docs/sprint1-verify-report.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

    return report;
}

// ── CLI Output Formatter ──────────────────────────────────────────────────────
async function main() {
    const isJsonOutput = process.argv.includes('--json');
    const judgeInputIdx = process.argv.indexOf('--judge-input');
    const judgeInputFile = judgeInputIdx >= 0 ? process.argv[judgeInputIdx + 1] : undefined;

    const report = await runVerifyHarness(judgeInputFile);

    if (isJsonOutput) {
        console.log(JSON.stringify(report, null, 2));
        return;
    }

    const bar = '═'.repeat(88);
    const line = '─'.repeat(88);

    console.log(`\n${bar}`);
    console.log(` 🏆 MLAI HACKATHON 2026 — SPRINT 1 AUTOMATED VERIFY HARNESS (90-SECOND CHECK)`);
    console.log(` Track: OrganizationAI | Challenge B: The Whole Workflow | Database: ${String((cds.env.requires as any)?.db?.kind ?? 'unknown')}`);
    console.log(` Timestamp: ${report.executedAt} | Duration: ${(report.totalDurationMs / 1000).toFixed(2)}s / Limit: 90s`);
    console.log(`${bar}\n`);

    console.log(`┌───────┬───────────────────────────────────────────────────┬───────────────────┬──────────┬──────────┐`);
    console.log(`│ ID    │ Test Case                                         │ Stop              │ Duration │ Status   │`);
    console.log(`├───────┼───────────────────────────────────────────────────┼───────────────────┼──────────┼──────────┤`);

    for (const r of report.results) {
        const idStr = r.id.padEnd(5);
        const titleStr = (r.title.length > 49 ? r.title.slice(0, 46) + '...' : r.title).padEnd(49);
        const stopStr = (r.stopType ?? '—').padEnd(17);
        const durStr = `${r.durationMs}ms`.padStart(8);
        const statusStr = r.status === 'PASS' ? ' \x1b[32mPASS\x1b[0m   ' : ' \x1b[31mFAIL\x1b[0m   ';
        console.log(`│ ${idStr} │ ${titleStr} │ ${stopStr} │ ${durStr} │ ${statusStr} │`);
    }

    console.log(`└───────┴───────────────────────────────────────────────────┴───────────────────┴──────────┴──────────┘`);

    console.log(`\n${line}`);
    console.log(` DETAILED TEST EXECUTION SUMMARY:`);
    console.log(`${line}`);

    for (const r of report.results) {
        console.log(`\n▶ [${r.id}] ${r.title}`);
        console.log(`  • Category: ${r.category}`);
        console.log(`  • Input   : ${r.inputSummary}`);
        console.log(`  • Expected: ${r.expectedBehavior}`);
        console.log(`  • Outcome : ${r.actualBehavior}`);
        for (const st of r.stops) {
            console.log(`  • Stop    : [${st.type}] ${st.step} — ${st.reason}`);
        }
    }

    if (report.judgeInputEvaluation?.tested) {
        console.log(`\n${line}`);
        console.log(` JUDGE INPUT EVALUATION:`);
        console.log(`${line}`);
        console.log(`  • Input File : ${report.judgeInputEvaluation.fileName}`);
        console.log(`  • Decision   : ${report.judgeInputEvaluation.decision}`);
        console.log(`  • Stop type  : ${report.judgeInputEvaluation.stopType ?? '—'}`);
        console.log(`  • Evaluation : ${report.judgeInputEvaluation.reason}`);
    }

    console.log(`\n${bar}`);
    if (report.verdict === 'PASS') {
        console.log(` ✅ FINAL VERDICT: ${report.passed}/${report.total} PASSED in ${(report.totalDurationMs / 1000).toFixed(2)}s (limit 90s).`);
        console.log(` Report written to: docs/sprint1-verify-report.json`);
    } else {
        console.log(` ❌ FINAL VERDICT: FAILED (${report.passed}/4 Passed). Review logs above.`);
    }
    console.log(`${bar}\n`);
    process.exit(report.verdict === 'PASS' ? 0 : 1);
}

if (require.main === module) {
    main().catch(err => {
        console.error('Fatal harness error:', err);
        process.exit(1);
    });
}
