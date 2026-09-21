import fs from 'node:fs';
import path from 'node:path';
import cds from '@sap/cds';
import { seedLibraryFromBundle } from '../srv/src/domain/eightd/precedent/librarySeeder';

async function run() {
    console.log('=== 1. Bundling cases into srv/data/case-library ===');
    const ROOT = path.resolve(__dirname, '..');
    const SRC = path.join(ROOT, 'mock-data', 'clean');
    const DEST = path.join(ROOT, 'srv', 'data', 'case-library');

    if (!fs.existsSync(DEST)) {
        fs.mkdirSync(DEST, { recursive: true });
    }

    const files = fs.readdirSync(SRC).filter((f) => f.startsWith('case-') && f.endsWith('.json')).sort();
    for (const f of files) {
        const raw = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
        fs.writeFileSync(path.join(DEST, f), JSON.stringify(raw), 'utf8');
    }
    console.log(`[PASS] Bundled ${files.length} cases to ${DEST}`);

    console.log('=== 2. Connecting to SQLite & Seeding Reports ===');
    (cds.env.requires as any).db = {
        kind: 'sqlite',
        credentials: { url: 'db.sqlite' }
    };

    (cds.model as any) = await cds.load('*');
    const db = await cds.connect.to('db');

    const result = await seedLibraryFromBundle();
    console.log('[PASS] Seeding executed:', result ? 'New cases added' : 'Cases verified/ensured');

    const repCount = await db.run('SELECT count(*) as cnt FROM cnma_proresolve_reports');
    const discCount = await db.run('SELECT count(*) as cnt FROM cnma_proresolve_disciplines');
    console.log(`Total 8D Reports in DB: ${repCount[0]?.cnt ?? repCount[0]?.CNT}`);
    console.log(`Total Disciplines in DB: ${discCount[0]?.cnt ?? discCount[0]?.CNT}`);

    console.log('=== 3. Exporting CSV seeds to db/data/ for permanent persistence ===');
    const reports = await db.run('SELECT * FROM cnma_proresolve_reports');
    const disciplines = await db.run('SELECT * FROM cnma_proresolve_disciplines');

    function toCsv(rows: any[]) {
        if (!rows || !rows.length) return '';
        const headers = Object.keys(rows[0]);
        const lines = [headers.join(';')];
        for (const r of rows) {
            const rowValues = headers.map(h => {
                const val = r[h];
                if (val === null || val === undefined) return '';
                const str = String(val).replace(/"/g, '""');
                return `"${str}"`;
            });
            lines.push(rowValues.join(';'));
        }
        return lines.join('\n');
    }

    const repCsv = toCsv(reports);
    const discCsv = toCsv(disciplines);
    fs.writeFileSync(path.join(ROOT, 'db', 'data', 'cnma.proresolve-Reports.csv'), repCsv, 'utf8');
    fs.writeFileSync(path.join(ROOT, 'db', 'data', 'cnma.proresolve-Disciplines.csv'), discCsv, 'utf8');
    console.log('[PASS] Exported cnma.proresolve-Reports.csv and cnma.proresolve-Disciplines.csv');

    console.log('=== ALL DONE SUCCESSFULLY ===');
    process.exit(0);
}

run().catch(err => {
    console.error('[ERROR]', err);
    process.exit(1);
});
