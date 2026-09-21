import cds from '@sap/cds';

export const STANDARD_TEAM_DIRECTORY = [
    {
        partnerId: '100000',
        partnerName: 'Local Developer',
        functionTitle: '8D Team Leader & Quality Champion',
        partnerRole: '8D Team Leader',
        email: 'developer@proresolve.com',
        phone: '+49 89 2018 0000',
    },
    {
        partnerId: '100001',
        partnerName: 'Heli Weber',
        functionTitle: 'Quality Engineer & 8D Facilitator',
        partnerRole: '8D Team Leader',
        email: 'heli.weber@proresolve.com',
        phone: '+49 89 2018 0001',
    },
    {
        partnerId: '100011',
        partnerName: 'Quyen La',
        functionTitle: 'Quality Technician & Line Inspector',
        partnerRole: '8D Team Member',
        email: 'quyen.la@proresolve.com',
        phone: '+49 89 2018 0011',
    },
    {
        partnerId: '100012',
        partnerName: 'Minh Dinh',
        functionTitle: 'CNC Machining Process Engineer',
        partnerRole: '8D Team Member',
        email: 'minh.dinh@proresolve.com',
        phone: '+49 89 2018 0012',
    },
    {
        partnerId: '100014',
        partnerName: 'Karl Wagner',
        functionTitle: 'Maintenance Technician & Mechanical Specialist',
        partnerRole: '8D Team Member',
        email: 'karl.wagner@proresolve.com',
        phone: '+49 89 2018 0014',
    },
    {
        partnerId: '100023',
        partnerName: 'Luis Moreno',
        functionTitle: 'Foundry & Casting Process Engineer',
        partnerRole: '8D Team Member',
        email: 'luis.moreno@proresolve.com',
        phone: '+49 89 2018 0023',
    },
    {
        partnerId: '100031',
        partnerName: 'Sara Klein',
        functionTitle: 'Supplier Quality Engineer',
        partnerRole: '8D Team Member',
        email: 'sara.klein@proresolve.com',
        phone: '+49 89 2018 0031',
    },
    {
        partnerId: '100045',
        partnerName: 'Ingo Braun',
        functionTitle: 'Manufacturing & Assembly Engineer',
        partnerRole: '8D Team Member',
        email: 'ingo.braun@proresolve.com',
        phone: '+49 89 2018 0045',
    },
    {
        partnerId: '100052',
        partnerName: 'Petra Vogel',
        functionTitle: 'Document Control Officer',
        partnerRole: '8D Team Member',
        email: 'petra.vogel@proresolve.com',
        phone: '+49 89 2018 0052',
    },
    {
        partnerId: '100061',
        partnerName: 'Anh Pham',
        functionTitle: 'Tooling & Fixture Engineer',
        partnerRole: '8D Team Member',
        email: 'anh.pham@proresolve.com',
        phone: '+49 89 2018 0061',
    },
    {
        partnerId: '100067',
        partnerName: 'Marek Nowak',
        functionTitle: 'Process Engineer - Coating & Surface Treatment',
        partnerRole: '8D Team Member',
        email: 'marek.nowak@proresolve.com',
        phone: '+49 89 2018 0067',
    },
    {
        partnerId: '100072',
        partnerName: 'Stefan Wolf',
        functionTitle: 'Electrical & Controls Automation Technician',
        partnerRole: '8D Team Member',
        email: 'stefan.wolf@proresolve.com',
        phone: '+49 89 2018 0072',
    },
    {
        partnerId: '100088',
        partnerName: 'Rita Fischer',
        functionTitle: 'Assembly Supervisor',
        partnerRole: '8D Team Member',
        email: 'rita.fischer@proresolve.com',
        phone: '+49 89 2018 0088',
    },
    {
        partnerId: '100095',
        partnerName: 'Elena Rostova',
        functionTitle: 'Materials & Metallurgy Specialist',
        partnerRole: '8D Team Member',
        email: 'elena.rostova@proresolve.com',
        phone: '+49 89 2018 0095',
    },
    {
        partnerId: '100102',
        partnerName: 'Dario Conti',
        functionTitle: 'Bonding Process Engineer',
        partnerRole: '8D Team Member',
        email: 'dario.conti@proresolve.com',
        phone: '+49 89 2018 0102',
    },
    {
        partnerId: '100112',
        partnerName: 'Thomas Meyer',
        functionTitle: 'Mechanical Maintenance Technician',
        partnerRole: '8D Team Member',
        email: 'thomas.meyer@proresolve.com',
        phone: '+49 89 2018 0112',
    },
    {
        partnerId: '100115',
        partnerName: 'Eva Lindqvist',
        functionTitle: 'Facilities Engineer',
        partnerRole: '8D Team Member',
        email: 'eva.lindqvist@proresolve.com',
        phone: '+49 89 2018 0115',
    },
    {
        partnerId: '100125',
        partnerName: 'Christian Bauer',
        functionTitle: 'Powder Coating & Painting Specialist',
        partnerRole: '8D Team Member',
        email: 'christian.bauer@proresolve.com',
        phone: '+49 89 2018 0125',
    },
    {
        partnerId: '100133',
        partnerName: 'Ola Nyberg',
        functionTitle: 'Press Shop Engineer',
        partnerRole: '8D Team Member',
        email: 'ola.nyberg@proresolve.com',
        phone: '+49 89 2018 0133',
    },
    {
        partnerId: '100138',
        partnerName: 'Tobias Berg',
        functionTitle: 'Milling & Machining Specialist',
        partnerRole: '8D Team Member',
        email: 'tobias.berg@proresolve.com',
        phone: '+49 89 2018 0138',
    },
    {
        partnerId: '100147',
        partnerName: 'Lena Hoffmann',
        functionTitle: 'Metrology Specialist & CMM Inspector',
        partnerRole: '8D Team Member',
        email: 'lena.hoffmann@proresolve.com',
        phone: '+49 89 2018 0147',
    },
];

export async function seedStandardTeamDirectory(db: any): Promise<number> {
    const existing = await db.run(
        SELECT.from('cnma.proresolve.HistoricalTeamMembers').columns('partnerId'),
    );
    const have = new Set((existing as any[]).map((r) => String(r.partnerId ?? '').replace(/^BP-/i, '')));

    let added = 0;
    for (const member of STANDARD_TEAM_DIRECTORY) {
        if (!have.has(member.partnerId)) {
            await db.run(
                INSERT.into('cnma.proresolve.HistoricalTeamMembers').entries({
                    ID: cds.utils.uuid(),
                    partnerId: member.partnerId,
                    partnerName: member.partnerName,
                    functionTitle: member.functionTitle,
                    partnerRole: member.partnerRole,
                    email: member.email,
                    phone: member.phone,
                }),
            );
            have.add(member.partnerId);
            added++;
        } else {
            // Update email, phone and functionTitle if missing
            await db.run(
                UPDATE('cnma.proresolve.HistoricalTeamMembers').set({
                    partnerName: member.partnerName,
                    functionTitle: member.functionTitle,
                    email: member.email,
                    phone: member.phone,
                }).where({ partnerId: member.partnerId }),
            );
        }
    }
    return added;
}

async function main() {
    (cds.env.requires as any).db = {
        kind: 'sqlite',
        credentials: { url: 'db.sqlite' }
    };
    (cds.model as any) = await cds.load('*');
    const db = await cds.connect.to('db');

    const added = await seedStandardTeamDirectory(db);
    console.log(`[PASS] Seeded/Updated standard team directory. Added: ${added}, Total standard profiles: ${STANDARD_TEAM_DIRECTORY.length}`);

    const count = await db.run('SELECT count(distinct partnerId) as cnt FROM cnma_proresolve_HistoricalTeamMembers');
    console.log(`[PASS] Unique partners in HistoricalTeamMembers: ${count[0]?.cnt ?? count[0]?.CNT}`);

    // Export to db/data/cnma.proresolve-HistoricalTeamMembers.csv
    const fs = require('fs');
    const path = require('path');
    const allMembers = await db.run('SELECT * FROM cnma_proresolve_HistoricalTeamMembers');
    if (allMembers && allMembers.length) {
        const headers = Object.keys(allMembers[0]);
        const lines = [headers.join(';')];
        for (const r of allMembers) {
            lines.push(headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(';'));
        }
        const dest = path.resolve(__dirname, '..', 'db', 'data', 'cnma.proresolve-HistoricalTeamMembers.csv');
        fs.writeFileSync(dest, lines.join('\n'), 'utf8');
        console.log(`[PASS] Exported ${allMembers.length} records to ${dest}`);
    }
    process.exit(0);
}

if (require.main === module) {
    main().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
