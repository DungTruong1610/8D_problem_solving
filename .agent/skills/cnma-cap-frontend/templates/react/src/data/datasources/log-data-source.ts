import { HttpClient } from "./HttpClient";
import { AppConfig } from "../../core/AppConfig";
import type { LogRecordResponse } from "../../domain/entities/LogRecord";
import type { LogQueryParams } from "../../domain/repositories/ILogRepository";
import { Result } from "../../core/Result";

export class LogDataSource {
    private client: HttpClient;

    constructor() {
        this.client = HttpClient.getInstance();
    }

    public async fetchLogs(params: LogQueryParams): Promise<Result<LogRecordResponse>> {
        return this.client.get<LogRecordResponse>(AppConfig.API_BASE_URL + AppConfig.ENDPOINTS.LOGS, {
            params: params
        });
    }

    public async reprocessLog(_id: string, context?: any): Promise<Result<void>> {
        // Implementation for Reprocess Action (POST)
        // CAP Action: /reprocessErrorLog
        // Payload: { objectType, objectKey, objectProcessingTimestamp, ID }
        // Note: For now we assume context contains necessary fields
        return this.client.post<void>(AppConfig.API_BASE_URL + AppConfig.ENDPOINTS.REPROCESS, context);
    }

    public async reprocessByFilter(filter: string): Promise<Result<void>> {
        // CAP Action: /reprocessByFilter(filter='...') (POST)
        // Since it's an action, we use POST.
        return this.client.post<void>(`${AppConfig.API_BASE_URL}/reprocessByFilter`, {
            filter: filter
        });
    }

    public async exportData(filter: string): Promise<Result<LogRecordResponse>> {
        // CAP Function: /exportData(filter='...')
        // Note: OData functions are usually GET requests with parameters in brackets or query params.
        // If it's a bound function or unbound, syntax varies.
        // Assuming unbound function: /exportData(filter='...')
        const url = `${AppConfig.API_BASE_URL}/exportData(filter='${filter}')`;
        return this.client.get<LogRecordResponse>(url);
    }

    public async fetchObjectTypes(): Promise<Result<{ value: { objectType: string }[] }>> {
        return this.client.get<{ value: { objectType: string }[] }>(AppConfig.API_BASE_URL + "/VH_ObjectType");
    }
}
