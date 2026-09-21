/**
 * CLAIR2 AI activity registry — the single source of truth for per-activity
 * model routing (@cnma/sap-aicore-integrate).
 *
 * Registered on BOTH bundles (the registry is per-bundle):
 * - backend: srv/server.ts (before bootstrap)
 * - frontend: app/cnma_ai_agent_extraction_ui/src/main.tsx (before first render)
 *
 * Keys are what call sites pass to resolveActivityModel(aiAgentConfig, key);
 * budgetKey names the aiAgentConfig field holding that activity's thinking
 * budget. Embeddings are deliberately NOT activities — the embedding model must
 * stay uniform across the stored vector corpus, so it cannot vary per object
 * type or per activity. Both embedding models are org-wide instead, picked in
 * Admin → AI Models → Embeddings and stored in the `EMBEDDING_MODELS`
 * SystemConfiguration row (see srv/lib/ai/EmbeddingModelConfig.ts). Changing one
 * requires re-embedding that corpus, which is why it lives on its own tab.
 */
/**
 * Định nghĩa activity — KHAI BÁO TẠI CHỖ, cố ý KHÔNG import từ CDK.
 *
 * ── Vì sao ──
 * File này được import từ CẢ HAI bundle, nhưng phía frontend nằm trong
 * `app/8D_hackathon_ui` — một Root Directory riêng trên Vercel, nơi
 * `node_modules` của repo gốc KHÔNG được cài. Mọi bare import trong file này sẽ
 * không giải được ở đó:
 *
 *     ../../shared/ai-activities/index.ts(18,10): error TS2307:
 *     Cannot find module '@cnma/sap-aicore-integrate/react/shared'
 *
 * Kiểu dưới đây khớp CẤU TRÚC với `AiActivity` của
 * `@cnma/sap-aicore-integrate/react/shared`, nên `registerActivities()` ở cả hai
 * phía vẫn nhận (TypeScript so cấu trúc, không so tên). Chính CDK cũng dặn
 * "keep this module dependency-free (no server/DOM imports) so both bundles can
 * import it" — đây là hệ quả của lời dặn đó.
 *
 * Thêm activity mới thì khai đúng các trường ở đây; KHÔNG thêm import.
 */
export interface AiActivity {
    key: string;
    label: string;
    description: string;
    /** Capabilities model nên có cho activity này (chỉ để hiển thị ở UI admin). */
    requiredCapabilities?: string[];
    /** Khoá `aiAgentConfig` giữ thinking/reasoning budget của activity này. */
    budgetKey?: string;
}

export const EIGHTD_ACTIVITIES: AiActivity[] = [
    {
        key: 'parseData',
        label: 'Parse input data',
        description:
            'Read the incoming data and turn it into structure: numbers, codes, tables. This is transcription rather than judgement, so a fast and cheap model is usually enough.',
        budgetKey: 'parseDataThinkingBudget',
    },
    {
        key: 'analyzeDefect',
        label: 'Analyse defect',
        description:
            'Reason over the parsed data to find the cause. This is the step that needs the strongest model — get it wrong and everything downstream is worthless.',
        budgetKey: 'analyzeDefectThinkingBudget',
    },
    {
        key: 'draftContent',
        label: 'Draft content',
        description:
            'Write prose from data that already exists. Needs phrasing, but must stay tied to the data.',
        budgetKey: 'draftContentThinkingBudget',
    },
    {
        key: 'reviewQuality',
        label: 'Review quality',
        description:
            'Grade content written by a human or by AI against fixed criteria. Keep temperature at 0 so the same input always yields the same verdict.',
        budgetKey: 'reviewQualityThinkingBudget',
    },
    {
        key: 'evaluateQuality',
        label: 'Evaluate report quality',
        /*
         * Tách khỏi `reviewQuality` chứ không dùng lại nó.
         *
         * `reviewQuality` đang gánh hai việc không liên quan: chẩn đoán mù và
         * re-rank tiền lệ. Nhét judge vào thành ba việc chia nhau một tuyến model
         * và một thinking budget — admin không còn định tuyến riêng được cho việc
         * nào, mà ba việc này có nhu cầu khác nhau hẳn: judge đọc CẢ báo cáo và
         * cần ngữ cảnh dài, re-rank đọc mươi đoạn ngắn.
         */
        description:
            'Grade a finished 8D report on writing quality: grounded, coherent, honest about gaps, specific, methodologically disciplined, actionable. Reads the whole report, so it needs a long context. Keep temperature at 0 — the same report must always get the same score, or two evaluation runs cannot be compared.',
        budgetKey: 'evaluateQualityThinkingBudget',
    },
];
