/**
 * Chọn provider AI cho tiến trình, dựa hoàn toàn vào biến môi trường.
 *
 * ── Thứ tự ưu tiên ──
 * Chat:        DeepSeek  →  Gemini  →  LLM local (Ollama/OpenAI-compatible)  →  AI Core
 * Embedding:   EMBEDDING_* / Jina  →  Gemini  →  (không có)
 *
 * Đặt DeepSeek lên đầu vì đó là cấu hình của bản deploy hackathon: `DEEPSEEK_API_KEY`
 * xuất hiện là mọi lượt chat đi DeepSeek. Không có key thì rơi về Gemini như cũ,
 * rồi tới LLM local — dev nào đang chạy Ollama không bị ảnh hưởng.
 *
 * AI Core không nằm trong danh sách này: nó là provider MẶC ĐỊNH của CDK khi
 * không có provider nào được cắm (`setLlmProvider` không được gọi). Chỉ khi cần
 * ghép AI Core với một nhà cung cấp embedding bên ngoài thì mới dựng
 * `OrchestrationProvider` tường minh.
 */

import { OrchestrationProvider } from '@cnma/sap-aicore-integrate/llm';
import type { LlmProvider } from '@cnma/sap-aicore-integrate/types';
import { DeepSeekLlmProvider } from './deepseekProvider';
import { OpenAiEmbeddingLlmProvider } from './openAiEmbeddingProvider';
import { GeminiLlmProvider } from './geminiProvider';
import { OpenAICompatibleLlmProvider } from './openAiCompatibleProvider';

export interface ProviderChoice {
  provider: LlmProvider | null;
  /** Tên ngắn để ghi log — người vận hành đọc dòng này khi AI trả lời sai. */
  label: string;
  /** Chi tiết: endpoint, model… */
  detail: string;
}

/** Có credential AI Core trong môi trường? (không kiểm tra kết nối) */
export function hasAiCoreCredentials(): boolean {
  return Boolean(
    process.env.AICORE_SERVICE_KEY ||
      (process.env.AICORE_AUTH_URL && process.env.AICORE_CLIENT_ID),
  );
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((v) => v && v.trim().length > 0);
}

/**
 * Provider chat.
 *
 * Thứ tự DeepSeek → Gemini → local là chủ ý: bản deploy đặt `DEEPSEEK_API_KEY`,
 * máy dev nào còn `GEMINI_API_KEY` cũ vẫn chạy Gemini cho tới khi họ đổi, và
 * `LOCAL_LLM_URL` của Ollama chỉ thắng khi hai cái trên vắng mặt.
 */
export function resolveChatProvider(): ProviderChoice {
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey && deepseekKey.trim().length > 0) {
    const provider = new DeepSeekLlmProvider();
    return {
      provider,
      label: 'DeepSeek',
      detail: `model "${provider.getModelName()}", endpoint "${firstNonEmpty(
        process.env.DEEPSEEK_BASE_URL,
      ) ?? 'https://api.deepseek.com'}"`,
    };
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey.trim().length > 0) {
    const provider = new GeminiLlmProvider();
    return {
      provider,
      label: 'Google Gemini',
      detail: `model "${provider.getModelName()}"`,
    };
  }

  const localUrl = firstNonEmpty(process.env.LOCAL_LLM_URL, process.env.OPENAI_BASE_URL);
  if (localUrl) {
    const provider = new OpenAICompatibleLlmProvider();
    return {
      provider,
      label: 'LLM local (OpenAI-compatible)',
      detail: `endpoint "${localUrl}", model "${provider.getModelName()}"`,
    };
  }

  return { provider: null, label: hasAiCoreCredentials() ? 'SAP AI Core' : 'none', detail: '' };
}

/**
 * Provider embedding.
 *
 * Nhánh đầu nhận cả Jina lẫn mọi API chuẩn OpenAI (`EMBEDDING_*`), vì cùng một
 * hình dạng request. Nhánh Gemini giữ lại cho ai đã có key Google — nó không
 * còn là mặc định nhưng vẫn dùng được.
 */
export function resolveEmbeddingProvider(): ProviderChoice {
  if ((process.env.EMBEDDINGS_DISABLED || '').toLowerCase() === 'true') {
    return { provider: null, label: 'disabled (EMBEDDINGS_DISABLED=true)', detail: '' };
  }

  const embeddingKey = firstNonEmpty(process.env.EMBEDDING_API_KEY, process.env.JINA_API_KEY);
  const embeddingUrl = firstNonEmpty(process.env.EMBEDDING_BASE_URL);
  if (embeddingKey || embeddingUrl) {
    const provider = new OpenAiEmbeddingLlmProvider();
    return {
      provider,
      label: 'OpenAI-compatible embedding',
      detail: `model "${provider.getEmbeddingModelName()}", endpoint "${
        firstNonEmpty(process.env.EMBEDDING_BASE_URL) ?? 'https://api.jina.ai/v1'
      }"`,
    };
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey.trim().length > 0 && (process.env.EMBEDDINGS_VIA_GEMINI || 'true') !== 'false') {
    const provider = new GeminiLlmProvider();
    return {
      provider,
      label: 'Google Gemini (chỉ embedding)',
      detail: `embedding model "${process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004'}"`,
    };
  }

  return { provider: null, label: 'none', detail: '' };
}

/** Có nguồn vector nào không — dùng để cảnh báo sớm thay vì ghi vector rỗng. */
export function hasEmbeddingBackend(): boolean {
  return resolveEmbeddingProvider().provider !== null;
}

/** Provider AI Core tường minh — chỉ cần khi ghép với embedding bên ngoài. */
export function createAiCoreProvider(): LlmProvider {
  return new OrchestrationProvider();
}

/**
 * Provider chat giả cho tình huống chỉ có embedding mà không có chat.
 *
 * Trả JSON như mock cũ để mọi activity vẫn "chạy" mà không gọi mạng — dùng được
 * cho demo UI khi chưa cấu hình model chat.
 *
 * `embed()` trả MẢNG RỖNG, không phải vector 0: tầng trên phân biệt được "không
 * có vector" (bỏ tiêu chí ngữ nghĩa) với "có vector nhưng toàn số 0" (vector rác
 * có thể lọt vào kho).
 */
export function createMockChatProvider(): LlmProvider {
  return {
    name: 'mock-chat',
    async complete(messages: any[], config?: any) {
      return {
        content: JSON.stringify({ mock: true, model: config?.model, messageCount: messages.length }),
        finishReason: 'stop',
      };
    },
    async completeWithTools(_messages: any[], tools: any[], config?: any) {
      return {
        content: JSON.stringify({ mock: true, tools: tools.length, model: config?.model }),
        finishReason: 'stop',
      };
    },
    async embed() {
      return [];
    },
    async batchEmbed(texts: string[]) {
      return texts.map(() => []);
    },
  } as unknown as LlmProvider;
}
