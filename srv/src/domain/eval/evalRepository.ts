/**
 * Lưu lượt đánh giá và điểm từng pha.
 *
 * ── Vì sao phải LƯU chứ không chỉ in ra ──
 * Cả tính năng này tồn tại để trả lời "pipeline tốt lên hay xấu đi", và câu đó
 * chỉ trả lời được bằng cách SO hai lượt chạy. Một script in ra màn hình không
 * so được gì — nó chỉ đổi một checklist chạy tay thành một bảng chạy tay.
 *
 * ── Vì sao `configSnapshot` được ghi ngay lúc mở lượt chạy ──
 * Ghi lúc kết thúc thì nó chụp cấu hình SAU khi ai đó có thể đã sửa giữa lúc
 * chạy. Ảnh chụp phải là cấu hình mà điểm này thật sự phản ánh.
 */

import cds from '@sap/cds';
import { EVAL_PHASES } from './rubrics';
import type { JudgeResult } from './judge';
import type { ComplianceReport } from './compliance';

const LOG = cds.log('eval');

export const EVAL_RUNS = 'cnma.proresolve.EvalRuns';
export const EVAL_SCORES = 'cnma.proresolve.EvalScores';

export type EvalMode = 'analyze' | 'grade-only' | 'online';

/**
 * Ảnh chụp cấu hình — đủ để nói hai lượt chạy khác nhau ở đâu.
 *
 * Cố ý KHÔNG chụp toàn bộ prompt: chúng dài, và `version` của `StepPrompts` đã
 * đủ để nhận ra một bản khác. Chụp cả nội dung thì mỗi lượt chạy phình lên vài
 * chục KB mà không nói thêm điều gì.
 */
export interface ConfigSnapshot {
    stepPromptVersions: Record<string, number>;
    retrievalEngine: string;
    judgeActivity: string;
    takenAt: string;
}

export async function snapshotConfig(judgeActivity: string): Promise<ConfigSnapshot> {
    const db = await cds.connect.to('db');

    const stepPromptVersions: Record<string, number> = {};
    let retrievalEngine = 'unknown';

    try {
        const rows = (await db.run(
            SELECT.from('cnma.proresolve.StepPrompts').columns('stepCode', 'version'),
        )) as Array<{ stepCode: string; version: number }>;
        for (const r of rows) stepPromptVersions[String(r.stepCode)] = Number(r.version) || 0;
    } catch (e: any) {
        LOG.warn(`Không đọc được version prompt cho ảnh chụp: ${e.message}`);
    }

    try {
        const rows = (await db.run(
            SELECT.one.from('cnma.proresolve.GraphRetrievalSettings').columns('engine'),
        )) as { engine?: string } | null;
        retrievalEngine = String(rows?.engine ?? 'scoring');
    } catch {
        // Bảng chưa deploy ⇒ engine chấm điểm. Không đáng làm hỏng lượt chạy.
        retrievalEngine = 'scoring';
    }

    // Thời điểm chụp truyền vào từ ngoài khi có; ở đây dùng giờ hệ thống vì đó
    // chính là lúc lượt chạy bắt đầu.
    return {
        stepPromptVersions,
        retrievalEngine,
        judgeActivity,
        takenAt: new Date().toISOString(),
    };
}

/** Mở một lượt chạy ở trạng thái `Running`. Trả về ID để ghi điểm vào. */
export async function openRun(opts: {
    label: string;
    mode: EvalMode;
    datasetFilter?: string | null;
    caseCount: number;
    snapshot: ConfigSnapshot;
}): Promise<string> {
    const db = await cds.connect.to('db');
    const ID = cds.utils.uuid();

    await db.run(INSERT.into(EVAL_RUNS).entries({
        ID,
        label: opts.label,
        mode: opts.mode,
        datasetFilter: opts.datasetFilter ?? null,
        status: 'Running',
        caseCount: opts.caseCount,
        processedCount: 0,
        configSnapshot: JSON.stringify(opts.snapshot, null, 2),
    }));

    LOG.info(`Mở lượt đánh giá ${ID} — ${opts.mode}, ${opts.caseCount} case.`);
    return ID;
}

/**
 * Ghi điểm ba pha của một case, rồi tăng `processedCount`.
 *
 * Tăng đếm ngay sau khi ghi chứ không dồn tới cuối: một lượt chạy dài mà đếm
 * không nhích thì không phân biệt được với một lượt chạy đã treo.
 */
export async function saveCaseScores(
    runId: string | null,
    judged: JudgeResult,
    compliance: ComplianceReport,
    reportId?: string | null,
): Promise<void> {
    const db = await cds.connect.to('db');
    const errorByPhase = new Map(judged.errors.map((e) => [e.phase, e.message]));

    await db.run(INSERT.into(EVAL_SCORES).entries(
        judged.byPhase.map((p) => ({
            ID: cds.utils.uuid(),
            run_ID: runId,
            report_ID: reportId ?? null,
            notificationId: judged.notificationId,
            phase: p.phase,
            qualityScore: p.score,
            maxScore: p.maxScore,
            breakdownJson: JSON.stringify(p.breakdown),
            // Tầng 1 gắn vào cả ba dòng: nó thuộc về case, không thuộc về pha.
            // Tách được theo pha thì tốt hơn, nhưng bịa ra một phép chia không có
            // thật thì tệ hơn là lặp lại con số đúng.
            violationCount: compliance.violationCount,
            repairCount: compliance.repairCount,
            abstainCount: p.abstainCount,
            judgeError: errorByPhase.get(p.phase) ?? null,
        })),
    ));

    if (runId) {
        await db.run(
            `UPDATE "CNMA_PRORESOLVE_EVALRUNS" SET "PROCESSEDCOUNT" = "PROCESSEDCOUNT" + 1 WHERE "ID" = ?`,
            [runId],
        );
    }
}

/**
 * Đóng lượt chạy với ba con số — giữ riêng, không trộn.
 *
 * `agreementRate` nhận null khi lượt chạy không có đáp án để so: bịa ra một con
 * số 0 ở đó sẽ trông như "AI sai hết" trong khi thật ra là "không đo được".
 */
export async function closeRun(runId: string, totals: {
    complianceScore: number | null;
    qualityScore: number | null;
    agreementRate: number | null;
    durationMs: number;
    errorMessage?: string | null;
}): Promise<void> {
    const db = await cds.connect.to('db');
    await db.run(UPDATE(EVAL_RUNS).set({
        status: totals.errorMessage ? 'Failed' : 'Completed',
        complianceScore: totals.complianceScore,
        qualityScore: totals.qualityScore,
        agreementRate: totals.agreementRate,
        durationMs: totals.durationMs,
        errorMessage: totals.errorMessage ?? null,
    }).where({ ID: runId }));

    LOG.info(
        `Đóng lượt ${runId}: compliance ${fmt(totals.complianceScore)} · `
        + `quality ${fmt(totals.qualityScore)} · agreement ${fmt(totals.agreementRate)}`,
    );
}

function fmt(n: number | null): string {
    return n === null ? 'không đo được' : `${Math.round(n * 100)}%`;
}

/**
 * Trung bình một danh sách tỉ lệ, BỎ QUA các giá trị không đo được.
 *
 * Coi null là 0 sẽ kéo trung bình xuống vì những case không chấm được — đúng thứ
 * làm hai lượt chạy không còn so được với nhau.
 */
export function averageRatio(values: readonly (number | null)[]): number | null {
    const usable = values.filter((v): v is number => v !== null);
    if (!usable.length) return null;
    return Math.round((usable.reduce((a, b) => a + b, 0) / usable.length) * 100) / 100;
}

/** Số pha đúng bằng số dòng `EvalScores` mỗi case — để kiểm sau khi ghi. */
export const PHASES_PER_CASE = EVAL_PHASES.length;
