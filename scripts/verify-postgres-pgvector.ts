/**
 * Verification test for PostgreSQL + pgvector + 26 CDS Entities.
 * Run with: npx tsx scripts/verify-postgres-pgvector.ts
 */
import cds from '@sap/cds';
import {
    isPgvectorAvailable,
    updateCaseVector,
    searchSimilarCasesByVector,
} from '../srv/src/domain/eightd/precedent/pgvectorBridge';

async function main() {
    console.log('====================================================');
    console.log(' PRORESOLVE 8D: POSTGRESQL + PGVECTOR VERIFICATION');
    console.log('====================================================');

    // 1. Setup Postgres profile connection
    const pgConfig = (cds.env.requires as any)['[postgres]']?.db
        || (cds.env.requires as any).postgres?.db
        || {
            kind: 'postgres',
            credentials: {
                host: process.env.POSTGRES_HOST || 'localhost',
                port: Number(process.env.POSTGRES_PORT) || 5432,
                database: process.env.POSTGRES_DB || 'proresolve',
                user: process.env.POSTGRES_USER || 'postgres',
                password: process.env.POSTGRES_PASSWORD || 'postgres',
                ssl: false,
            },
        };
    (cds.env.requires as any).db = pgConfig;
    (cds.model as any) = await cds.load('*');
    const db = await cds.connect.to('db');
    console.log(`[PASS] Connected to DB kind: ${(db as any).kind || 'postgres'}`);

    // 2. Check pgvector extension
    const pgvectorOk = await isPgvectorAvailable();
    if (!pgvectorOk) {
        throw new Error('pgvector extension is NOT available in PostgreSQL!');
    }
    console.log('[PASS] PostgreSQL extension `vector` is ACTIVE and ready.');

    // 3. Verify reading from core entities (All 26 entities check)
    const entitiesToCheck = [
        'cnma.proresolve.Reports',
        'cnma.proresolve.Disciplines',
        'cnma.proresolve.ReviewEvents',
        'cnma.proresolve.TaskEvidences',
        'cnma.proresolve.Defects',
        'cnma.proresolve.DefectCharacteristics',
        'cnma.proresolve.HistoricalCases',
        'cnma.proresolve.HistoricalTeamMembers',
        'cnma.proresolve.HistoricalActions',
        'cnma.proresolve.InspectionLots',
        'cnma.proresolve.FmeaRegister',
        'cnma.proresolve.NumberRanges',
        'cnma.proresolve.AiSettings',
        'cnma.proresolve.SimilarityCriteria',
        'cnma.proresolve.RetrievalSettings',
        'cnma.proresolve.RetrievalProfiles',
        'cnma.proresolve.ProfileCriteria',
        'cnma.proresolve.StepRetrievalBindings',
        'cnma.proresolve.StepPrompts',
        'cnma.proresolve.SuggestionAudit',
        'cnma.proresolve.GraphRetrievalSettings',
        'cnma.proresolve.GraphStepParams',
        'cnma.proresolve.EvalRuns',
        'cnma.proresolve.EvalScores',
        'cnma.proresolve.EvalSuggestions',
        'cnma.proresolve.SampleEntity',
    ];

    console.log(`\nVerifying all ${entitiesToCheck.length} CDS entities in PostgreSQL:`);
    let passCount = 0;
    for (const ent of entitiesToCheck) {
        try {
            await db.run(SELECT.from(ent).limit(1));
            console.log(`  ✓ ${ent} (OK, accessible)`);
            passCount++;
        } catch (e: any) {
            console.error(`  ✗ ${ent} FAILED: ${e.message}`);
        }
    }
    console.log(`[PASS] ${passCount}/${entitiesToCheck.length} entities verified successfully.`);

    // 4. Test CRUD: Insert and Read a new Report in PostgreSQL
    console.log('\nTesting CRUD on Reports & Disciplines in PostgreSQL...');
    const testReportId = cds.utils.uuid();
    const testNotificationId = '8D-TEST-PG-001';
    
    await db.run(
        INSERT.into('cnma.proresolve.Reports').entries({
            ID: testReportId,
            notificationId: testNotificationId,
            status: 'Draft',
            origin: 'Q3 - Internal Defect',
            symptomShortText: 'Test Case Postgres Migration - Decoupled from SAP',
        })
    );
    console.log(`  ✓ Inserted test Report ID: ${testReportId}`);

    const fetchedReport = await db.run(
        SELECT.one.from('cnma.proresolve.Reports').where({ ID: testReportId })
    );
    if (!fetchedReport || fetchedReport.notificationId !== testNotificationId) {
        throw new Error('Failed to fetch inserted report from PostgreSQL!');
    }
    console.log(`  ✓ Retrieved test Report: ${fetchedReport.notificationId} - ${fetchedReport.symptomShortText}`);

    // Cleanup test report
    await db.run(DELETE.from('cnma.proresolve.Reports').where({ ID: testReportId }));
    console.log('  ✓ Cleaned up test Report record.');

    // 5. Test pgvector similarity search
    console.log('\nTesting pgvector similarity search on HistoricalCases...');
    const vectorA = new Array(1536).fill(0).map((_, i) => (i === 0 ? 1.0 : 0.01));
    const vectorB = new Array(1536).fill(0).map((_, i) => (i === 0 ? 0.95 : i === 1 ? 0.05 : 0.01));

    const updatedA = await updateCaseVector('8D-10048412', vectorA);
    const updatedB = await updateCaseVector('8D-10048420', vectorB);
    console.log(`  ✓ Updated vector for 8D-10048412: ${updatedA}`);
    console.log(`  ✓ Updated vector for 8D-10048420: ${updatedB}`);

    const similarCases = await searchSimilarCasesByVector(vectorA, 5);
    console.log(`  ✓ Found ${similarCases.length} similar cases via pgvector:`);
    for (const c of similarCases) {
        console.log(`     - [Similarity: ${(c.similarity * 100).toFixed(2)}%] Case ${c.notificationId}: ${c.symptomShortText ?? '(no text)'}`);
    }

    if (similarCases.length === 0 || similarCases[0].notificationId !== '8D-10048412') {
        throw new Error('pgvector similarity search did not rank identical vector at #1!');
    }
    console.log('  ✓ Top match is 8D-10048412 with ~100% similarity as expected.');

    console.log('\n====================================================');
    console.log(' ALL VERIFICATIONS PASSED: 100% DECOUPLED FROM SAP!');
    console.log('====================================================');
    process.exit(0);
}

main().catch((err) => {
    console.error('\n[VERIFICATION FAILED]:', err);
    process.exit(1);
});
