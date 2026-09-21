/**
 * Seed SQLite database with complete 8D Golden Dataset (25 cases).
 * Run with: npx tsx scripts/seed-sqlite.ts
 */
import cds from '@sap/cds';
import { seedRetrievalConfig } from '../srv/src/domain/eightd/precedent/configRepository';
import { seedRetrievalProfiles } from '../srv/src/domain/eightd/precedent/profileRepository';
import { seedGraphStepParams } from '../srv/src/domain/eightd/graph/settings';
import { seedLibraryFromBundle } from '../srv/src/domain/eightd/precedent/librarySeeder';
import { seedValueHelps } from '../srv/src/domain/eightd/valueHelpSeeder';
import { seedDefaultModelsIfEmpty } from '../srv/src/services/aiAdminService';

async function main() {
    console.log('===========================================================');
    console.log(' SEEDING COMPLETE 8D PRECEDENT KNOWLEDGE BASE INTO SQLITE ');
    console.log('===========================================================');

    // Ensure database profile is sqlite
    (cds.env.requires as any).db = {
        kind: 'sqlite',
        credentials: { url: 'db.sqlite' }
    };

    (cds.model as any) = await cds.load('*');
    const db = await cds.connect.to('db');
    console.log(`[PASS] Connected to database: ${(db as any).kind}`);

    // 1. Seed F4 Value Helps
    console.log('[1/5] Seeding F4 Value Helps & Catalogues...');
    await seedValueHelps();

    // 2. Seed Retrieval Config
    console.log('[2/5] Seeding Similarity Criteria & Step Prompts...');
    await seedRetrievalConfig();

    // 3. Seed Retrieval Profiles & Step Params
    console.log('[3/5] Seeding Retrieval Profiles & Graph Parameters...');
    await seedRetrievalProfiles();
    await seedGraphStepParams();

    // 4. Seed AI Models
    console.log('[4/5] Seeding Gemini AI Models...');
    await seedDefaultModelsIfEmpty();

    // 5. Seed Complete 8D Case Library from Bundle
    console.log('[5/5] Seeding 25 Full 8D Precedent Cases from Bundle...');
    const report = await seedLibraryFromBundle();
    if (report) {
        console.log(`[PASS] Seeded cases — Inserted: ${report.inserted}, Replaced: ${report.replaced}, Skipped: ${report.skipped.length}, Total: ${report.total}`);
    } else {
        console.warn('[WARN] No bundle cases found in srv/data/case-library.');
    }

    // Check counts
    const casesCount = await db.run('SELECT count(*) as cnt FROM cnma_proresolve_historicalcases');
    const actionsCount = await db.run('SELECT count(*) as cnt FROM cnma_proresolve_historicalactions');
    const teamCount = await db.run('SELECT count(*) as cnt FROM cnma_proresolve_historicalteammembers');
    const reportsCount = await db.run('SELECT count(*) as cnt FROM cnma_proresolve_reports');
    const disciplinesCount = await db.run('SELECT count(*) as cnt FROM cnma_proresolve_disciplines');
    const defectsCount = await db.run('SELECT count(*) as cnt FROM cnma_proresolve_defects');

    console.log('\n===========================================================');
    console.log(' DATABASE SEED VERIFICATION:');
    console.log('===========================================================');
    console.log(` - Historical Cases (Kho case tiền lệ): ${casesCount[0]?.cnt ?? casesCount[0]?.CNT}`);
    console.log(` - Historical Actions (Hành động D3/D5/D7 mẫu): ${actionsCount[0]?.cnt ?? actionsCount[0]?.CNT}`);
    console.log(` - Historical Team Members (Thành viên D1 mẫu): ${teamCount[0]?.cnt ?? teamCount[0]?.CNT}`);
    console.log(` - 8D Reports (Báo cáo sự vụ 8D): ${reportsCount[0]?.cnt ?? reportsCount[0]?.CNT}`);
    console.log(` - Disciplines D1-D8 (Phân tích chi tiết D1-D8): ${disciplinesCount[0]?.cnt ?? disciplinesCount[0]?.CNT}`);
    console.log(` - Defect Catalogues (Danh mục lỗi): ${defectsCount[0]?.cnt ?? defectsCount[0]?.CNT}`);
    console.log('===========================================================');
    console.log(' DATABASE HOÀN TẤT VÀ SẴN SÀNG CHO AI ĐỌC & SUY LUẬN!');
    console.log('===========================================================');
    process.exit(0);
}

main().catch((err) => {
    console.error('[ERROR]', err);
    process.exit(1);
});
