/**
 * VariantSettingsHandler - Event handler for VariantSettings feature.
 * Follows SRP: Delegates business logic to VariantSettingsService.
 */
import cds from '@sap/cds';
import { BaseHandler } from './BaseHandler';
import { VariantSettingsService } from '../service/VariantSettingsService';
import { ActionResponse } from '../../../common/model/ActionResponse';
import { CqnAnalyzer } from '@cap-js/sql-parser';

export = (srv: cds.ApplicationService) => {
    const service = new VariantSettingsService();
    const handler = new VariantSettingsHandler(srv, service);

    // READ Event - Filter by current user
    srv.on('READ', 'VariantSettings', async (req) => {
        return await handler.onRead(req);
    });

    // CREATE Event - Check conflict and clear default
    srv.before('CREATE', 'VariantSettings', async (req) => {
        return await handler.onBeforeCreate(req);
    });

    // Custom Action - Adjust default variant
    srv.on('adjustDefaultVariantSetting', async (req) => {
        return await handler.onAdjustDefaultVariant(req);
    });
};

/**
 * VariantSettingsHandler - Handles variant CRUD events.
 */
class VariantSettingsHandler extends BaseHandler {
    constructor(srv: any, private service: VariantSettingsService) {
        super(srv, new CqnAnalyzer());
    }

    async onRead(req: any): Promise<any[]> {
        const userId = this.getUser(req);
        const queryRaw = req.query as any;
        const reqConditions = queryRaw.SELECT?.where || [];

        return await this.service.findByUser(userId, reqConditions);
    }

    async onBeforeCreate(req: any): Promise<void> {
        const userId = this.getUser(req);
        const data = req.data;

        // Check for conflict
        const hasConflict = await this.service.checkConflict(data, userId);
        if (hasConflict) {
            req.error(409, 'Variant is conflicted');
            return;
        }

        // If setting as default, clear other defaults
        if (data.isDefaultVariant) {
            await this.service.clearDefaultVariants(userId);
        }
    }

    async onAdjustDefaultVariant(req: any): Promise<any> {
        const userId = this.getUser(req);
        return await this.service.adjustDefaultVariantSetting(req.data, userId);
    }
}