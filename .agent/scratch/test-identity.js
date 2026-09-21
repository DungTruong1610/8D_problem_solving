const cds = require('@sap/cds');

async function test() {
    try {
        console.log('Connecting to CAP services...');
        const srv = await cds.serve('IdentityService').from('srv/IdentityService.cds');
        console.log('IdentityService served successfully at path:', srv.path);

        const supportTypes = await srv.run(SELECT.from('IdentityService.SupportTypes'));
        console.log('SupportTypes count:', supportTypes.length, supportTypes);

        const shadowUsers = await srv.run(
            SELECT.from('IdentityService.ShadowUsers').columns((u) => {
                u('*'), u.memberships((m) => {
                    m('*'), m.group((g) => {
                        g.ID, g.name, g.type((t) => t.code);
                    });
                });
            })
        );
        console.log('ShadowUsers count:', shadowUsers.length);
        console.log('ALL TESTS PASSED SUCCESSFULLY!');
        process.exit(0);
    } catch (err) {
        console.error('ERROR in IdentityService:', err);
        process.exit(1);
    }
}

test();
