/**
 * Handler cho EightDService.
 *
 * Tầng này mỏng có chủ đích: nó chỉ nối HTTP với domain, quản lý vòng đời bản
 * ghi, và ánh xạ lỗi. Mọi suy luận nằm ở `srv/src/domain/eightd/`.
 *
 * ── Vì sao chạy BẤT ĐỒNG BỘ ──
 * Bản đầu chạy đồng bộ: action chờ AI xong rồi mới trả về. Nó chết vì hai lý do,
 * lý do thứ hai mới là lý do thật:
 *
 *   1. Request 60-75 giây vượt timeout mặc định của gần như mọi HTTP client.
 *
 *   2. Nghiêm trọng hơn: driver SQLite của CAP chỉ có MỘT connection cho mỗi
 *      tenant. Transaction chiếm nó ở `begin()` và giữ đến `commit()`. Chạy AI
 *      bên trong một transaction đang mở nghĩa là khoá toàn bộ DB của ứng dụng
 *      suốt 60 giây — kể cả request polling để xem tiến độ cũng bị chặn. Không
 *      có cách nào bọc pipeline dài trong transaction mà vẫn giữ app phản hồi.
 *
 * Nên: handler tạo bản ghi rồi trả về ngay, còn pipeline chạy ở nền bằng
 * `cds.spawn`. Client theo dõi qua trường `status` của Reports.
 *
 * ── Vì sao hâm nóng cache cấu hình AI trước khi spawn ──
 * `llmClient` đọc cấu hình model chung từ DB ở mỗi lời gọi. Nếu lần đọc đó rơi
 * vào giữa job nền, nó sẽ mở transaction của job và giữ connection cho tới khi
 * job kết thúc — đúng cái vấn đề vừa nói. Đọc trước ở đây, trong transaction
 * ngắn của request, thì suốt job nền mọi lời gọi đều trúng cache và KHÔNG chạm
 * DB. Xem `CACHE_TTL_MS` trong `core/ai/globalModelConfig.ts`.
 */

import cds from '@sap/cds';
import { analyze, analyzeDownstreamReport } from '../domain/eightd/eightDAnalyzer';
import { mapCase } from '../domain/eightd/caseMapper';
import { blockingIssues, validateDataset } from '../domain/eightd/datasetValidator';
import { getGlobalModelConfig } from '../core/ai/globalModelConfig';
import {
    confirmDisciplineField,
    createReport,
    findTaskInResultJson,
    getClosureGate,
    getReportForRerun,
    getReviewTrail,
    isoDateOrNull,
    listTaskEvidence,
    markAnalyzing,
    markFailed,
    markTaskStatusInResultJson,
    reviewDiscipline,
    saveAssignedTeam,
    saveDisciplineFieldValue,
    saveDownstreamResult,
    savePartialDiscipline,
    saveReportContext,
    saveResult,
    setCaseCommitments,
    setDisciplineWorkState,
    sweepStuckAnalyzing,
    type AssignedTeamRow,
} from '../domain/eightd/eightDRepository';
import {
    isReviewDecision,
    statusForDecision,
    REVIEW_DECISIONS,
} from '../domain/eightd/review';
import { DISCIPLINE_CODES, STEP_CODES, PipelineError, type CaseContext, type DisciplineCode } from '../domain/eightd/types';
import { findPrecedentsByStep } from '../domain/eightd/precedent/findPrecedents';
import { clearLibrary, embedLibrary, seedLibrary } from '../domain/eightd/precedent/librarySeeder';
import { tokenizeDefectText } from '../domain/eightd/precedent/scoring';
import { allocateNumber, numericPart, raiseNumberRange, peekNextNumber } from '../domain/numberRange';
import { buildDefectPayload } from '../domain/defectPayload';

const LOG = cds.log('eightd-service');

/** Gộp thông báo lỗi cùng phần chi tiết thành một dòng người đọc hiểu được. */
function describe(e: any): string {
    const base = e?.message ?? String(e);
    if (e instanceof PipelineError && Array.isArray(e.details)) {
        return `${base} ${e.details.join(' ')}`;
    }
    if (e?.response?.data) {
        return `${base} — Details: ${JSON.stringify(e.response.data)}`;
    }
    if (e?.cause) {
        return `${base} — Cause: ${e.cause.message ?? e.cause}`;
    }
    return base;
}

/**
 * Payload có phải dạng PHẲNG một case không — dạng mà form ghi nhận lỗi gửi lên.
 *
 * Dùng để quyết định có được cấp số cho nó hay không. Hai dạng export cũ đều gom
 * nhiều bảng lại và khoá chúng theo `notification_id`; ở đó số không phải một
 * trường mà là một khoá ngoại rải khắp payload, nên nó nằm ngoài phạm vi.
 */
function isFlatCasePayload(raw: any): boolean {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
    if (raw.nested_case_view || raw.data?.notifications || raw.notifications) return false;
    return true;
}

/**
 * Chạy pipeline ở nền rồi ghi kết quả.
 *
 * `cds.spawn` cấp cho job một transaction tách rời, chạy sau khi handler đã trả
 * về. Nhờ vậy transaction của request đóng lại và nhả connection SQLite trước
 * khi lời gọi AI bắt đầu.
 *
 * Không ném lỗi ra ngoài: không còn ai đứng đó mà nhận. Lỗi được ghi vào bản ghi
 * để người dùng đọc được ở UI.
 */
function runInBackground(reportID: string, payload: string): void {
    // Tham số đầu là options của job nền; `{}` nghĩa là chạy một lần, ngay lập
    // tức. `cds.spawn` dựng một root transaction tách rời cho mỗi lượt chạy.
    cds.spawn({}, async () => {
        try {
            let savedContext = false;
            let dbQueue = Promise.resolve();

            const outcome = await analyze(payload, async (stepOutcome) => {
                await (dbQueue = dbQueue.then(async () => {
                    if (!savedContext) {
                        await saveReportContext(
                            reportID,
                            stepOutcome.context,
                            stepOutcome.independent,
                            stepOutcome.precedents,
                        );
                        savedContext = true;
                    }
                    await savePartialDiscipline(reportID, {
                        discipline: stepOutcome.discipline,
                        runtime: stepOutcome.runtimeInfo,
                    });
                    LOG.info(`Report ${reportID}: step ${stepOutcome.discipline.code} đã commit.`);
                }).catch((err) => {
                    LOG.error(`Report ${reportID}: lỗi lưu partial discipline ${stepOutcome.discipline.code}:`, err);
                }));
            });

            await dbQueue;
            await saveResult(reportID, outcome);

            LOG.info(
                `Report ${reportID} xong trong ${(outcome.durationMs / 1000).toFixed(1)}s, ` +
                `${outcome.tokensUsed} token` +
                (outcome.repairs.length ? `, postProcess chữa ${outcome.repairs.length} chỗ` : ''),
            );
        } catch (e: any) {
            LOG.error(`Report ${reportID} thất bại:`);
            LOG.error(e?.response?.data ?? e);
            try {
                await markFailed(reportID, describe(e));
            } catch (writeErr: any) {
                // Ghi lỗi mà cũng hỏng thì bản ghi kẹt ở `Analyzing`. Lần khởi
                // động sau `sweepStuckAnalyzing` sẽ dọn.
                LOG.error(`Không ghi được trạng thái Failed cho ${reportID}:`, writeErr?.message);
            }
        }
    });
}

/**
 * Chạy lại các bước downstream ở nền bằng AI rồi ghi kết quả.
 */
function runDownstreamInBackground(
    reportID: string,
    payload: string,
    existingDisciplines: any[],
    fromStep: string = 'D5',
): void {
    cds.spawn({}, async () => {
        try {
            const fromCode = (DISCIPLINE_CODES.includes(fromStep as DisciplineCode) ? fromStep : 'D5') as DisciplineCode;
            const fromIndex = STEP_CODES.indexOf(fromCode);
            const downstreamCodes = STEP_CODES.slice(fromIndex);
            let dbQueue = Promise.resolve();

            const outcome = await analyzeDownstreamReport(
                JSON.parse(payload),
                existingDisciplines,
                fromCode,
                async (stepOutcome) => {
                    await (dbQueue = dbQueue.then(async () => {
                        await savePartialDiscipline(reportID, {
                            discipline: stepOutcome.discipline,
                            runtime: stepOutcome.runtimeInfo,
                        });
                        LOG.info(`Report ${reportID}: downstream step ${stepOutcome.discipline.code} đã commit.`);
                    }).catch((err) => {
                        LOG.error(`Report ${reportID}: lỗi lưu downstream step ${stepOutcome.discipline.code}:`, err);
                    }));
                },
            );

            await dbQueue;
            await saveDownstreamResult(reportID, outcome, downstreamCodes);
            LOG.info(
                `Report ${reportID} downstream (từ ${fromStep}) xong trong ${(outcome.durationMs / 1000).toFixed(1)}s, ` +
                `${outcome.tokensUsed} token` +
                (outcome.repairs.length ? `, postProcess chữa ${outcome.repairs.length} chỗ` : ''),
            );
        } catch (e: any) {
            LOG.error(`Report ${reportID} reanalyzeDownstream thất bại:`, e);
            try {
                await markFailed(reportID, describe(e));
            } catch (writeErr: any) {
                LOG.error(`Không ghi được trạng thái Failed cho ${reportID}:`, writeErr?.message);
            }
        }
    });
}

export function registerEightDHandlers(srv: any): void {

    // ── analyzeFromJson ──────────────────────────────────────────────────────
    srv.on('analyzeFromJson', async (req: any) => {
        const { payload, title } = req.data ?? {};

        if (typeof payload !== 'string' || !payload.trim()) {
            return req.error(400, 'payload is required and must be a JSON string.');
        }

        // Validate và map TRƯỚC khi tạo bản ghi: payload rác thì đừng để lại một
        // hàng Failed rỗng không nói lên điều gì.
        let context;
        let effectivePayload = payload;
        try {
            const raw = JSON.parse(payload);

            // Cấp số cho case nhập tay. Form không còn tự bịa `8D-` + 8 chữ số
            // ngẫu nhiên nữa: dải số đó chính là dải của kho case thật, nên một
            // lần trùng là hai case khác nhau mang cùng một mã trong sổ.
            //
            // Chỉ động vào dạng payload PHẲNG — đúng dạng form của mình gửi. Các
            // dạng export cũ (`data.notifications`, `nested_case_view`) khoá các
            // bảng con theo `notification_id`; dán một số mới vào đó sẽ phải sửa
            // mọi dòng con cho khớp, và những payload ấy vốn luôn mang số của
            // SAP. Không có số ở đó là chuyện của validator, không phải của
            // dải số.
            if (isFlatCasePayload(raw) && !String(raw.notificationId ?? raw.notification_id ?? '').trim()) {
                try {
                    raw.notificationId = await allocateNumber(cds.tx(req) as any, 'DEFECT', async (code) => {
                        const hit = await (cds.tx(req) as any).run(
                            SELECT.one.from('cnma.proresolve.Reports').columns('ID').where({ notificationId: code }),
                        );
                        return !!hit;
                    });
                    effectivePayload = JSON.stringify(raw);
                } catch (e: any) {
                    return req.error(500, `Could not assign a notification number: ${describe(e)}`);
                }
            }

            // Chỉ chặn khi payload KHÔNG PHẢI một case. Vấn đề chất lượng —
            // thiếu nhánh Ishikawa, 5-Why cụt, action chưa phân loại — được đưa
            // vào ngữ cảnh cho model chứ không từ chối phân tích. Từ chối những
            // case đó là từ chối đúng những case cần giúp nhất.
            const blocking = blockingIssues(validateDataset(raw));
            if (blocking.length) {
                return req.error(
                    400,
                    `Payload cannot be used: ` +
                    blocking.map((i) => `[${i.constraintId}] ${i.message}`).join(' '),
                );
            }

            context = mapCase(raw);
        } catch (e: any) {
            const code = e instanceof PipelineError ? e.code : 400;
            return req.error(code, describe(e));
        }

        const reportID = await createReport(effectivePayload, context, title);

        // Nạp cấu hình model vào cache trong transaction ngắn của request, để
        // job nền không phải chạm DB giữa chừng.
        await getGlobalModelConfig();

        runInBackground(reportID, effectivePayload);

        LOG.info(`Report ${reportID} (case ${context.notificationId}) đã xếp lịch phân tích`);
        return reportID;
    });

    // ── startEightD ──────────────────────────────────────────────────────────
    //
    // Mở 8D TỪ một lỗi đã ghi nhận. Khác `analyzeFromJson` ở chỗ payload không do
    // trình duyệt gửi lên mà được dựng lại ở đây từ bảng `Defects` — xem
    // `buildDefectPayload` để biết vì sao chỗ dựng payload phải nằm ở server.
    //
    // Ba việc dưới đây phải xảy ra CÙNG NHAU, và đó là lý do nó là một action chứ
    // không phải vài lời gọi OData nối tiếp từ trình duyệt:
    //   1. Chỉ được một 8D cho mỗi lỗi (SAP: "only possible to create one Problem
    //      Solution Process per Defect"). Kiểm ở client thì hai tab mở song song
    //      lọt cả hai.
    //   2. `Reports.notificationId` phải thừa hưởng `Defects.defectId` — cùng một
    //      con số, không phải hai.
    //   3. Lỗi lật sang `In Process` ngay khi 8D mở ra.
    srv.on('startEightD', async (req: any) => {
        const defectID = String(req.data?.defectID ?? '').trim();
        const title = req.data?.title;
        if (!defectID) return req.error(400, 'defectID is required.');

        // Hạn cam kết: từ chối ngay thay vì lặng lẽ bỏ qua. `isoDateOrNull` trả
        // null cho cả "không gửi" lẫn "gửi chuỗi rác", nên phân biệt hai trường
        // hợp đó ở đây — người gõ nhầm ngày phải biết là ngày của mình bị bỏ.
        const rawDueDate = String(req.data?.dueDate ?? '').trim();
        const dueDate = isoDateOrNull(rawDueDate);
        if (rawDueDate && !dueDate) {
            return req.error(400, `dueDate '${rawDueDate}' is not a valid ISO date (YYYY-MM-DD).`);
        }
        const coordinator = String(req.data?.coordinator ?? '').trim() || null;

        const tx: any = cds.tx(req);

        // Nhận cả UUID kỹ thuật lẫn số lỗi: danh sách ở UI hiển thị số, còn
        // bảng OData trả về ID. Bắt người gọi phải biết dùng cái nào là mời một
        // lớp ánh xạ vô ích vào giữa.
        const defect = await tx.run(
            SELECT.one.from('cnma.proresolve.Defects').where(
                defectID.includes('-') && defectID.length === 36
                    ? { ID: defectID }
                    : { defectId: defectID },
            ),
        );
        if (!defect) return req.error(404, `Defect ${defectID} not found.`);

        if (defect.status === 'Completed') {
            return req.error(409, `Defect ${defect.defectId} is already completed.`);
        }

        // Chốt luật một-8D-mỗi-lỗi ở tầng dữ liệu. `@assert.unique` trên
        // `sourceDefectId` là lưới cuối; kiểm ở đây chỉ để trả về câu 409 đọc
        // được thay vì một lỗi ràng buộc của database.
        const existing = await tx.run(
            SELECT.one.from('cnma.proresolve.Reports')
                .columns('ID')
                .where({ sourceDefectId: defect.defectId }),
        );
        if (existing) {
            return req.error(409, `Defect ${defect.defectId} already has an 8D report.`);
        }

        const characteristics = await tx.run(
            SELECT.from('cnma.proresolve.DefectCharacteristics')
                .where({ defect_ID: defect.ID })
                .orderBy('lineNo'),
        );

        let context: CaseContext;
        let payload: string;
        try {
            const raw = buildDefectPayload(defect, characteristics ?? []);
            payload = JSON.stringify(raw);

            const blocking = blockingIssues(validateDataset(raw));
            if (blocking.length) {
                return req.error(
                    400,
                    `Defect ${defect.defectId} cannot start an 8D: ` +
                    blocking.map((i) => `[${i.constraintId}] ${i.message}`).join(' '),
                );
            }

            context = mapCase(raw);
        } catch (e: any) {
            return req.error(e instanceof PipelineError ? e.code : 400, describe(e));
        }

        const reportID = await createReport(payload, context, title, defect.defectId, {
            slaResponseDue: dueDate,
            coordinator,
        });

        // Lỗi đã có người xử lý — lật trạng thái trong CÙNG transaction với lệnh
        // tạo báo cáo, để không bao giờ tồn tại một 8D treo trên một lỗi vẫn còn
        // `Open`.
        await tx.run(
            UPDATE('cnma.proresolve.Defects').set({ status: 'In Process' }).where({ ID: defect.ID }),
        );

        await getGlobalModelConfig();
        runInBackground(reportID, payload);

        LOG.info(`Report ${reportID} mở từ lỗi ${defect.defectId}, đã xếp lịch phân tích`);
        return reportID;
    });

    // ── setCaseCommitments ───────────────────────────────────────────────────
    //
    // Sửa hạn và điều phối viên sau khi case đã mở. Chuỗi rỗng = xoá; xem lý do ở
    // khai báo action trong `EightDService.cds`.
    srv.on('setCaseCommitments', async (req: any) => {
        const reportID = String(req.data?.reportID ?? '').trim();
        if (!reportID) return req.error(400, 'reportID is required.');

        const rawDueDate = String(req.data?.dueDate ?? '').trim();
        const dueDate = isoDateOrNull(rawDueDate);
        if (rawDueDate && !dueDate) {
            return req.error(400, `dueDate '${rawDueDate}' is not a valid ISO date (YYYY-MM-DD).`);
        }

        const ok = await setCaseCommitments(reportID, {
            slaResponseDue: dueDate,
            coordinator: String(req.data?.coordinator ?? '').trim() || null,
        });
        if (!ok) return req.error(404, `Report ${reportID} not found.`);

        return reportID;
    });

    // ── reanalyze ────────────────────────────────────────────────────────────
    srv.on('reanalyze', async (req: any) => {
        const reportID = req.data?.reportID;
        if (typeof reportID !== 'string' || !reportID.trim()) {
            return req.error(400, 'reportID is required.');
        }

        const row = await getReportForRerun(reportID);
        if (!row) return req.error(404, `Report ${reportID} not found.`);
        if (!row.sourcePayload) {
            return req.error(422, `Report ${reportID} has no sourcePayload to re-run.`);
        }
        if (row.status === 'Analyzing') {
            return req.error(409, `Report ${reportID} is already running.`);
        }

        await markAnalyzing(reportID);
        await getGlobalModelConfig();

        // `saveResult` xoá disciplines cũ rồi mới ghi bộ mới. Không merge: trộn
        // hai lần chạy khác model cho ra báo cáo không nhất quán mà chẳng ai truy
        // được phần nào từ đâu.
        runInBackground(reportID, row.sourcePayload);

        LOG.info(`Report ${reportID} (case ${row.notificationId}) đã xếp lịch chạy lại`);
        return reportID;
    });

    // ── reanalyzeDownstream ───────────────────────────────────────────────────
    srv.on('reanalyzeDownstream', async (req: any) => {
        const { reportID, fromStep = 'D5' } = req.data ?? {};
        if (typeof reportID !== 'string' || !reportID.trim()) {
            return req.error(400, 'reportID is required.');
        }

        const row = await getReportForRerun(reportID);
        if (!row) return req.error(404, `Report ${reportID} not found.`);
        if (!row.sourcePayload) {
            return req.error(422, `Report ${reportID} has no sourcePayload to re-run.`);
        }
        const db = await cds.connect.to('db');
        const existingDisciplines = await db.run(
            SELECT.from('cnma.proresolve.Disciplines').where({ report_ID: reportID }),
        );

        const fromCode = (DISCIPLINE_CODES.includes(fromStep as DisciplineCode) ? fromStep : 'D5') as DisciplineCode;
        const fromIndex = STEP_CODES.indexOf(fromCode);
        const downstreamCodes = STEP_CODES.slice(fromIndex);

        // Xoá các bước downstream cũ khỏi DB để UI lập tức chuyển sang trạng thái sinh (Generating...)
        for (const code of downstreamCodes) {
            await db.run(DELETE.from('cnma.proresolve.Disciplines').where({ report_ID: reportID, code }));
        }

        await markAnalyzing(reportID);
        await getGlobalModelConfig();

        runDownstreamInBackground(reportID, row.sourcePayload, existingDisciplines, fromStep);

        LOG.info(`Report ${reportID} (case ${row.notificationId}) đã xếp lịch phân tích lại các bước từ ${fromStep}`);
        return reportID;
    });

    // ── findPrecedents ───────────────────────────────────────────────────────
    srv.on('findPrecedents', async (req: any) => {
        const reportID = req.data?.reportID;
        if (typeof reportID !== 'string' || !reportID.trim()) {
            return req.error(400, 'reportID is required.');
        }

        const db = await cds.connect.to('db');
        const row = await db.run(
            SELECT.one.from('cnma.proresolve.Reports')
                .columns('ID', 'notificationId', 'caseContext', 'sourcePayload')
                .where({ ID: reportID }),
        );
        if (!row) return req.error(404, `Report ${reportID} not found.`);

        // `caseContext` được ghi lúc tạo bản ghi, nên có sẵn kể cả khi pipeline AI
        // chưa chạy xong. Rơi về `sourcePayload` phòng bản ghi cũ chưa có cột này.
        let context: CaseContext;
        try {
            context = row.caseContext
                ? (JSON.parse(row.caseContext) as CaseContext)
                : mapCase(JSON.parse(row.sourcePayload));
        } catch (e: any) {
            return req.error(422, `Report ${reportID} could not rebuild its case context: ${e.message}`);
        }

        // Bước D nào chạy profile nào là do `StepRetrievalBindings` quyết, nên
        // action này trả về CẢ TÁM kết quả chứ không một. Trả đúng một bộ nghĩa
        // là chọn hộ người gọi một trong tám, và lựa chọn đó sẽ sai với bảy bước.
        //
        // `sourcePayload` đi kèm để tiêu chí trỏ vào đường dẫn payload SAP có dữ
        // liệu mà so — thiếu nó thì chúng lặng lẽ ăn 0 điểm.
        let raw: unknown;
        try {
            raw = row.sourcePayload ? JSON.parse(row.sourcePayload) : undefined;
        } catch {
            // Payload hỏng chỉ làm mất nhóm tiêu chí theo đường dẫn, không đáng
            // để hỏng cả lời gọi — các tiêu chí theo cột vẫn chấm được.
            raw = undefined;
        }

        return JSON.stringify(await findPrecedentsByStep(context, raw));
    });

    // ── seedCaseLibrary ──────────────────────────────────────────────────────
    srv.on('seedCaseLibrary', async (req: any) => {
        const payload = req.data?.payload;
        if (typeof payload !== 'string' || !payload.trim()) {
            return req.error(400, 'payload is required and must be a JSON string.');
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(payload);
        } catch (e: any) {
            return req.error(400, `payload is not valid JSON: ${e.message}`);
        }

        // Nhận cả một case đơn lẻ lẫn cả mẻ — người gọi không phải bọc mảng chỉ
        // để nạp một file.
        const cases = Array.isArray(parsed) ? parsed : [parsed];
        if (!cases.length) return req.error(400, 'payload is empty — no cases to seed.');

        return JSON.stringify(await seedLibrary(cases));
    });

    // ── peekNextNumber ───────────────────────────────────────────────────────
    //
    // Lấy trước số kế tiếp sẽ được cấp cho DEFECT hoặc INSPLOT để hiển thị trên form.
    srv.on('peekNextNumber', async (req: any) => {
        const object = String(req.data?.object ?? '').trim().toUpperCase();
        const tx: any = cds.tx(req);

        if (object === 'DEFECT') {
            return await peekNextNumber(tx, 'DEFECT', async (code) => {
                const hit1 = await tx.run(
                    SELECT.one.from('cnma.proresolve.Reports').columns('ID').where({ notificationId: code }),
                );
                if (hit1) return true;
                const hit2 = await tx.run(
                    SELECT.one.from('cnma.proresolve.Defects').columns('ID').where({ defectId: code }),
                );
                return !!hit2;
            });
        }

        if (object === 'INSPLOT') {
            return await peekNextNumber(tx, 'INSPLOT', async (code) => {
                const hit = await tx.run(
                    SELECT.one.from('cnma.proresolve.InspectionLots').columns('ID').where({ lotId: code }),
                );
                return !!hit;
            });
        }

        return await peekNextNumber(tx, object);
    });

    // ── reviewDiscipline ─────────────────────────────────────────────────────
    //
    // Đường ghi duy nhất cho quyết định của con người trên một bước D.
    srv.on('reviewDiscipline', async (req: any) => {
        const disciplineID = req.data?.disciplineID;
        if (typeof disciplineID !== 'string' || !disciplineID.trim()) {
            return req.error(400, 'disciplineID is required.');
        }

        const decision = String(req.data?.decision ?? '').trim();
        if (!isReviewDecision(decision)) {
            return req.error(400, `decision must be one of ${REVIEW_DECISIONS.join(', ')}.`);
        }

        const note = String(req.data?.note ?? '').trim() || null;
        // Trả lại mà không nói sửa gì thì người nhận không làm được gì — chặn ở
        // đây chứ không nhắc nhở trên UI, vì UI là thứ duy nhất thay thế được.
        if (decision === 'request-change' && !note) {
            return req.error(400, 'note is required when requesting a change.');
        }
        if (note && note.length > 500) {
            return req.error(400, `note is ${note.length} characters; the limit is 500.`);
        }

        // Danh tính lấy từ ngữ cảnh xác thực, không từ payload.
        const actor = String(req.user?.id ?? 'anonymous');

        try {
            const result = await reviewDiscipline(
                disciplineID,
                statusForDecision(decision),
                note,
                actor,
            );
            return JSON.stringify(result);
        } catch (e: any) {
            return req.error(e?.code === 404 ? 404 : e?.code === 400 ? 400 : 500, describe(e));
        }
    });

    srv.on('getReviewTrail', async (req: any) => {
        const reportID = String(req.data?.reportID ?? '').trim();
        if (!reportID) return req.error(400, 'reportID is required.');
        try {
            const [trail, gate] = await Promise.all([
                getReviewTrail(reportID),
                getClosureGate(reportID),
            ]);
            return JSON.stringify({ gate, trail });
        } catch (e: any) {
            return req.error(500, describe(e));
        }
    });

    // ── saveTeamRoster ───────────────────────────────────────────────────────
    //
    // Duong ghi DUY NHAT ma UI co tren mot report da phan tich. Validate o day
    // chu khong o client: client la thu duy nhat co the bi thay the.
    srv.on('saveTeamRoster', async (req: any) => {
        const disciplineID = req.data?.disciplineID;
        if (typeof disciplineID !== 'string' || !disciplineID.trim()) {
            return req.error(400, 'disciplineID is required.');
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(String(req.data?.roster ?? ''));
        } catch (e: any) {
            return req.error(400, `roster is not valid JSON: ${e.message}`);
        }
        if (!Array.isArray(parsed)) return req.error(400, 'roster must be an array.');

        // Vai trò để hở tự do thì bảng sẽ dần có mỗi dòng một cách viết, và
        // không truy vấn được "ai là trưởng nhóm" nữa.
        const ALLOWED_ROLES = new Set(['8D Team Leader', '8D Team Member']);
        const roster: AssignedTeamRow[] = [];
        const seen = new Set<string>();
        for (const [index, item] of parsed.entries()) {
            if (!item || typeof item !== 'object' || Array.isArray(item)) {
                return req.error(400, `roster[${index}] is not an object.`);
            }
            const row = item as Record<string, unknown>;
            const partnerId = String(row.partnerId ?? '').trim();
            // Dòng chưa gán người là trạng thái nháp trên UI, không phải dữ liệu
            // để lưu — bỏ qua thay vì báo lỗi bắt người dùng đi dọn.
            if (!partnerId) continue;
            if (seen.has(partnerId)) {
                return req.error(400, `Partner ${partnerId} appears twice in the team.`);
            }
            seen.add(partnerId);

            const partnerRole = String(row.partnerRole ?? '').trim();
            if (!ALLOWED_ROLES.has(partnerRole)) {
                return req.error(400,
                    `roster[${index}].partnerRole "${partnerRole}" is not a valid role. `
                    + `Choose one of: ${[...ALLOWED_ROLES].join(', ')}.`);
            }

            roster.push({
                partnerId,
                partnerName: String(row.partnerName ?? '').trim() || partnerId,
                functionTitle: String(row.functionTitle ?? '').trim(),
                partnerRole,
            });
        }

        const leaders = roster.filter((row) => row.partnerRole === '8D Team Leader').length;
        if (leaders > 1) return req.error(400, `An 8D team has exactly one leader; found ${leaders}.`);

        try {
            await saveAssignedTeam(disciplineID, roster);
        } catch (e: any) {
            return req.error(e?.code === 404 ? 404 : e?.code === 400 ? 400 : 500, describe(e));
        }
        return JSON.stringify({ saved: roster.length });
    });

    // ── saveDisciplineField ──────────────────────────────────────────────────
    //
    // Duong ghi cua nguoi dung len mot buoc D. Danh sach khoa cho phep nam o
    // repository (`HUMAN_WRITABLE_FIELDS`), khong o day: mot cho duy nhat quyet
    // dinh cai gi ghi duoc thi khong the lech nhau.
    srv.on('saveDisciplineField', async (req: any) => {
        const disciplineID = req.data?.disciplineID;
        if (typeof disciplineID !== 'string' || !disciplineID.trim()) {
            return req.error(400, 'disciplineID is required.');
        }
        const fieldKey = String(req.data?.fieldKey ?? '').trim();
        if (!fieldKey) return req.error(400, 'fieldKey is required.');

        let value: unknown;
        try {
            value = JSON.parse(String(req.data?.valueJson ?? 'null'));
        } catch (e: any) {
            return req.error(400, `valueJson is not valid JSON: ${e.message}`);
        }

        // Chuoi rong = "xoa phan sua cua toi", khong phai mot gia tri. Luu chuoi
        // rong thi UI van thay co override va khong bao gio quay lai duoc ban AI.
        if (typeof value === 'string' && !value.trim()) value = null;

        try {
            await saveDisciplineFieldValue(disciplineID, fieldKey, value);
        } catch (e: any) {
            return req.error(e?.code === 404 ? 404 : e?.code === 400 ? 400 : 500, describe(e));
        }
        return JSON.stringify({ saved: fieldKey });
    });

    // ── confirmDisciplineField ───────────────────────────────────────────────
    srv.on('confirmDisciplineField', async (req: any) => {
        const disciplineID = req.data?.disciplineID;
        if (typeof disciplineID !== 'string' || !disciplineID.trim()) {
            return req.error(400, 'disciplineID is required.');
        }
        const fieldKey = String(req.data?.fieldKey ?? '').trim();
        if (!fieldKey) return req.error(400, 'fieldKey is required.');
        const confirmed = req.data?.confirmed === true;

        try {
            const result = await confirmDisciplineField(disciplineID, fieldKey, confirmed);
            return JSON.stringify(result);
        } catch (e: any) {
            return req.error(e?.code === 404 ? 404 : e?.code === 400 ? 400 : 500, describe(e));
        }
    });

    // ── setDisciplineWorkState ───────────────────────────────────────────────
    srv.on('setDisciplineWorkState', async (req: any) => {
        const disciplineID = req.data?.disciplineID;
        if (typeof disciplineID !== 'string' || !disciplineID.trim()) {
            return req.error(400, 'disciplineID is required.');
        }
        const workState = String(req.data?.workState ?? '').trim();
        if (!workState) return req.error(400, 'workState is required.');

        try {
            const result = await setDisciplineWorkState(disciplineID, workState);
            return JSON.stringify(result);
        } catch (e: any) {
            return req.error(e?.code === 404 ? 404 : e?.code === 400 ? 400 : 500, describe(e));
        }
    });

    // ── Dải số ───────────────────────────────────────────────────────────────
    //
    // Cấp số ở đây, trong `before CREATE`, nghĩa là cấp TRONG transaction của
    // lệnh insert: insert hỏng thì bộ đếm cuộn lại theo, và một form mở rồi bỏ dở
    // không đốt số nào — vì tới đây thì người dùng đã bấm Lưu.
    //
    // Cấp phát chỉ xảy ra khi client KHÔNG gửi mã. Gửi thì giữ nguyên, và kéo bộ
    // đếm lên cho khỏi tụt lại: SAP hỗ trợ cả hai kiểu, và dữ liệu nhập từ ngoài
    // luôn mang số của chính nó.
    async function assignBusinessKey(
        req: any,
        opts: {
            field: string;
            object: string;
            entity: string;
            label: string;
            payloadField?: string;
            /**
             * Chỗ khác cũng tiêu số của cùng dải này. `DEFECT` được `Defects` và
             * `Reports` dùng chung, nên chỉ dò trùng trong một bảng là bỏ sót
             * đúng nửa còn lại của dải.
             */
            alsoCheck?: Array<{ entity: string; field: string }>;
        },
    ): Promise<void> {
        const tx: any = cds.tx(req);
        const given = String(req.data?.[opts.field] ?? '').trim();

        if (given) {
            req.data[opts.field] = given;
            const n = numericPart(given);
            if (n != null) await raiseNumberRange(tx, opts.object, n);
            syncPayloadField(req, opts, given);
            return;
        }

        const places = [{ entity: opts.entity, field: opts.field }, ...(opts.alsoCheck ?? [])];
        try {
            const code = await allocateNumber(tx, opts.object, async (candidate) => {
                for (const place of places) {
                    const hit = await tx.run(
                        SELECT.one.from(place.entity).columns('ID').where({ [place.field]: candidate }),
                    );
                    if (hit) return true;
                }
                return false;
            });
            req.data[opts.field] = code;
            syncPayloadField(req, opts, code);
        } catch (e: any) {
            return req.error(500, `Could not assign a ${opts.label}: ${describe(e)}`);
        }
    }

    /**
     * Vá lại số vào bên trong `sourcePayload`.
     *
     * `sourcePayload` là bản JSON gốc của case, và pipeline phân tích đọc số từ
     * TRONG đó chứ không từ cột. Nếu để cột mang số vừa cấp còn payload mang chuỗi
     * rỗng, cùng một bản ghi sẽ tự mâu thuẫn — và mâu thuẫn đó chỉ lộ ra ở lần
     * chạy phân tích sau, xa chỗ gây lỗi.
     *
     * JSON hỏng thì bỏ qua: chỗ này không phải cổng kiểm tra payload, và một lỗi
     * cú pháp ở đây không nên chặn việc cấp số.
     */
    function syncPayloadField(req: any, opts: { payloadField?: string }, code: string): void {
        if (!opts.payloadField) return;
        const raw = req.data?.sourcePayload;
        if (typeof raw !== 'string' || !raw.trim()) return;
        try {
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return;
            if (parsed[opts.payloadField] === code) return;
            parsed[opts.payloadField] = code;
            req.data.sourcePayload = JSON.stringify(parsed);
        } catch {
            /* payload không phải JSON hợp lệ — để nguyên, chỗ khác sẽ báo. */
        }
    }

    // `prepend` chứ không phải `before` thẳng: `lotId` có `@mandatory`, và kiểm
    // tra đầu vào tự sinh của CAP chạy ở đầu pha `before`. Đăng ký thường thì form
    // gửi ô trống sẽ bị chặn TRƯỚC khi tới đây và không bao giờ được cấp số.
    // `prepend` đẩy handler này lên trước cả handler tự sinh, nên tới lúc kiểm tra
    // thì số đã có. `@mandatory` vẫn giữ nguyên tác dụng — nó vẫn bắt được trường
    // hợp cấp số không ra gì.
    //
    // `HistoricalCases` từng có một handler y hệt. Bỏ đi ở Phase 5 vì entity đó
    // không còn mở CREATE: số của case nhập kho do `seedLibrary` cấp, ở tầng
    // domain, cùng chỗ tính `defectKeywords` và `searchText`.
    srv.prepend(() => {
        srv.before('CREATE', 'InspectionLots', (req: any) => assignBusinessKey(req, {
            field: 'lotId',
            object: 'INSPLOT',
            entity: 'cnma.proresolve.InspectionLots',
            label: 'inspection lot number',
        }));

        // Lỗi dùng CHUNG dải số `DEFECT` với `Reports.notificationId`. Cố ý: bên
        // SAP thông báo lỗi CHÍNH LÀ vật mà 8D mở ra từ đó, nên hai bảng mang
        // cùng một con số chứ không phải hai con số phải đối chiếu với nhau.
        srv.before('CREATE', 'Defects', (req: any) => assignBusinessKey(req, {
            field: 'defectId',
            object: 'DEFECT',
            entity: 'cnma.proresolve.Defects',
            label: 'defect number',
            alsoCheck: [{ entity: 'cnma.proresolve.Reports', field: 'notificationId' }],
        }));
    });

    /**
     * Chuẩn hoá trạng thái Defect:
     * Một defect chưa được start 8D (không có Reports gắn với nó) và chưa Completed
     * thì trạng thái bắt buộc phải là 'Open' (không thể là 'In Process').
     */
    srv.after('READ', 'Defects', async (data: any) => {
        if (!data) return;
        const rows = Array.isArray(data) ? data : [data];
        if (rows.length === 0) return;

        const candidateRows = rows.filter((r) => r && r.defectId && r.status !== 'Completed' && r.status !== 'Open');
        if (candidateRows.length === 0) return;

        try {
            const activeReports = await cds.run(
                SELECT.from('cnma.proresolve.Reports')
                    .columns('sourceDefectId')
                    .where({ sourceDefectId: { '!=': null } })
            );
            const startedDefectIds = new Set(
                (activeReports ?? []).map((r: any) => String(r.sourceDefectId ?? '').trim()).filter(Boolean)
            );

            const toFixIds: string[] = [];
            for (const r of candidateRows) {
                if (!startedDefectIds.has(String(r.defectId).trim())) {
                    r.status = 'Open';
                    if (r.ID) toFixIds.push(r.ID);
                }
            }

            if (toFixIds.length > 0) {
                cds.run(
                    UPDATE('cnma.proresolve.Defects')
                        .set({ status: 'Open' })
                        .where({ ID: { in: toFixIds } })
                ).catch((err: any) => {
                    LOG.warn('Không thể tự động đồng bộ status Open cho Defects:', err?.message);
                });
            }
        } catch (err: any) {
            LOG.warn('Lỗi kiểm tra trạng thái Defect trong after READ:', err?.message);
        }
    });

    cds.on('served', async () => {
        try {
            const activeReports = await cds.run(
                SELECT.from('cnma.proresolve.Reports')
                    .columns('sourceDefectId')
                    .where({ sourceDefectId: { '!=': null } })
            );
            const startedDefectIds = (activeReports ?? [])
                .map((r: any) => String(r.sourceDefectId ?? '').trim())
                .filter(Boolean);

            const q = UPDATE('cnma.proresolve.Defects')
                .set({ status: 'Open' })
                .where({ status: { in: ['In Process', 'InProcess'] } });

            if (startedDefectIds.length > 0) {
                await cds.run(q.and('defectId not in', startedDefectIds));
            } else {
                await cds.run(q);
            }
            LOG.info('Defect status self-healing complete: unstarted defects set to Open.');
        } catch (err: any) {
            LOG.warn('Defect status self-healing skipped:', err?.message);
        }
    });

    /**
     * Sửa `defectText` trên một dòng kho thì phải tính lại từ khoá.
     *
     * `defectKeywords` là bản tách sẵn của `defectText`, và chấm điểm so CỘT ĐÓ
     * chứ không so văn bản gốc. Sửa mô tả mà để nguyên cột từ khoá nghĩa là màn
     * hình hiện một đằng, máy chấm điểm một nẻo — và không có gì báo, vì cả hai
     * giá trị đều hợp lệ.
     */
    srv.before('UPDATE', 'HistoricalCases', (req: any) => {
        if (!('defectText' in (req.data ?? {}))) return;
        req.data.defectKeywords = tokenizeDefectText(String(req.data.defectText ?? ''));
    });

    // ── TaskEvidences ────────────────────────────────────────────────────────
    srv.before('CREATE', 'TaskEvidences', async (req: any) => {
        const { reportID, disciplineCode, taskId, fileName, fileSize, mediaType } = req.data ?? {};
        if (!reportID || !disciplineCode || !taskId) {
            return req.error(400, 'reportID, disciplineCode, and taskId are required.');
        }
        if (mediaType !== 'application/pdf') {
            return req.error(400, 'Only PDF files are allowed.');
        }
        const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
        const size = Number(fileSize) || 0;
        if (size > MAX_SIZE) {
            const actualMb = (size / (1024 * 1024)).toFixed(2);
            return req.error(400, `File size exceeds 10 MB limit (actual: ${actualMb} MB).`);
        }

        const discipline = await SELECT.one.from('cnma.proresolve.Disciplines')
            .columns('ID', 'code', 'reviewStatus', 'resultJson', 'workState')
            .where({ report_ID: reportID, code: disciplineCode });
        if (!discipline) {
            return req.error(404, `Discipline ${disciplineCode} not found for report ${reportID}.`);
        }

        const isActionStep = ['D3', 'D5', 'D7'].includes(String(disciplineCode));
        if (discipline.reviewStatus === 'Approved' && !isActionStep) {
            return req.error(400, `Discipline ${disciplineCode} has been completed and locked.`);
        }

        if (discipline.workState !== 'InProgress') {
            return req.error(400, `Discipline ${disciplineCode} is not in process. Switch status to 'In process' to upload evidence.`);
        }

        const task = findTaskInResultJson(discipline.resultJson, taskId);
        const taskStatus = String(task?.status || '').trim().toLowerCase();
        const allowedStatuses = isActionStep
            ? ['open', 'done', 'verified']
            : ['done', 'verified'];

        if (!task || !allowedStatuses.includes(taskStatus)) {
            return req.error(400, `Evidence can only be uploaded for tasks with status ${allowedStatuses.join(' or ')}.`);
        }

        req.data.uploadedBy = req.user?.id || 'anonymous';
        req.data.uploadedAt = new Date().toISOString();

        if (taskStatus === 'open') {
            const updatedJson = markTaskStatusInResultJson(discipline.resultJson, taskId, 'Done');
            if (updatedJson) {
                await UPDATE('cnma.proresolve.Disciplines')
                    .set({ resultJson: updatedJson })
                    .where({ ID: discipline.ID });
            }
        }
    });

    srv.before('UPDATE', 'TaskEvidences', async (req: any) => {
        // Only allow media streaming (content upload), block direct metadata mutations
        const keys = Object.keys(req.data ?? {}).filter((k) => k !== 'ID' && k !== 'content' && k !== 'mediaType');
        if (keys.length > 0) {
            return req.error(400, 'Direct modification of evidence metadata is not permitted. Delete and re-upload instead.');
        }
    });

    srv.before('DELETE', 'TaskEvidences', async (req: any) => {
        const id = req.data?.ID;
        if (!id) return;
        const row = await SELECT.one.from('cnma.proresolve.TaskEvidences')
            .columns('ID', 'reportID', 'disciplineCode')
            .where({ ID: id });
        if (row) {
            const discipline = await SELECT.one.from('cnma.proresolve.Disciplines')
                .columns('ID', 'reviewStatus', 'workState')
            if (discipline) {
                const isActionStep = ['D3', 'D5', 'D7'].includes(String(row.disciplineCode));
                if (discipline.reviewStatus === 'Approved' && !isActionStep) {
                    return req.error(400, `Discipline ${row.disciplineCode} has been completed and locked.`);
                }
                if (discipline.workState !== 'InProgress') {
                    return req.error(400, `Discipline ${row.disciplineCode} is not in process. Switch status to 'In process' to delete evidence.`);
                }
            }
        }
    });

    // ── listTaskEvidence ─────────────────────────────────────────────────────
    srv.on('listTaskEvidence', async (req: any) => {
        const reportID = String(req.data?.reportID ?? '').trim();
        if (!reportID) return req.error(400, 'reportID is required.');
        try {
            const rows = await listTaskEvidence(reportID);
            return JSON.stringify(rows);
        } catch (e: any) {
            return req.error(e?.code === 404 ? 404 : e?.code === 400 ? 400 : 500, describe(e));
        }
    });

    // ── clearCaseLibrary ─────────────────────────────────────────────────────
    srv.on('clearCaseLibrary', async () => JSON.stringify({ deleted: await clearLibrary() }));

    // ── embedCaseLibrary ─────────────────────────────────────────────────────
    srv.on('embedCaseLibrary', async (req: any) =>
        JSON.stringify(await embedLibrary(req.data?.force === true)));

    LOG.info('Đã gắn handler EightDService');
}

/**
 * Dọn bản ghi kẹt lúc khởi động.
 *
 * Tách khỏi `registerEightDHandlers` vì việc này cần DB sẵn sàng — gọi ở
 * `cds.on('served')`, không phải lúc đăng ký service.
 */
export async function sweepOnStartup(): Promise<void> {
    try {
        const n = await sweepStuckAnalyzing();
        if (n) LOG.warn(`Đã dọn ${n} report kẹt ở trạng thái Analyzing từ lần chạy trước.`);
    } catch (e: any) {
        LOG.error('Không dọn được report kẹt:', e?.message ?? e);
    }
}
