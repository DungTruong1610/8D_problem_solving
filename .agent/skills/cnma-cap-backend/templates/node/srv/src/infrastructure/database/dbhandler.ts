import cds from '@sap/cds';
import { SELECT, INSERT, UPDATE, DELETE } from '@sap/cds/pg';
import { createLogger } from '../../common/util/Logger';
import { HttpStatusCode } from '../../common/enum/HttpStatusCodeEnum';
import { ServiceResponse } from '../../common/model/core/ApiResponse';

const logger = createLogger('DBHandler');

/**
 * DBHandler - Generic database operations with transaction management.
 *
 * This belongs in Infrastructure layer because:
 * - Manages database connections and transactions
 * - Handles low-level CQN operations
 * - Domain layer should not know about DB implementation
 *
 * Usage: Repository classes extend this to inherit common CRUD with transactions.
 */
export abstract class DBHandler {
    protected tx: cds.Transaction;

    constructor() {
        this.tx = cds.tx(cds.context);
    }

    /**
     * Execute SELECT query with optional conditions.
     */
    protected async select<T>(
        entity: any,
        conditions?: any,
        options?: { columns?: any[]; limit?: number; skip?: number }
    ): Promise<T[]> {
        let query = SELECT.from(entity);

        if (conditions && conditions !== '*') {
            query = query.where(conditions);
        }

        if (options?.columns) {
            query = query.columns(options.columns);
        }

        if (options?.limit !== undefined) {
            query = query.limit(options.limit, options.skip ?? 0);
        }

        const results = await this.tx.run(query);
        await this.tx.commit();
        return results as T[];
    }

    /**
     * Insert single record.
     */
    protected async insert<T>(entity: any, data: any): Promise<T> {
        const results = await this.tx.run(INSERT.into(entity).entries(data));
        await this.tx.commit();
        return results as T;
    }

    /**
     * Insert multiple records (batch).
     */
    protected async insertBatch<T>(entity: any, entries: any[]): Promise<T[]> {
        const results = await this.tx.run(INSERT.into(entity).entries(entries));
        await this.tx.commit();
        return results as T[];
    }

    /**
     * Update records matching conditions.
     */
    protected async update(entity: any, conditions: any, data: any): Promise<number> {
        const result = await this.tx.run(
            UPDATE.entity(entity).where(conditions).data(data)
        );
        await this.tx.commit();
        return result;
    }

    /**
     * Delete records matching conditions.
     */
    protected async delete(entity: any, conditions: any): Promise<void> {
        await this.tx.run(DELETE.from(entity).where(conditions));
        await this.tx.commit();
    }

    /**
     * Execute custom CQN query.
     */
    protected async execute(query: any): Promise<any> {
        const results = await this.tx.run(query);
        await this.tx.commit();
        return results;
    }

    /**
     * Execute with manual transaction control.
     */
    protected async executeWithTx<T>(fn: () => Promise<T>): Promise<T> {
        try {
            const result = await fn();
            await this.tx.commit();
            return result;
        } catch (error) {
            await this.tx.rollback().catch((err) => {
                logger.error('Rollback error', { error: err });
            });
            throw error;
        }
    }

    /**
     * Rollback on error (call in catch block).
     */
    protected async rollback(error?: any): Promise<void> {
        await this.tx.rollback().catch((err) => {
            logger.error('Rollback error', { error: err });
        });
        if (error) {
            logger.error('Transaction failed', { error });
        }
    }

    /**
     * Build ServiceResponse for get operations.
     */
    protected buildGetResponse<T>(results: T[]): ServiceResponse<T> {
        const statusCode = results && results.length > 0
            ? HttpStatusCode.OK
            : HttpStatusCode.NOT_FOUND;
        const message = results && results.length > 0
            ? 'Data retrieved successfully'
            : 'No data found';
        return new ServiceResponse(statusCode, message, results);
    }
}