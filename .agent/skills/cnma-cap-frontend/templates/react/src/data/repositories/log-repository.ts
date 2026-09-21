import type { ILogRepository, LogQueryParams } from "../../domain/repositories/ILogRepository";
import type { LogRecord } from "../../domain/entities/LogRecord";
import { LogDataSource } from "../datasources/LogDataSource";
import { Result } from "../../core/Result";

export class LogRepository implements ILogRepository {
    private dataSource: LogDataSource;

    constructor() {
        this.dataSource = new LogDataSource();
    }

    public async getLogs(params: LogQueryParams): Promise<Result<{ data: LogRecord[], count: number }>> {
        const result = await this.dataSource.fetchLogs(params);
        if (result.isFailure) {
            return Result.fail(result.error!);
        }

        const response = result.getValue();
        return Result.ok({
            data: response.value,
            count: response['@odata.count'] || 0
        });
    }

    public async getLogById(id: string): Promise<Result<LogRecord>> {
        // Reuse fetchLogs with filter
        const result = await this.getLogs({
            $filter: `ID eq ${id} or ID eq '${id}'`, // Check CAP UUID format
            $top: 1
        });

        if (result.isFailure) return Result.fail(result.error!);

        const data = result.getValue().data;
        if (data.length === 0) return Result.fail("Log not found");

        return Result.ok(data[0]);
    }

    public async reprocessLog(id: string): Promise<Result<void>> {
        // Need ID and other keys. Usually passed from UI context.
        // For now stubbed. Real impl needs objectType/Key from the log record first.
        // Step 1: Get Log to get keys (if not passed)
        const logResult = await this.getLogById(id);
        if (logResult.isFailure) return Result.fail(logResult.error!);

        const log = logResult.getValue();

        // Step 2: Call Action
        return this.dataSource.reprocessLog(id, {
            objectType: log.objectType,
            objectKey: log.objectKey,
            objectProcessingTimestamp: log.objectProcessingTimestamp,
            ID: log.ID
        });
    }

    public async reprocessBulk(): Promise<Result<void>> {
        return Result.fail("Not implemented");
    }

    public async reprocessByFilter(filter: string): Promise<Result<void>> {
        const result = await this.dataSource.reprocessByFilter(filter);
        if (result.isFailure) return Result.fail(result.error!);
        return Result.ok(undefined);
    }

    public async exportData(filter: string): Promise<Result<LogRecord[]>> {
        const result = await this.dataSource.exportData(filter);
        if (result.isFailure) return Result.fail(result.error!);
        const response: any = result.getValue();
        return Result.ok(response.value || []);
    }

    public async getObjectTypes(): Promise<Result<string[]>> {
        const result = await this.dataSource.fetchObjectTypes();
        if (result.isFailure) return Result.fail(result.error!);
        const response = result.getValue();
        return Result.ok(response.value.map(item => item.objectType));
    }
}
