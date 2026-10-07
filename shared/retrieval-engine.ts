/**
 * Engine nào ĐÃ THẬT SỰ chạy để tìm tiền lệ — để UI, log và Verify nói cùng một
 * câu.
 *
 * ── Vì sao cần ──
 * "Không có tiền lệ" và "engine không chạy được" nhìn ngoài giống hệt nhau: một
 * danh sách rỗng. Graph không sẵn sàng thì rơi về chấm điểm; không có khoá
 * embedding thì tiêu chí ngữ nghĩa lặng lẽ bị bỏ. Trước đây chỉ có log biết điều
 * đó — người xem màn hình thì không. Giờ kết quả mang theo nhãn của chính nó.
 *
 * Đặt ở `shared/` để backend (ghi) và frontend (đọc) dùng chung một hình dạng.
 */

export type RetrievalEngine = 'graph' | 'scoring' | 'none';

/**
 * used            tiêu chí ngữ nghĩa có tham gia chấm.
 * not-configured  profile không bật tiêu chí ngữ nghĩa — không phải lỗi.
 * unavailable     profile cần nhưng không nhúng được (không có provider / gọi hỏng).
 * n/a             engine graph không dùng embedding.
 */
export type SemanticStatus = 'used' | 'not-configured' | 'unavailable' | 'n/a';

export interface RetrievalEngineInfo {
    engine: RetrievalEngine;
    semantic: SemanticStatus;
    /** Vì sao phải dùng đường dự phòng (graph không chạy / không nhúng được). Null khi không. */
    fallbackReason: string | null;
    /** Một nhãn ngắn người đọc hiểu, dựng bởi `engineLabel`. */
    label: string;
}

export function engineLabel(info: Omit<RetrievalEngineInfo, 'label'>): string {
    if (info.engine === 'none') return 'Precedent search did not run';
    if (info.engine === 'graph') return 'Graph retrieval';
    const fellBackFromGraph = Boolean(info.fallbackReason) && info.semantic !== 'unavailable';
    if (info.semantic === 'unavailable') return 'Scoring fallback — semantic search unavailable';
    if (fellBackFromGraph) return 'Scoring fallback — graph unavailable';
    if (info.semantic === 'used') return 'Attribute + semantic scoring';
    return 'Attribute scoring';
}

export function makeEngineInfo(info: Omit<RetrievalEngineInfo, 'label'>): RetrievalEngineInfo {
    return { ...info, label: engineLabel(info) };
}

/** Đọc lại từ JSON đã lưu; dữ liệu cũ không có trường này thì trả null — "không biết", không đoán. */
export function readEngineInfo(value: unknown): RetrievalEngineInfo | null {
    if (!value || typeof value !== 'object') return null;
    const v = value as Record<string, unknown>;
    const engines: RetrievalEngine[] = ['graph', 'scoring', 'none'];
    const semantics: SemanticStatus[] = ['used', 'not-configured', 'unavailable', 'n/a'];
    if (!engines.includes(v.engine as RetrievalEngine) || !semantics.includes(v.semantic as SemanticStatus)) return null;
    const base = {
        engine: v.engine as RetrievalEngine,
        semantic: v.semantic as SemanticStatus,
        fallbackReason: typeof v.fallbackReason === 'string' ? v.fallbackReason : null,
    };
    return { ...base, label: typeof v.label === 'string' && v.label ? v.label : engineLabel(base) };
}
