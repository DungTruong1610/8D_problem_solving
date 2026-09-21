import cds from '@sap/cds';
import { IdentityProvisioner } from '@cnma/cap-identity/srv';

const log = cds.log('identity');
const LOCAL_ADMIN_USER_ID = 'admin@conarum.com';

function isLocalAdmin(req: cds.Request): boolean {
    return cds.env.requires.auth?.kind === 'mocked' && req.user?.id === 'admin';
}

async function resolveCurrentShadowUser(req: cds.Request, ShadowUsers: any) {
    const tx = cds.tx(req);

    if (isLocalAdmin(req)) {
        const existing = await tx.run(
            cds.ql.SELECT.one.from(ShadowUsers).where({
                origin: 'sap.default',
                userId: LOCAL_ADMIN_USER_ID,
            }),
        );

        if (existing) {
            await tx.run(cds.ql.UPDATE.entity(ShadowUsers).where({ ID: existing.ID }).set({ lastLoginAt: new Date() }));
            return { ...existing, lastLoginAt: new Date() };
        }

        await tx.run(cds.ql.INSERT.into(ShadowUsers).entries({
            origin: 'sap.default',
            userId: LOCAL_ADMIN_USER_ID,
            email: LOCAL_ADMIN_USER_ID,
            firstName: 'Local',
            lastName: 'Developer',
            displayName: 'Local Developer',
            isActive: true,
            lastLoginAt: new Date(),
        }));

        return tx.run(cds.ql.SELECT.one.from(ShadowUsers).where({
            origin: 'sap.default',
            userId: LOCAL_ADMIN_USER_ID,
        }));
    }

    const origin = IdentityProvisioner.getOrigin(req.user);
    const provisioned = await IdentityProvisioner.provisionUser(req.user);
    return provisioned ?? tx.run(
        cds.ql.SELECT.one.from(ShadowUsers).where({ origin, userId: req.user.id }),
    );
}

/**
 * Register app-owned identity actions ahead of the package handlers.
 * cap-identity 1.0.25 resolves these entities from srv.entities, which can be
 * incomplete when the package service is imported and re-annotated by this app.
 */
export function registerIdentityHandlers(srv: cds.ApplicationService): void {
    srv.prepend(() => {
        srv.on('me', async (req) => {
            if (!req.user?.id) {
                return req.reject(401, 'Not authenticated');
            }

            const { ShadowUsers, GroupMembers } = cds.entities('cnma.identity');

            if (!ShadowUsers || !GroupMembers) {
                log.error('Identity persistence entities are missing from the loaded CDS model');
                return req.reject(500, 'Identity model is not available');
            }

            const tx = cds.tx(req);
            const shadowUser = await resolveCurrentShadowUser(req, ShadowUsers);

            if (!shadowUser) {
                return req.reject(404, 'User not found after provisioning');
            }

            const memberships = await tx.run(
                cds.ql.SELECT.from(GroupMembers).columns('group_ID').where({ user_ID: shadowUser.ID }),
            );

            return {
                ...shadowUser,
                isAdmin: req.user.is('admin') || req.user.is('Admin'),
                groupIds: memberships.map((membership: { group_ID: string }) => membership.group_ID),
            };
        });

        srv.on('resolveGroupMembers', async (req) => {
            const { groupId } = req.data;
            if (!groupId) return req.reject(400, 'groupId is required');

            const { ShadowUsers, GroupMembers } = cds.entities('cnma.identity');
            const tx = cds.tx(req);
            const memberships = await tx.run(
                cds.ql.SELECT.from(GroupMembers).columns('user_ID').where({ group_ID: groupId }),
            );
            const userIds = memberships.map((membership: { user_ID: string }) => membership.user_ID);

            if (userIds.length === 0) return [];
            return tx.run(cds.ql.SELECT.from(ShadowUsers).where({ ID: { in: userIds }, isActive: true }));
        });

        srv.on('getUserGroups', async (req) => {
            const { userId } = req.data;
            if (!userId) return req.reject(400, 'userId is required');

            const { ShadowGroups, GroupMembers } = cds.entities('cnma.identity');
            const tx = cds.tx(req);
            const memberships = await tx.run(
                cds.ql.SELECT.from(GroupMembers).columns('group_ID').where({ user_ID: userId }),
            );
            const groupIds = memberships.map((membership: { group_ID: string }) => membership.group_ID);

            if (groupIds.length === 0) return [];
            return tx.run(cds.ql.SELECT.from(ShadowGroups).where({ ID: { in: groupIds }, isActive: true }));
        });
    });
}
