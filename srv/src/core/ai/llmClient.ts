import {
  getLlmProvider,
  setLlmProvider,
  resolveActivityModel,
  configureEmbeddings,
  getEmbeddingSettings,
} from '@cnma/sap-aicore-integrate/llm';
import type {
  CanonicalMessage,
  AIConfig,
  AIResponse,
  AIToolResponse,
  ToolSchema,
} from '@cnma/sap-aicore-integrate/types';
import {
  ACTIVITY_MODEL_DEFAULTS,
  AICORE_DEFAULT_MODEL,
  EMBEDDING_DIM,
  DEFAULT_EMBEDDING_MODEL,
} from '../../config/ai';
import { APP_EMBEDDING_CORPORA } from './embeddingCorpora';
import { getGlobalModelConfig } from './globalModelConfig';

/**
 * Lớp bọc mỏng quanh OrchestrationProvider của CDK.
 *
 * Chỉ thêm ba thứ:
 *   1. Chọn model theo activity: cấu hình theo tenant → mặc định của app
 *   2. Truyền thinking budget từ aiAgentConfig
 *   3. Đường mock `MOCK_LLM=true` cho unit test
 *
 * **KHÔNG thêm retry, cache hay timeout** — CDK đã lo hết qua llmSemaphore và
 * withRetries. Thêm ở đây là nhân đôi số lần gọi thật.
 */

/** Tuỳ chọn chung cho mọi lời gọi qua client này. */
export interface LlmCallOptions extends AIConfig {
  /** Khoá activity đã đăng ký ở core/ai/activities.ts. Bắt buộc. */
  activity: string;
  /** aiAgentConfig của tenant — chuỗi JSON hoặc object đã parse. */
  aiAgentConfig?: Record<string, unknown> | string | null;
}

/** Vector 0 đúng số chiều đã đăng ký — không random, để phân biệt được lần chạy mock. */
function zeroVector(): number[] {
  return new Array(APP_EMBEDDING_CORPORA[0].dim).fill(0);
}

import { GeminiLlmProvider } from './geminiProvider';
import { OpenAICompatibleLlmProvider } from './openAiCompatibleProvider';

let providerInitialized = false;

function installMockProvider(reason: string): void {
  setLlmProvider({
    name: 'mock',
    async complete(messages: CanonicalMessage[], config?: AIConfig): Promise<AIResponse> {
      return {
        content: JSON.stringify({ mock: true, model: config?.model, messageCount: messages.length }),
        finishReason: 'stop',
      };
    },
    async completeWithTools(
      _messages: CanonicalMessage[],
      tools: ToolSchema[],
      config?: AIConfig,
    ): Promise<AIToolResponse> {
      return {
        content: JSON.stringify({ mock: true, tools: tools.length, model: config?.model }),
        finishReason: 'stop',
      };
    },
    async embed(_text: string): Promise<number[]> {
      return zeroVector();
    },
    async batchEmbed(texts: string[]): Promise<number[][]> {
      return texts.map(() => zeroVector());
    },
  });
  console.log(`[ai/llmClient] Chế độ Mock LLM đang hoạt động: ${reason}.`);
}

export function ensureLlmProvider(): void {
  if (providerInitialized) return;

  if (process.env.MOCK_LLM === 'true') {
    installMockProvider('MOCK_LLM=true trong .env');
    providerInitialized = true;
    return;
  }

  // 1. Kiểm tra Local LLM (Ollama, LM Studio, vLLM với Qwen)
  const localLlmUrl = process.env.LOCAL_LLM_URL || process.env.OPENAI_BASE_URL;
  if (localLlmUrl && localLlmUrl.trim().length > 0) {
    const provider = new OpenAICompatibleLlmProvider();
    setLlmProvider(provider);
    console.log(
      `[ai/llmClient] Local LLM Provider (Qwen/OpenAI-compatible) đã kích hoạt! URL: "${localLlmUrl}", Model: "${provider.getModelName()}".`,
    );
    providerInitialized = true;
    return;
  }

  // 2. Kiểm tra Google Gemini API
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey.trim().length > 0) {
    const provider = new GeminiLlmProvider();
    setLlmProvider(provider);
    console.log(
      `[ai/llmClient] Google Gemini API Provider đã kích hoạt (Model: "${provider.getModelName()}").`,
    );
    providerInitialized = true;
    return;
  }

  const hasAiCore = Boolean(
    process.env.AICORE_SERVICE_KEY ||
    (process.env.AICORE_AUTH_URL && process.env.AICORE_CLIENT_ID)
  );

  if (!hasAiCore) {
    installMockProvider('Chưa cấu hình GEMINI_API_KEY hoặc LOCAL_LLM_URL trong .env');
    console.warn(
      '[ai/llmClient] Chưa cấu hình GEMINI_API_KEY hoặc LOCAL_LLM_URL trong .env — hệ thống tự động chạy Mock Mode để web vẫn hoạt động trơn tru mà không lỗi.',
    );
    providerInitialized = true;
    return;
  }

  providerInitialized = true;
}



/** Đọc `models[activity]` mà KHÔNG rơi về `model` chung. */
function explicitActivityModel(
  cfg: Record<string, unknown> | string | null | undefined,
  activity: string,
): string | undefined {
  const parsed = typeof cfg === 'string' ? safeParseConfig(cfg) : (cfg ?? undefined);
  const models = parsed?.models as Record<string, unknown> | undefined;
  const value = models?.[activity];
  return typeof value === 'string' && value ? value : undefined;
}

/**
 * Chọn model cho một activity.
 *
 * Thứ tự ưu tiên:
 *   1. cấu hình truyền thẳng vào lời gọi (theo tenant / theo đối tượng)
 *   2. `models[activity]` của cấu hình chung — trang AI Settings ghi đè từng bước
 *   3. `ACTIVITY_MODEL_DEFAULTS` — ý kiến của ứng dụng cho các bước cơ khí
 *   4. `model` của cấu hình chung — lựa chọn mặc định cho phần còn lại
 *   5. `AICORE_DEFAULT_MODEL`
 *
 * (3) đứng TRÊN (4) là có chủ ý: `model` là một lựa chọn chung, không phải lời
 * khẳng định rằng bước điền form cũng đáng chạy model đắt nhất. Xem chú thích
 * dài ở `config/ai.ts`. Muốn ép một bước cụ thể thì khai `models[activity]` —
 * mục (2) luôn thắng.
 */
async function resolveModel(
  activity: string,
  aiAgentConfig?: LlmCallOptions['aiAgentConfig'],
): Promise<string> {
  const perCall = resolveActivityModel(aiAgentConfig ?? null, activity);
  if (perCall) return perCall;

  const globalCfg = await getGlobalModelConfig();

  const explicit = explicitActivityModel(globalCfg, activity);
  if (explicit) return explicit;

  const appDefault = ACTIVITY_MODEL_DEFAULTS[activity];
  if (appDefault) return appDefault;

  const globalModel = resolveActivityModel(globalCfg, activity);
  if (globalModel) return globalModel;

  return AICORE_DEFAULT_MODEL;
}

function safeParseConfig(cfg: LlmCallOptions['aiAgentConfig']): Record<string, unknown> | undefined {
  if (!cfg) return undefined;
  if (typeof cfg !== 'string') return cfg;
  try {
    return JSON.parse(cfg) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/** Đọc `<activity>ThinkingBudget` từ aiAgentConfig; bỏ qua giá trị không hợp lệ. */
function resolveThinkingBudget(
  activity: string,
  aiAgentConfig: LlmCallOptions['aiAgentConfig'],
  fallback?: number,
): number | undefined {
  const value = safeParseConfig(aiAgentConfig)?.[`${activity}ThinkingBudget`];
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  return fallback;
}

/**
 * Ngưỡng thinking budget tối thiểu của Anthropic. Dưới mức này thì extended
 * thinking không bật được — budget 0 hay 256 với Claude đều là no-op.
 */
const CLAUDE_MIN_THINKING_BUDGET = 1024;

/**
 * Bỏ thinking budget vô nghĩa TRƯỚC khi nó tới CDK.
 *
 * CDK cứ thấy `thinkingBudget` là gắn `thinking_budget` vào params cho model
 * Claude — KỂ CẢ khi budget là 0 — rồi `applyVendorCompat` thấy có
 * `thinking_budget` là xoá `temperature` (Anthropic cấm temperature đi kèm
 * extended thinking). Hệ quả đo được: mọi lượt `stepAnalyze` khai
 * `temperature: 0.2, thinkingBudget: 0` thực chất chạy Haiku ở temperature
 * mặc định 1.0 — đây chính là nguồn bất định làm D4 lúc ra ishikawa lúc không.
 *
 * Budget dưới ngưỡng 1024 của Anthropic không bao giờ bật được thinking, nên bỏ
 * nó đi không mất gì mà lấy lại được temperature. Budget hợp lệ (>= 1024) vẫn
 * truyền nguyên — khi đó temperature bị xoá là ĐÚNG luật của Anthropic.
 * Gemini/GPT không bị đụng: với Gemini 2.5, budget 0 có nghĩa thật (tắt thinking).
 */
export function effectiveThinkingBudget(model: string, budget: number | undefined): number | undefined {
  if (budget === undefined) return undefined;
  const isClaude = /claude|anthropic/i.test(model);
  if (isClaude && budget < CLAUDE_MIN_THINKING_BUDGET) return undefined;
  return budget;
}

async function buildConfig(options: LlmCallOptions): Promise<AIConfig> {
  const { activity, aiAgentConfig, thinkingBudget: fallbackBudget, ...rest } = options;
  if (!activity) throw new Error('llmClient: bắt buộc phải truyền options.activity');

  // Thinking budget cũng theo thứ tự: lời gọi → cấu hình chung → giá trị dự phòng.
  const globalCfg = await getGlobalModelConfig();
  const resolvedBudget =
    resolveThinkingBudget(activity, aiAgentConfig, undefined) ??
    resolveThinkingBudget(activity, globalCfg, fallbackBudget);

  const model = rest.model ?? (await resolveModel(activity, aiAgentConfig));
  const thinkingBudget = effectiveThinkingBudget(model, resolvedBudget);

  return {
    ...rest,
    model,
    ...(thinkingBudget !== undefined && { thinkingBudget }),
  };
}

/** Chat completion thường. */
export async function complete(
  messages: CanonicalMessage[],
  options: LlmCallOptions,
): Promise<AIResponse> {
  ensureLlmProvider();
  return getLlmProvider().complete(messages, await buildConfig(options));
}

/** Chat completion có khai báo tool (vòng lặp ReAct). */
export async function completeWithTools(
  messages: CanonicalMessage[],
  tools: ToolSchema[],
  options: LlmCallOptions,
): Promise<AIToolResponse> {
  ensureLlmProvider();
  return getLlmProvider().completeWithTools(messages, tools, await buildConfig(options));
}

/** Nhúng một đoạn văn bản. */
export async function embed(text: string): Promise<number[]> {
  ensureLlmProvider();
  return getLlmProvider().embed(text);
}

/** Nhúng nhiều đoạn văn bản, giữ nguyên thứ tự đầu vào. */
export async function batchEmbed(texts: string[], batchSize?: number): Promise<number[][]> {
  ensureLlmProvider();
  return getLlmProvider().batchEmbed(texts, batchSize);
}

/**
 * Chốt model và số chiều embedding cho cả tiến trình.
 *
 * Gọi một lần lúc bootstrap. Khi nào cho admin chọn model trong UI thì gọi lại
 * mỗi lần cài đặt đổi — và nhớ nhúng lại toàn bộ kho, vì vector cũ không còn so
 * sánh được với vector mới.
 */
export function initEmbeddings(): void {
  ensureLlmProvider();
  configureEmbeddings({ model: DEFAULT_EMBEDDING_MODEL, dim: EMBEDDING_DIM });
  const active = getEmbeddingSettings();
  console.log(`[ai/llmClient] Embedding: "${active.model}" (${active.dim} chiều)`);
}

/**
 * Model embedding đang có hiệu lực.
 *
 * Phải ghi kèm MỖI vector: vector của hai model khác nhau không so sánh được, và
 * nếu không lưu lại thì sau này không có cách nào biết vector nào sinh bằng gì.
 */
export function currentEmbeddingModel(): string {
  return getEmbeddingSettings().model;
}

/** Số chiều đang có hiệu lực — dùng để chặn ghi vector sai kích thước. */
export function currentEmbeddingDim(): number {
  return getEmbeddingSettings().dim;
}

export { resolveModel };
