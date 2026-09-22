import express from 'express';
import cors from 'cors';
import cds from '@sap/cds';
import path from 'path';
import dotenv from 'dotenv';
import { ValueHelpHandler } from '@cnma/cap-valuehelp/srv';

import { registerAppActivities } from './src/core/ai/activities';
import { registerAppEmbeddingCorpora } from './src/core/ai/embeddingCorpora';
import { initEmbeddings } from './src/core/ai/llmClient';
import { runAiStartupProbes } from './src/core/ai/startupProbes';
import { registerAiAdminHandlers, seedDefaultModelsIfEmpty } from './src/services/aiAdminService';
import { registerIdentityHandlers } from './src/services/identityService';
import { registerEightDHandlers, sweepOnStartup } from './src/services/eightDService';
import { seedRetrievalConfig } from './src/domain/eightd/precedent/configRepository';
import { seedRetrievalProfiles } from './src/domain/eightd/precedent/profileRepository';
import { seedGraphStepParams } from './src/domain/eightd/graph/settings';
import {
    embedLibraryInBackground,
    seedLibraryFromBundle,
} from './src/domain/eightd/precedent/librarySeeder';
import {
    seedValueHelps,
    verifyDefectCatalogueCoverage,
    verifyTaskCatalogueCoverage,
} from './src/domain/eightd/valueHelpSeeder';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const logger = cds.log('Bootstrap');

/**
 * Custom CAP Bootstrap Server
 * Hooks into CDS bootstrap to add middleware, routes, and configuration.
 */
cds.on('bootstrap', (app: express.Application) => {
    // ===== SAP AI CORE =====
    // Registry activity và embedding corpus của CDK là theo từng bundle và khởi
    // đầu RỖNG. Đăng ký ở đây, trước khi bất kỳ handler nào có thể gọi model.
    registerAppActivities();
    registerAppEmbeddingCorpora();
    initEmbeddings();

    // ===== CORS =====
    app.use(cors({
        origin: (origin, callback) => callback(null, true),
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));

    // ===== REQUEST LOGGING =====
    // Một dòng mỗi request, qua cds.log — KHÔNG console.log. Trước đây có thêm
    // một console.log('[HTTP INCOMING]') ngay đầu middleware: hai dòng mỗi
    // request, và trên Windows stdout của tiến trình con (chạy qua concurrently)
    // là pipe GHI ĐỒNG BỘ 64KB — console kẹt (QuickEdit, bôi đen…) là buffer
    // đầy và process.stdout.write chặn cứng CẢ EVENT LOOP: server còn listening
    // nhưng không trả lời bất kỳ request nào nữa.
    app.use((req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            logger.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
        });
        next();
    });

    // ===== HEALTH CHECKS =====
    app.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: process.env.SERVICE_NAME || '8D_Hackathon-srv',
        });
    });

    app.get('/health/ready', async (req, res) => {
        try {
            await cds.connect.to('db');
            res.json({ status: 'ready', checks: { db: 'ok' } });
        } catch (error: any) {
            res.status(503).json({ status: 'not ready', error: error.message });
        }
    });

    // ===== SPRINT 1 VERIFY HARNESS REST ENDPOINTS =====
    app.use(express.json({ limit: '10mb' }));

    app.get('/api/verify/sprint1', async (req, res) => {
        try {
            const { runVerifyHarness } = await import('../scripts/verify-sprint1-harness');
            const report = await runVerifyHarness();
            res.json(report);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/verify/judge-input', async (req, res) => {
        try {
            const { evaluateJudgeInput } = await import('../scripts/verify-sprint1-harness');
            const db = await cds.connect.to('db');
            const result = await evaluateJudgeInput(req.body, db);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    logger.info('Custom bootstrap initialized');
});

/**
 * Service serving hook.
 * Registers event handlers during service initialization before route mounting.
 */
cds.on('serving', (srv) => {
    if (srv.name === 'IdentityService') {
        registerIdentityHandlers(srv as cds.ApplicationService);
    }
    if (srv.name === 'AiAdminService') {
        registerAiAdminHandlers(srv);
    }
    if (srv.name === 'EightDService') {
        registerEightDHandlers(srv);
    }
    if (srv.name === 'ValueHelpService') {
        /**
         * ── Bản trước dựng handler rồi VỨT ĐI ──
         * `new ValueHelpHandler({...})` không gắn vào sự kiện nào, và
         * `getValueHelp` cũng chưa được khai báo trong `ValueHelpService.cds`.
         * Nên mọi ô F4 gọi lên đều ăn 404 — im lặng, vì phía client bắt lỗi rồi
         * trả danh sách rỗng, và một danh sách rỗng nhìn y hệt "danh mục chưa có
         * dữ liệu". Ba chỗ hỏng, một triệu chứng.
         */
        const valueHelp = new ValueHelpHandler({
            entityName: 'cnma.valuehelp.ValueHelpList',
            allowedReferenceTables: {
                ShadowUsers: 'cnma.identity.ShadowUsers',
                ShadowGroups: 'cnma.identity.ShadowGroups',
                SampleEntity: 'cnma.proresolve.SampleEntity',
                // Ba F4 MATERIAL, WORK_CENTER và PARTNER trỏ vào hai bảng này.
                // Thiếu chúng ở đây thì `handleReferenceSource` từ chối bảng và
                // trả về mảng rỗng — ô chọn vẫn hiện, chỉ là không có gì để chọn.
                HistoricalCases: 'cnma.proresolve.HistoricalCases',
                HistoricalTeamMembers: 'cnma.proresolve.HistoricalTeamMembers',
                // F4 lô kiểm tra (Đường A). Cùng lý do: không có tên ở đây thì
                // `handleReferenceSource` từ chối bảng và trả mảng rỗng.
                InspectionLots: 'cnma.proresolve.InspectionLots',
            },
        });
        srv.on('getValueHelp', (req: any) => valueHelp.getValueHelp(req));
        srv.on('getValueHelpSearch', (req: any) => valueHelp.getValueHelpSearch(req));
    }
});

cds.on('served', () => {
    logger.info('All CDS services served successfully');

    // Báo AI Core có thông hay không ngay bây giờ, thay vì để vỡ ở lời gọi model
    // đầu tiên. Không chặn khởi động.
    runAiStartupProbes();
});

/**
 * Khởi tạo dữ liệu — chạy SAU khi cổng đã mở.
 *
 * ── Vì sao không đặt trong 'served' ──
 * CAP *chờ* handler 'served' bất đồng bộ chạy xong rồi mới gọi `listen()`. Để
 * chuỗi seed ở đó nghĩa là cổng chỉ mở khi seed xong. Đo trên hybrid/HANA Cloud:
 *
 *     sweepOnStartup         5.3s
 *     seedRetrievalConfig   20.0s
 *     seedRetrievalProfiles  1.4s
 *     seedLibraryFromBundle 17.5s
 *     ────────────────────────────
 *     tổng                  44.3s   ← cổng 4008 im lặng suốt quãng này
 *
 * Gần như toàn bộ quãng đó chỉ để XÁC NHẬN dữ liệu vốn đã có. Chi phí nằm ở
 * round-trip tới EU10 với pool `min: 0` — mỗi truy vấn đầu phải dựng lại một
 * connection TLS mới — chứ không phải khối lượng dữ liệu.
 *
 * Chuyển sang 'listening' thì server nhận request ngay từ ~10s, seed chạy nền
 * phía sau. An toàn vì mọi bước đều idempotent và chỉ bù phần còn thiếu.
 *
 * ── Vì sao local dev BỎ QUA seed ──
 * Local hybrid nối vào đúng cái HANA mà deploy đã seed rồi — 44s kia chỉ để xác
 * nhận lại điều đó qua round-trip EU10, ở MỌI lần boot, và `cds watch` thì boot
 * liên tục. Seed thuộc về vòng đời deploy, không thuộc vòng đời dev. Nhận diện
 * local qua profile `development` (`cds watch` luôn bật nó kèm theo; trên CF chỉ
 * có `production`). Cần ép chạy tại chỗ — DB mới tinh, hoặc test lại seeder —
 * thì đặt CNMA_STARTUP_SEED=1.
 */
cds.on('listening', () => {
    void startupTasks();
});

async function startupTasks(): Promise<void> {
    // Job phân tích 8D sống trong tiến trình này. Server chết giữa chừng thì bản
    // ghi kẹt ở 'Analyzing' và UI quay vòng mãi không dừng — dọn ngay lúc boot.
    // Bước này KHÔNG thuộc nhóm seed và chạy cả ở local: report kẹt sinh ra từ
    // chính tiến trình local chết giữa chừng, không phải từ deploy.
    try {
        await sweepOnStartup();
    } catch (e: any) {
        logger.error('Không dọn được report kẹt lúc boot:', e?.message ?? e);
    }

    // F4 (Value Help) cho form ghi nhận lỗi và Master Data Catalogues.
    try {
        await seedValueHelps();
    } catch (e: any) {
        logger.error('Không seed được định nghĩa F4:', e?.message ?? e);
    }

    // Danh mục model AI (Google Gemini / AI Core) cho trang AI Settings.
    try {
        await seedDefaultModelsIfEmpty();
    } catch (e: any) {
        logger.error('Không seed được danh mục AIModels mặc định:', e?.message ?? e);
    }

    // Kiểm tra xem đã có kho case chưa — nếu DB mới tinh (0 case) thì bắt buộc seed ban đầu
    let needsInitialSeed = false;
    try {
        const db = await cds.connect.to('db');
        const countRes = await db.run('SELECT count(*) as cnt FROM cnma_proresolve_historicalcases');
        const caseCount = Number(countRes[0]?.cnt ?? countRes[0]?.CNT ?? 0);
        if (caseCount === 0) {
            needsInitialSeed = true;
            logger.info('Phát hiện cơ sở dữ liệu mới (chưa có case tiền lệ). Tự động nạp dữ liệu ban đầu...');
        }
    } catch {
        needsInitialSeed = true;
    }

    const isLocalDev = cds.env.profiles?.includes('development');
    if (isLocalDev && !needsInitialSeed && process.env.CNMA_STARTUP_SEED !== '1') {
        logger.info('Local dev — dữ liệu đã có sẵn, bỏ qua seed lại (ép chạy lại: CNMA_STARTUP_SEED=1).');
        return;
    }

    // Cả chuỗi seed nằm chung một try: chạy trong `void startupTasks()`, nên một
    // promise vỡ ở đây là unhandled rejection và giết cả tiến trình. Gộp chung
    // cũng đúng về mặt phụ thuộc — hỏng `seedRetrievalConfig` thì bước profile
    // phía sau không còn cơ sở để chạy.
    try {
        // Trọng số chấm điểm và danh sách prompt bước D.
        //
        // Seed bằng code chứ không bằng CSV trong `db/data/`: HDI ghi đè CSV ở MỖI
        // lần deploy, nên trọng số admin chỉnh trên UI sẽ bị xoá mà không ai được
        // báo. Hàm này idempotent — chỉ ghi khi bảng còn rỗng.
        await seedRetrievalConfig();

        // Profile chấm điểm và ràng buộc bước D → profile.
        //
        // PHẢI chạy sau `seedRetrievalConfig()`: profile `default` được dựng từ bộ
        // trọng số toàn cục đang có trong DB, nên bảng đó phải tồn tại trước. Đảo thứ
        // tự thì trên một DB mới, profile mặc định sinh ra rỗng.
        await seedRetrievalProfiles();
        // Trọng số của engine graph, seed đúng bằng con số đang chạy trong code.
        // Không đổi hành vi — chỉ đưa những con số đó lên chỗ sửa được mà không
        // phải deploy lại, đúng như `GraphStepParams` được thiết kế để làm.
        await seedGraphStepParams();
    } catch (e: any) {
        logger.error('Khởi tạo dữ liệu lúc boot thất bại:', e?.message ?? e);
    }

    // Kho case tiền lệ. Chỉ BÙ case còn thiếu, không đụng case đã có — nên deploy
    // lại vừa mang được case mới lên, vừa giữ nguyên dữ liệu thật. Đây là đường
    // duy nhất để kho có dữ liệu trên CF mà không phải nới scope admin cho token
    // kỹ thuật của chính app.
    try {
        await seedLibraryFromBundle();
    } catch (e: any) {
        // Kho thiếu làm hỏng gợi ý tiền lệ, nhưng không được làm app chết:
        // `findPrecedents` đã báo rõ lý do thay vì đoán bừa.
        logger.error('Không bù được kho case từ dữ liệu đóng gói:', e?.message ?? e);
    }

    // Định nghĩa F4 cho form ghi nhận lỗi, rồi kiểm tra catalogue phủ đủ kho case.
    //
    // PHẢI chạy sau `seedLibraryFromBundle()`: phép kiểm tra độ phủ đọc
    // `HistoricalCases`, nên kho phải có dữ liệu trước, không thì nó báo "phủ đủ 0
    // mã" — đúng về kỹ thuật và vô dụng về thực tế.
    try {
        await seedValueHelps();
        await verifyDefectCatalogueCoverage();
        // Cùng lý do thứ tự: phép kiểm này đọc `HistoricalActions`, con của
        // `HistoricalCases`, nên kho phải nạp xong trước.
        await verifyTaskCatalogueCoverage();
    } catch (e: any) {
        // Thiếu F4 làm form phải gõ tay, nhưng không được làm app chết.
        logger.error('Không seed được định nghĩa F4:', e?.message ?? e);
    }

    // Vector cho tiêu chí ngữ nghĩa. Chạy ngầm — cần AI Core sống và mất vài
    // giây, không đáng để chặn khởi động.
    embedLibraryInBackground();
}
