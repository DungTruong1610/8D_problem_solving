import cds, { SELECT, INSERT, UPDATE, DELETE } from '@sap/cds';

/**
 * {{FeatureName}}Repository - Data access layer.
 * SRP: Only handles CQN queries, no business logic.
 */
export class {{FeatureName}}Repository {
    private entity: any;

    constructor(entityName: string) {
        this.entity = cds.entities[entityName];
    }

    /**
     * Find records with filters
     */
    async find(params: any): Promise<any[]> {
        return cds.run(SELECT.from(this.entity).where(params));
    }

    /**
     * Find single record by ID
     */
    async findById(id: string): Promise<any> {
        const results = await cds.run(
            SELECT.from(this.entity).where({ ID: id }).limit(1)
        );
        return results[0] || null;
    }

    /**
     * Find with expand relations
     */
    async findWithExpand(id: string, expandFields: string[]): Promise<any> {
        return cds.run(
            SELECT.from(this.entity)
                .where({ ID: id })
                .expand(expandFields)
                .limit(1)
        );
    }

    /**
     * Create new record
     */
    async create(data: any): Promise<any> {
        return cds.run(INSERT.into(this.entity).entries(data));
    }

    /**
     * Create multiple records (batch)
     */
    async createBatch(data: any[]): Promise<any[]> {
        return cds.run(INSERT.into(this.entity).entries(data));
    }

    /**
     * Update record by ID
     */
    async update(id: string, data: any): Promise<any> {
        return cds.run(
            UPDATE.entity(this.entity)
                .where({ ID: id })
                .data(data)
        );
    }

    /**
     * Delete record by ID
     */
    async delete(id: string): Promise<void> {
        await cds.run(DELETE.from(this.entity).where({ ID: id }));
    }

    /**
     * Count records with filters
     */
    async count(params: any): Promise<number> {
        const result = await cds.run(
            SELECT.from(this.entity).where(params).columns('count(*) as cnt')
        );
        return result[0]?.cnt || 0;
    }

    /**
     * Check if record exists
     */
    async exists(id: string): Promise<boolean> {
        const count = await this.count({ ID: id });
        return count > 0;
    }
}