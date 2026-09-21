namespace cnma.proresolve;

using { managed } from '@sap/cds/common';

/**
 * Cấu hình AI dùng chung cho cả hệ thống — đúng MỘT dòng, khoá cố định 'GLOBAL'.
 *
 * `aiAgentConfig` là chuỗi JSON, chính là định dạng mà component của CDK đọc và
 * ghi. Hình dạng:
 *
 * {
 *   "model": "gemini-2.5-pro",              // model mặc định cho mọi activity
 *   "models": {                              // ghi đè theo từng activity
 *     "parseData":     "gemini-2.5-flash",
 *     "analyzeDefect": "gemini-2.5-pro"
 *   },
 *   "parseDataThinkingBudget": 2048,         // <activity>ThinkingBudget
 *   "maxIterations": 8
 * }
 *
 * Để dạng JSON chứ không tách cột, vì tập activity do ứng dụng khai báo và sẽ
 * thay đổi — thêm một activity mà phải migrate schema thì quá đắt.
 */
entity AiSettings : managed {
    key ID            : String(10) default 'GLOBAL';
        aiAgentConfig : LargeString;
}
