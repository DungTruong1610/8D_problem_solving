/**
 * DeepSeekLlmProvider — chat provider cho DeepSeek V4.1 Flash / V4 Pro.
 *
 * Cùng một model, ba cổng API đều nói chuẩn OpenAI `/chat/completions`:
 *
 *   | Cổng           | Base URL                          | Model ID            |
 *   |----------------|-----------------------------------|---------------------|
 *   | OpenCode Go    | https://opencode.ai/zen/go/v1     | deepseek-v4.1-flash |
 *   | OpenCode Zen   | https://opencode.ai/zen/v1        | deepseek-v4.1-flash |
 *   | DeepSeek       | https://api.deepseek.com          | deepseek-flash      |
 *
 * Chọn cổng bằng `DEEPSEEK_BASE_URL` + `DEEPSEEK_MODEL`; mặc định lấy DeepSeek
 * Platform vì đó là tên model ổn định nhất giữa các cổng.
 *
 * ── Vì sao không dùng lại `OpenAICompatibleLlmProvider` ──
 * Provider kia sinh ra cho model local (Ollama/Qwen): nó ánh xạ MỌI tên model
 * lạ về một model duy nhất, không có thinking, và tên mặc định là `qwen2.5:3b`.
 * DeepSeek cần ba thứ khác: giữ nguyên model họ `deepseek-*` khi admin chọn
 * trong AI Settings, điều khiển thinking (`thinking` + `reasoning_effort`), và
 * trả mảng RỖNG khi không có vector — để tầng trên biết là "không nhúng được"
 * thay vì ghi vector 0 vào kho (vector 0 làm cosine trả null một cách âm thầm).
 *
 * ── Thinking mặc định TẮT ──
 * API DeepSeek mặc định bật thinking với effort `high`. Với pipeline 8 bước,
 * điều đó nghĩa là mỗi bước suy luận vài chục giây và `temperature` bị bỏ qua
 * (thinking mode không hỗ trợ temperature) — trong khi prompt của app được viết
 * cho chế độ tất định. Admin bật lại cho từng activity bằng `thinkingBudget`
 * trong AI Settings, hoặc toàn cục bằng `DEEPSEEK_THINKING=on`.
 */

import crypto from 'node:crypto';
import axios, { AxiosInstance } from 'axios';
import type { LlmProvider, ToolSchema } from '@cnma/sap-aicore-integrate/types';
import type {
  CanonicalMessage,
  AIConfig,
  AIResponse,
  AIToolResponse,
  ContentPart,
} from '@cnma/sap-aicore-integrate/types';

export interface DeepSeekProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

/** Định danh client — OpenCode Go yêu cầu client tự giới thiệu, không đội lốt SDK. */
const USER_AGENT = '8d-copilot/1.0';

/**
 * Id phiên ổn định cho cả tiến trình.
 *
 * OpenCode Go dùng `x-opencode-session` để định tuyến và tối ưu prompt cache.
 * App không có khái niệm "phiên hội thoại" ở tầng HTTP, nên một id cho mỗi lần
 * boot là mức gần đúng rẻ nhất; gửi kèm còn hơn để gateway tự đoán.
 */
const SESSION_ID = crypto.randomUUID();

export class DeepSeekLlmProvider implements LlmProvider {
  public readonly name = 'deepseek';

  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private http: AxiosInstance;

  /** Đã gặp 400 vì tham số thinking chưa? Gặp rồi thì thôi không gửi nữa. */
  private thinkingRejected = false;

  constructor(options: DeepSeekProviderOptions = {}) {
    this.apiKey = options.apiKey || process.env.DEEPSEEK_API_KEY || '';
    this.baseUrl = (
      options.baseUrl ||
      process.env.DEEPSEEK_BASE_URL ||
      'https://api.deepseek.com'
    ).replace(/\/+$/, '');
    this.defaultModel =
      options.model ||
      process.env.DEEPSEEK_MODEL ||
      'deepseek-flash';

    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: options.timeoutMs ?? 180_000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'User-Agent': USER_AGENT,
        'x-opencode-session': SESSION_ID,
      },
    });
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Tên model thật sự gửi lên API.
   *
   * Model họ DeepSeek (từ AI Settings, hoặc từ `AICORE_DEFAULT_MODEL`) đi thẳng
   * qua. Mọi tên khác — `anthropic--claude-4.5-haiku`, `gemini-2.5-pro`, alias
   * còn sót trong catalog AI Core — được ánh xạ về model DeepSeek đang cấu
   * hình, để một DB cũ không làm request 404.
   */
  public getModelName(requestedModel?: string): string {
    if (!requestedModel) return this.defaultModel;
    const clean = requestedModel.trim();
    if (/^deepseek/i.test(clean)) return clean;
    return this.defaultModel;
  }

  private normalizeText(content?: string | ContentPart[]): string {
    if (!content) return '';
    if (typeof content === 'string') return content;
    return content.map((c) => (c.type === 'text' ? c.text : '')).join('\n');
  }

  /** CanonicalMessage → định dạng OpenAI, kèm tool_calls / tool_call_id. */
  private toOpenAiMessages(messages: CanonicalMessage[]): Array<Record<string, any>> {
    return messages.map((m) => {
      const msg: Record<string, any> = {
        role: m.role,
        content: this.normalizeText(m.content),
      };
      if (m.role === 'assistant' && m.toolCalls?.length) {
        msg.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.args ?? {}),
          },
        }));
      }
      if (m.role === 'tool') {
        if (m.toolCallId) msg.tool_call_id = m.toolCallId;
        if (m.name) msg.name = m.name;
      }
      return msg;
    });
  }

  /** Budget → `reasoning_effort`; dưới ngưỡng này model coi như không đáng bật. */
  private effortFor(budget: number): 'low' | 'high' | 'max' {
    if (budget <= 2048) return 'low';
    if (budget <= 16_384) return 'high';
    return 'max';
  }

  /**
   * Tham số thinking cho một lời gọi.
   *
   * `hasTools` ép TẮT: khi request mang `tools`, DeepSeek bắt buộc client trả
   * lại `reasoning_content` của mọi lượt trước, mà `CanonicalMessage` của CDK
   * không có trường đó — bật lên là chuỗi ReAct nhận HTTP 400 ở lượt thứ hai.
   */
  private thinkingParams(config: AIConfig | undefined, hasTools: boolean): Record<string, unknown> {
    // Cổng API đã từ chối tham số này một lần — gửi lại chỉ tốn thêm một vòng 400.
    if (this.thinkingRejected) return {};
    if (hasTools) return { thinking: { type: 'disabled' } };

    const budget = config?.thinkingBudget;
    if (budget === 0) return { thinking: { type: 'disabled' } };
    if (typeof budget === 'number' && budget > 0) {
      return { thinking: { type: 'enabled' }, reasoning_effort: this.effortFor(budget) };
    }

    // Không khai budget: mặc định của app là tắt, trừ khi bật bằng biến môi trường.
    if ((process.env.DEEPSEEK_THINKING || 'off').toLowerCase() === 'on') {
      const effort = (process.env.DEEPSEEK_REASONING_EFFORT || 'high').toLowerCase();
      return {
        thinking: { type: 'enabled' },
        reasoning_effort: ['low', 'high', 'max'].includes(effort) ? effort : 'high',
      };
    }
    return { thinking: { type: 'disabled' } };
  }

  /**
   * Ép JSON khi tầng trên yêu cầu.
   *
   * DeepSeek yêu cầu chữ "json" xuất hiện trong prompt thì `json_object` mới
   * hoạt động, nên schema được nhồi thẳng vào system message — giống cách
   * provider OpenAI-compatible đang làm.
   */
  private applyJsonMode(payload: Record<string, any>, config?: AIConfig): void {
    if (!(config?.responseMimeType === 'application/json' || config?.responseSchema)) return;
    payload.response_format = { type: 'json_object' };

    let instruction =
      '\n\nCRITICAL: Reply with ONLY a valid JSON object, no markdown fences, no prose.';
    if (config.responseSchema) {
      instruction += `\n\nREQUIRED JSON SCHEMA:\n${JSON.stringify(config.responseSchema, null, 2)}`;
    }
    const sys = payload.messages.find((m: any) => m.role === 'system');
    if (sys) sys.content += instruction;
    else payload.messages.unshift({ role: 'system', content: instruction.trim() });
  }

  /**
   * Gửi request, tự bỏ tham số thinking nếu cổng API chưa hỗ trợ.
   *
   * Cổng OpenAI-compatible (OpenCode Go/Zen) có thể validate schema chặt hơn
   * API gốc. Một lần 400 vì `thinking` không được nhận diện không đáng làm hỏng
   * cả lượt phân tích: bỏ tham số, ghi log, và nhớ cho các lời gọi sau.
   */
  private async postChat(payload: Record<string, any>, model: string): Promise<any> {
    try {
      const resp = await this.http.post('/chat/completions', payload);
      return resp.data;
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.error?.message || err?.message || String(err);
      const mentionsThinking = /thinking|reasoning_effort/i.test(String(detail));

      if (status === 400 && mentionsThinking && !this.thinkingRejected) {
        this.thinkingRejected = true;
        const { thinking, reasoning_effort, ...clean } = payload;
        console.warn(
          `[DeepSeek] Cổng API từ chối tham số thinking (${detail}). `
            + 'Thử lại không kèm tham số này và tắt nó cho các lời gọi sau.',
        );
        const retry = await this.http.post('/chat/completions', clean);
        return retry.data;
      }

      console.error(`[DeepSeek Provider] Lỗi gọi "${model}" tại ${this.baseUrl}:`, detail);
      throw new Error(`DeepSeek API Error (${model}): ${detail}`);
    }
  }

  public async complete(messages: CanonicalMessage[], config?: AIConfig): Promise<AIResponse> {
    const model = this.getModelName(config?.model);
    const payload: Record<string, any> = {
      model,
      messages: this.toOpenAiMessages(messages),
      temperature: config?.temperature ?? 0.2,
      ...this.thinkingParams(config, false),
    };
    if (config?.max_tokens) payload.max_tokens = config.max_tokens;
    this.applyJsonMode(payload, config);

    const data = await this.postChat(payload, model);
    const choice = data?.choices?.[0];

    return {
      content: (choice?.message?.content || '').trim(),
      usage: {
        promptTokens: data?.usage?.prompt_tokens,
        completionTokens: data?.usage?.completion_tokens,
        totalTokens: data?.usage?.total_tokens,
      },
      finishReason: choice?.finish_reason || 'stop',
    };
  }

  public async completeWithTools(
    messages: CanonicalMessage[],
    tools: ToolSchema[],
    config?: AIConfig,
  ): Promise<AIToolResponse> {
    const model = this.getModelName(config?.model);
    const payload: Record<string, any> = {
      model,
      messages: this.toOpenAiMessages(messages),
      temperature: config?.temperature ?? 0.2,
      tools: tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      })),
      ...this.thinkingParams(config, true),
    };
    if (config?.max_tokens) payload.max_tokens = config.max_tokens;

    const data = await this.postChat(payload, model);
    const choice = data?.choices?.[0];
    const msg = choice?.message;
    const functionCalls: Array<{ id?: string; name: string; args: Record<string, unknown> }> = [];

    if (Array.isArray(msg?.tool_calls)) {
      for (const tc of msg.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function?.arguments || '{}');
        } catch {
          args = { raw: tc.function?.arguments };
        }
        functionCalls.push({ id: tc.id || tc.function?.name, name: tc.function?.name, args });
      }
    }

    return {
      content: msg?.content || '',
      functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
      usage: {
        promptTokens: data?.usage?.prompt_tokens,
        completionTokens: data?.usage?.completion_tokens,
        totalTokens: data?.usage?.total_tokens,
      },
      finishReason: choice?.finish_reason || (functionCalls.length ? 'tool_calls' : 'stop'),
    };
  }

  /**
   * DeepSeek KHÔNG có API embedding — trả mảng rỗng để tầng trên bỏ qua tiêu
   * chí ngữ nghĩa thay vì ghi vector 0 vào kho.
   *
   * Muốn có vector thì cắm thêm `JINA_API_KEY` (hoặc `EMBEDDING_*`) — khi đó
   * `CompositeLlmProvider` định tuyến `embed()` sang nhà cung cấp embedding còn
   * provider này chỉ lo phần chat.
   */
  public async embed(_text: string): Promise<number[]> {
    return [];
  }

  public async batchEmbed(_texts: string[], _batchSize?: number): Promise<number[][]> {
    return [];
  }
}
