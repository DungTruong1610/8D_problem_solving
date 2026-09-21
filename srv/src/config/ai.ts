/**
 * Cấu hình tầng AI Core.
 *
 * Chỉ chứa thứ tầng tích hợp cần. Hằng số nghiệp vụ (nhiệt độ, số token, ngưỡng
 * điểm cho từng bước 8D) thuộc về module nghiệp vụ, không để ở đây.
 *
 * Mọi lời gọi model đi qua CDK `@cnma/sap-aicore-integrate` → SAP AI Core
 * Orchestration. CDK đã lo retry, timeout và semaphore — đừng thêm ở tầng này.
 */

/** Entity do CDK cung cấp, dùng khi expose registry model ra service. */
export const ENTITIES = {
  AI_MODELS: 'cnma.aicore.integrate.AIModels',
} as const;

/**
 * Model chat mặc định khi chưa cấu hình gì ở tenant hay global.
 * Ghi đè bằng biến môi trường `AICORE_DEFAULT_MODEL`.
 */
export const AICORE_DEFAULT_MODEL = process.env.AICORE_DEFAULT_MODEL || 'gemini-2.5-pro';

/**
 * Model mặc định cho những activity mà ứng dụng BIẾT là không cần model mạnh.
 *
 * ── Vì sao cần lớp này ──
 * `aiAgentConfig` chỉ khai một `model` duy nhất là mọi bước đều chạy model đó —
 * kể cả bước đổ narrative có sẵn vào ô form, vốn không suy luận gì. Đo trên một
 * lượt chạy thật: cả 5 lời gọi đều là Opus 4.8, tổng 317s.
 *
 * Bảng này nêu ý kiến cho các bước cơ khí VÀ cho `analyzeDefect`: bước viết
 * báo cáo được ghim Haiku theo quyết định sản phẩm (tốc độ trước, độ tin cậy
 * giữ bằng schema chặt + backfill tất định trong pipeline — xem
 * `postProcess.ts`). Bước suy luận thật còn lại — `reviewQuality` (chẩn đoán
 * mù) — CỐ TÌNH không có mặt ở đây, để nó nhận model mà admin đã chọn.
 *
 * Thứ tự ưu tiên khi chọn model, xem `resolveModel` ở core/ai/llmClient.ts:
 *   1. cấu hình truyền thẳng vào lời gọi
 *   2. `models[activity]` trong aiAgentConfig  ← admin ghi đè được từng bước
 *   3. bảng này
 *   4. `model` trong aiAgentConfig
 *   5. AICORE_DEFAULT_MODEL
 *
 * Đặt trên (4) là có chủ ý: `model` là lựa chọn CHUNG, không phải lời khẳng định
 * rằng bước điền form cũng đáng chạy model đắt nhất. Muốn ép, khai thẳng vào
 * `models[activity]` trên trang AI Settings — mục (2) luôn thắng bảng này.
 */
export const ACTIVITY_MODEL_DEFAULTS: Readonly<Record<string, string>> = {
  /** Trích xuất theo schema: đọc payload thô, xếp lại cho gọn. */
  parseData: process.env.AICORE_MODEL_PARSE || 'anthropic--claude-4.5-haiku',
  /** Đổ narrative đã có vào ô form đã cấu hình. Thuần cơ khí. */
  analyzeDefectStructuredFields:
    process.env.AICORE_MODEL_STRUCTURE || 'anthropic--claude-4.5-haiku',
  /**
   * Viết báo cáo D1–D8. Ghim Haiku để một lượt phân tích 8 bước xong trong
   * chục giây thay vì vài phút; phần "đúng" không phó thác cho model mà được
   * bảo đảm bằng response schema chặt và backfill tất định từ CaseContext.
   * Admin vẫn ghi đè được bằng `models.analyzeDefect` trên trang AI Settings.
   */
  analyzeDefect: process.env.AICORE_MODEL_ANALYZE || 'anthropic--claude-4.5-haiku',
};

/**
 * Model leo thang cho bước viết báo cáo.
 *
 * Chạy Haiku cho nhanh nghĩa là chấp nhận thỉnh thoảng một bước trả JSON hợp lệ
 * nhưng khuyết trường bắt buộc. Khi retry-có-chỉ-dẫn vẫn không cứu được,
 * `eightDAnalyzer` gọi đúng MỘT lượt nữa trên model này rồi lấy bản đủ hơn.
 * Lượt leo thang chỉ xảy ra trên đường hỏng — đường vui vẫn nhanh nguyên Haiku.
 *
 * Leo thang hỏng (model không tồn tại trong AI Core, hết quota, ...) thì giữ
 * kết quả Haiku — không bao giờ làm chết bước vì chính cơ chế cứu nó.
 * Đặt AICORE_MODEL_ANALYZE_FALLBACK="" để tắt hẳn.
 */
export const ANALYZE_FALLBACK_MODEL =
  process.env.AICORE_MODEL_ANALYZE_FALLBACK ?? 'anthropic--claude-4.5-sonnet';

/**
 * Số chiều vector. Phải khớp ba nơi cùng lúc:
 *   1. kiểu cột `cds.Vector(n)` trong schema
 *   2. số chiều model embedding thật sự trả về
 *   3. khai báo `dim` trong core/ai/embeddingCorpora.ts
 * CDK assert mỗi vector nhận được — lệch là ném lỗi ngay, không ghi âm thầm.
 */
export const EMBEDDING_DIM = 1536;

/**
 * Model embedding mặc định. Ghi đè bằng `AICORE_MODEL_EMBEDDING`.
 *
 * Đổi model là làm mất giá trị mọi vector đã lưu — vector của hai model không
 * nằm chung một không gian, cosine giữa chúng vô nghĩa. Đổi thì phải nhúng lại
 * toàn bộ kho.
 */
export const DEFAULT_EMBEDDING_MODEL =
  process.env.AICORE_MODEL_EMBEDDING || 'text-embedding-3-small';
