import { CqnAnalyzer } from '@cap-js/sql-parser';
import { {{FeatureName}}Repository } from '../repository/{{FeatureName}}Repository';

/**
 * {{FeatureName}}Service - Business logic layer.
 * DIP: Depends on Repository abstraction, not implementation.
 */
export class {{FeatureName}}Service {
    constructor(
        private readonly repository: {{FeatureName}}Repository,
        private readonly cqnAnalyzer: CqnAnalyzer
    ) {}

    /**
     * Find all records with params
     */
    async findAll(params: any): Promise<any[]> {
        return this.repository.find(params);
    }

    /**
     * Find single record by ID
     */
    async findById(id: string): Promise<any> {
        return this.repository.findById(id);
    }

    /**
     * Create new record
     */
    async create(data: any, user: string): Promise<any> {
        this.setCreateManaged(data, user);
        return this.repository.create(data);
    }

    /**
     * Update existing record
     */
    async update(id: string, data: any, user: string): Promise<any> {
        this.setUpdateManaged(data, user);
        return this.repository.update(id, data);
    }

    /**
     * Delete record
     */
    async delete(id: string): Promise<void> {
        return this.repository.delete(id);
    }

    /**
     * Validate before create
     */
    async validateCreate(data: any): Promise<{ valid: boolean; message: string }> {
        // Custom validation rules here
        return { valid: true, message: 'Valid' };
    }

    /**
     * Validate before update
     */
    async validateUpdate(data: any): Promise<{ valid: boolean; message: string }> {
        // Custom validation rules here
        return { valid: true, message: 'Valid' };
    }

    /**
     * After create hook
     */
    async afterCreate(data: any, user: string): Promise<void> {
        // Custom post-create logic (audit, notifications, etc.)
        cds.log.info(`[{{FeatureName}}] Created by ${user}:`, data);
    }

    /**
     * After update hook
     */
    async afterUpdate(data: any, user: string): Promise<void> {
        cds.log.info(`[{{FeatureName}}] Updated by ${user}:`, data);
    }

    /**
     * After delete hook
     */
    async afterDelete(data: any): Promise<void> {
        cds.log.info(`[{{FeatureName}}] Deleted:`, data);
    }

    /**
     * Custom action execution
     */
    async executeCustomAction(param: any, user: string): Promise<any> {
        // Implement custom action logic
        return { result: `Action executed: ${param}` };
    }

    // ===== Protected helpers =====
    protected setCreateManaged(data: any, owner: string): void {
        data.createdAt = new Date().toISOString();
        data.createdBy = owner;
        data.modifiedAt = new Date().toISOString();
        data.modifiedBy = owner;
    }

    protected setUpdateManaged(data: any, owner: string): void {
        data.modifiedAt = new Date().toISOString();
        data.modifiedBy = owner;
    }
}