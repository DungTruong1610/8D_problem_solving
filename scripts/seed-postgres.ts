/**
 * Seed all database tables and case library in PostgreSQL.
 * Run with: npx tsx scripts/seed-postgres.ts
 */
import cds from '@sap/cds';
import { seedRetrievalConfig } from '../srv/src/domain/eightd/precedent/configRepository';
import { seedRetrievalProfiles } from '../srv/src/domain/eightd/precedent/profileRepository';
import { seedGraphStepParams } from '../srv/src/domain/eightd/graph/settings';
import { seedLibraryFromBundle } from '../srv/src/domain/eightd/precedent/librarySeeder';
import { seedValueHelps } from '../srv/src/domain/eightd/valueHelpSeeder';

async function main() {
    console.log('[seed-postgres] Connecting to PostgreSQL with profile postgres...');
    
    // Explicitly set db require to postgres profile
    if ((cds.env.requires as any)['[postgres]']?.db) {
        (cds.env.requires as any).db = (cds.env.requires as any)['[postgres]'].db;
    } else {
        (cds.env.requires as any).db = {
            kind: 'postgres',
            credentials: {
                host: process.env.POSTGRES_HOST || 'localhost',
                port: Number(process.env.POSTGRES_PORT) || 5432,
                database: process.env.POSTGRES_DB || 'proresolve',
                user: process.env.POSTGRES_USER || 'postgres',
                password: process.env.POSTGRES_PASSWORD || 'postgres',
                ssl: false
            }
        };
    }
    
    // Load CDS model first so cds.model.definitions exists
    (cds.model as any) = await cds.load('*');
    
    // Connect to CDS database service
    const db = await cds.connect.to('db');
    console.log(`[seed-postgres] Connected to DB kind: ${(db as any).kind || 'postgres'}`);

    console.log('[seed-postgres] 1. Seeding Retrieval Config (SimilarityCriteria, RetrievalSettings, StepPrompts)...');
    await seedRetrievalConfig();

    console.log('[seed-postgres] 2. Seeding Retrieval Profiles (RetrievalProfiles, ProfileCriteria, StepRetrievalBindings)...');
    await seedRetrievalProfiles();

    console.log('[seed-postgres] 3. Seeding GraphStepParams...');
    await seedGraphStepParams();

    console.log('[seed-postgres] 4. Seeding ValueHelps...');
    await seedValueHelps();

    console.log('[seed-postgres] 5. Seeding Historical Cases from bundle...');
    const report = await seedLibraryFromBundle();
    if (report) {
        console.log(`[seed-postgres] Seeded ${report.inserted} cases, replaced ${report.replaced}, total: ${report.total}`);
    } else {
        console.log('[seed-postgres] No new bundle cases to seed or bundle missing.');
    }

    // Check counts in Postgres
    console.log('[seed-postgres] Checking table counts in PostgreSQL:');
    const casesCount = await db.run('SELECT count(*) as cnt FROM cnma_proresolve_historicalcases');
    const criteriaCount = await db.run('SELECT count(*) as cnt FROM cnma_proresolve_similaritycriteria');
    const profilesCount = await db.run('SELECT count(*) as cnt FROM cnma_proresolve_retrievalprofiles');
    const promptsCount = await db.run('SELECT count(*) as cnt FROM cnma_proresolve_stepprompts');
    const paramsCount = await db.run('SELECT count(*) as cnt FROM cnma_proresolve_graphstepparams');

    console.log(` - cnma_proresolve_historicalcases: ${casesCount[0]?.cnt ?? casesCount[0]?.CNT}`);
    console.log(` - cnma_proresolve_similaritycriteria: ${criteriaCount[0]?.cnt ?? criteriaCount[0]?.CNT}`);
    console.log(` - cnma_proresolve_retrievalprofiles: ${profilesCount[0]?.cnt ?? profilesCount[0]?.CNT}`);
    console.log(` - cnma_proresolve_stepprompts: ${promptsCount[0]?.cnt ?? promptsCount[0]?.CNT}`);
    console.log(` - cnma_proresolve_graphstepparams: ${paramsCount[0]?.cnt ?? paramsCount[0]?.CNT}`);

    console.log('[seed-postgres] Seed completed successfully!');
    process.exit(0);
}

main().catch((err) => {
    console.error('[seed-postgres] ERROR:', err);
    process.exit(1);
});
