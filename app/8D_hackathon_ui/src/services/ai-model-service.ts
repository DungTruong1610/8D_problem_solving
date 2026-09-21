import type {
    AiModelApi,
    AIModelRecord,
    AvailableModel,
    SyncModelsResult,
} from '@cnma/sap-aicore-integrate/react';
import axiosInstance from './core/axios-instance';

/**
 * Cài đặt `AiModelApi` của CDK bằng axios instance dùng chung của dự án.
 *
 * CDK cũng có sẵn `createAiModelApi()`, nhưng nó gọi `fetch` trần: không lấy CSRF
 * token, không xử lý 401/403. Sau approuter của BTP (bật csrfProtection) thì mọi
 * lời gọi POST và PATCH sẽ trả 403.
 *
 * Axios instance của dự án đã lo sẵn: lấy CSRF lười, tự thử lại khi token hết
 * hạn, reload khi 401. Dùng lại nó thay vì dựng thêm một đường mạng thứ hai.
 */

const BASE = '/api/cnma/AI_SRV';

/** CAP OData v4 gói kết quả trong `value` — bóc ra để khớp kiểu CDK mong đợi. */
function unwrap<T>(data: unknown): T {
    if (data && typeof data === 'object' && 'value' in (data as Record<string, unknown>)) {
        return (data as { value: T }).value;
    }
    return data as T;
}

let availableModelsCache: Promise<AvailableModel[]> | null = null;
let aiModelsCache: Promise<AIModelRecord[]> | null = null;

export function invalidateAiModelCache(): void {
    availableModelsCache = null;
    aiModelsCache = null;
}

function isSuitableForActivity(model: AvailableModel, activity?: string): boolean {
    if (!activity) return true;
    const activities = model.suitableActivities;
    if (!activities || !Array.isArray(activities)) return true;
    return activities.includes(activity);
}

export function createAiModelApi(): AiModelApi {
    return {
        async getAIModels(): Promise<AIModelRecord[]> {
            if (!aiModelsCache) {
                const orderby = encodeURIComponent('provider asc,modelId asc');
                aiModelsCache = axiosInstance
                    .get(`${BASE}/AIModels?$orderby=${orderby}`)
                    .then((res) => unwrap<AIModelRecord[]>(res.data) ?? [])
                    .catch((err) => {
                        aiModelsCache = null;
                        throw err;
                    });
            }
            return aiModelsCache;
        },

        async updateAIModel(id: string, data: Partial<AIModelRecord>): Promise<void> {
            await axiosInstance.patch(`${BASE}/AIModels('${id}')`, data);
            invalidateAiModelCache();
        },

        async syncModels(): Promise<SyncModelsResult> {
            const res = await axiosInstance.post(`${BASE}/syncModels`, {});
            invalidateAiModelCache();
            const raw = unwrap<string>(res.data);
            return typeof raw === 'string' ? (JSON.parse(raw) as SyncModelsResult) : raw;
        },

        async getAvailableModels(activity?: string): Promise<AvailableModel[]> {
            if (!availableModelsCache) {
                availableModelsCache = axiosInstance
                    .get(`${BASE}/getAvailableModels(activity='')`)
                    .then((res) => {
                        const raw = unwrap<string>(res.data);
                        return typeof raw === 'string' ? (JSON.parse(raw) as AvailableModel[]) : raw;
                    })
                    .catch((err) => {
                        availableModelsCache = null;
                        throw err;
                    });
            }
            const allModels = await availableModelsCache;
            if (!activity) return allModels;
            return allModels.filter((m) => isSuitableForActivity(m, activity));
        },
    };
}

/** Instance dùng chung — không cần dựng lại ở mỗi lần render. */
export const aiModelApi = createAiModelApi();

// ── Cấu hình chung: model nào chạy cho activity nào ─────────────────────────
// Không thuộc interface AiModelApi của CDK — CDK để việc lưu cho ứng dụng tự lo.

/** Chuỗi JSON `aiAgentConfig` đang lưu, hoặc `'{}'` khi chưa cấu hình gì. */
export async function getGlobalAiConfig(): Promise<string> {
    const res = await axiosInstance.get(`${BASE}/getGlobalAiConfig()`);
    return unwrap<string>(res.data) ?? '{}';
}

/** Ghi cấu hình chung. Trả về chuỗi JSON đã chuẩn hoá mà server lưu thật. */
export async function updateGlobalAiConfig(aiAgentConfig: string): Promise<string> {
    const res = await axiosInstance.post(`${BASE}/updateGlobalAiConfig`, { aiAgentConfig });
    return unwrap<string>(res.data) ?? '{}';
}
