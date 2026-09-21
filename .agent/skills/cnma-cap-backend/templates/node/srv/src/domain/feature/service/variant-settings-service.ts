/**
 * VariantSettings Service - Business logic for variant management.
 * Handles CRUD operations and variant-specific business rules.
 */
import { BaseService } from '../../common/service/BaseService';
import { {{FeatureName}}Repository } from '../repository/{{FeatureName}}Repository';
import cds from '@sap/cds';
import { SELECT, UPDATE } from '@sap/cds/pg';
import { ActionResponse } from '../../common/model/ActionResponse';

export class VariantSettingsService extends BaseService {
    private repository: {{FeatureName}}Repository;

    constructor() {
        super();
        this.repository = new {{FeatureName}}Repository('VariantSettings');
    }

    /**
     * Find all variant settings for a user.
     */
    async findByUser(userId: string, conditions?: any[]): Promise<any[]> {
        const baseConditions = [{ ref: ['createdBy'] }, '=', { val: userId }];

        if (conditions && conditions.length > 0) {
            return this.repository.findWithConditions(['(', ...conditions, ')', 'and', ...baseConditions]);
        }

        return this.repository.find({ createdBy: userId });
    }

    /**
     * Check for variant conflict (same key + name + workListId + user).
     */
    async checkConflict(data: any, userId: string): Promise<boolean> {
        const { variantKey, variantName, workListId } = data;
        const conflicts = await this.repository.find({
            variantKey,
            variantName,
            workListId,
            createdBy: userId,
        });
        return conflicts.length > 0;
    }

    /**
     * Clear all default variants for a user.
     */
    async clearDefaultVariants(userId: string): Promise<void> {
        await cds.run(
            UPDATE('VariantSettings')
                .set({ isDefaultVariant: false })
                .where({ createdBy: userId })
        );
    }

    /**
     * Set a variant as default.
     */
    async setDefaultVariant(uuid: string, userId: string): Promise<void> {
        await this.clearDefaultVariants(userId);
        await cds.run(
            UPDATE('VariantSettings')
                .set({ isDefaultVariant: true })
                .where({ ID: uuid })
        );
    }

    /**
     * Adjust default variant setting action.
     */
    async adjustDefaultVariantSetting(data: any, userId: string): Promise<any> {
        const { clearAllDefault, uuid } = data;

        // 1. Clear all default variants for user
        await this.clearDefaultVariants(userId);

        // 2. If just clearing, return success
        if (clearAllDefault) {
            return ActionResponse.ok('Adjust Variant Setting success');
        }

        // 3. Validate UUID provided
        if (!uuid) {
            return ActionResponse.error('Require provide uuid of variant setting to set it as default');
        }

        // 4. Check variant exists
        const variant = await this.repository.findById(uuid);
        if (!variant) {
            return ActionResponse.error('Variant is not found');
        }

        // 5. Set as default
        await this.setDefaultVariant(uuid, userId);
        return ActionResponse.ok('Adjust Variant Setting success');
    }
}