/**
 * OpenAICompatibleLlmProvider.ts
 *
 * Generic OpenAI-compatible LLM Provider for local models:
 * Ollama, LM Studio, vLLM, LocalAI, v.v. (e.g. Qwen2.5, Qwen3.5, Llama 3, DeepSeek).
 *
 * Implements LlmProvider interface from @cnma/sap-aicore-integrate/types.
 */

import axios, { AxiosInstance } from 'axios';
import type {
  LlmProvider,
  ToolSchema,
} from '@cnma/sap-aicore-integrate/types';
import type {
  CanonicalMessage,
  AIConfig,
  AIResponse,
  AIToolResponse,
  ContentPart,
} from '@cnma/sap-aicore-integrate/types';
import { EMBEDDING_DIM } from '../../config/ai';

export interface LocalLlmOptions {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export class OpenAICompatibleLlmProvider implements LlmProvider {
  public readonly name = 'local-openai-compatible';
  private baseUrl: string;
  private apiKey: string;
  private defaultModel: string;
  private http: AxiosInstance;
  private embeddingsSupported: boolean = true;

  constructor(options: LocalLlmOptions = {}) {
    this.baseUrl = (
      options.baseUrl ||
      process.env.LOCAL_LLM_URL ||
      process.env.OPENAI_BASE_URL ||
      'http://localhost:11434/v1'
    ).replace(/\/+$/, '');

    this.apiKey = options.apiKey || process.env.LOCAL_LLM_KEY || process.env.OPENAI_API_KEY || 'ollama';
    this.defaultModel = options.model || process.env.LOCAL_LLM_MODEL || 'qwen2.5:3b';

    // Model ag/* hoặc không có LOCAL_LLM_EMBEDDING_MODEL riêng thì không gọi endpoint /embeddings
    if (this.defaultModel.startsWith('ag/') && !process.env.LOCAL_LLM_EMBEDDING_MODEL) {
      this.embeddingsSupported = false;
    }

    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 180_000,
    });
  }

  private getHeaders(): Record<string, string> {
    const key = process.env.LOCAL_LLM_KEY || process.env.OPENAI_API_KEY || this.apiKey || 'ollama';
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    };
  }

  public getModelName(requestedModel?: string): string {
    const configured = process.env.LOCAL_LLM_MODEL || this.defaultModel;
    if (!requestedModel) return configured;
    const lower = requestedModel.toLowerCase();
    if (
      lower.includes('anthropic') ||
      lower.includes('claude') ||
      lower.includes('gemini-2.5') ||
      lower.includes('gemini-1.5') ||
      lower.startsWith('google--')
    ) {
      return configured;
    }
    return requestedModel;
  }

  private normalizeText(content?: string | ContentPart[]): string {
    if (!content) return '';
    if (typeof content === 'string') return content;
    return content.map((c) => (c.type === 'text' ? c.text : '')).join('\n');
  }

  private toOpenAiMessages(messages: CanonicalMessage[]): Array<{
    role: string;
    content: string;
    name?: string;
  }> {
    return messages.map((m) => {
      let role: string = m.role;
      if (role === 'tool') role = 'tool';
      return {
        role,
        content: this.normalizeText(m.content),
        ...(m.name ? { name: m.name } : {}),
      };
    });
  }

  /**
   * Plain chat completion
   */
  public async complete(
    messages: CanonicalMessage[],
    config?: AIConfig,
  ): Promise<AIResponse> {
    const model = this.getModelName(config?.model);
    const openAiMessages = this.toOpenAiMessages(messages);

    const payload: Record<string, any> = {
      model,
      messages: openAiMessages,
      temperature: config?.temperature ?? 0.2,
    };

    if (config?.max_tokens) {
      payload.max_tokens = config.max_tokens;
    }

    if (config?.responseMimeType === 'application/json' || config?.responseSchema) {
      payload.response_format = { type: 'json_object' };
      if (payload.messages.length > 0) {
        let schemaInstruction = '\n\nCRITICAL: You MUST respond ONLY with a valid JSON object matching the required schema. Do not enclose in markdown codeblocks or conversational text.';
        if (config.responseSchema) {
          schemaInstruction += `\n\nREQUIRED JSON SCHEMA:\n${JSON.stringify(config.responseSchema, null, 2)}`;
        }
        const sysMsg = payload.messages.find((m: any) => m.role === 'system');
        if (sysMsg) {
          sysMsg.content += schemaInstruction;
        } else {
          payload.messages.unshift({ role: 'system', content: schemaInstruction.trim() });
        }
      }
    }

    try {
      const resp = await this.http.post('/chat/completions', payload, {
        headers: this.getHeaders(),
      });
      const choice = resp.data?.choices?.[0];
      let content = (choice?.message?.content || '').trim();

      // Bóc markdown fences
      if (config?.responseMimeType === 'application/json' || config?.responseSchema || content.includes('```')) {
        const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (fenceMatch) {
          content = fenceMatch[1].trim();
        }
      }

      // Nếu yêu cầu JSON nhưng có văn bản dư xung quanh, trích xuất từ { đầu tiên đến } cuối cùng
      if ((config?.responseMimeType === 'application/json' || config?.responseSchema) && !content.startsWith('{')) {
        const firstBrace = content.indexOf('{');
        const lastBrace = content.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          content = content.slice(firstBrace, lastBrace + 1).trim();
        }
      }

      return {
        content,
        usage: {
          promptTokens: resp.data?.usage?.prompt_tokens,
          completionTokens: resp.data?.usage?.completion_tokens,
          totalTokens: resp.data?.usage?.total_tokens,
        },
        finishReason: choice?.finish_reason || 'stop',
      };
    } catch (err: any) {
      const detail = err?.response?.data?.error?.message || err?.message || String(err);
      console.error(`[Local LLM Error (${model})]:`, detail);
      throw new Error(`Local LLM Error (${this.baseUrl}): ${detail}`);
    }
  }

  /**
   * Chat completion with tools
   */
  public async completeWithTools(
    messages: CanonicalMessage[],
    tools: ToolSchema[],
    config?: AIConfig,
  ): Promise<AIToolResponse> {
    const model = this.getModelName(config?.model);
    const openAiMessages = this.toOpenAiMessages(messages);

    const payload: Record<string, any> = {
      model,
      messages: openAiMessages,
      temperature: config?.temperature ?? 0.2,
      tools: tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      })),
    };

    if (config?.max_tokens) {
      payload.max_tokens = config.max_tokens;
    }

    try {
      const resp = await this.http.post('/chat/completions', payload, {
        headers: this.getHeaders(),
      });
      const choice = resp.data?.choices?.[0];
      const msg = choice?.message;

      const functionCalls: Array<{
        id?: string;
        name: string;
        args: Record<string, unknown>;
      }> = [];

      if (Array.isArray(msg?.tool_calls)) {
        for (const tc of msg.tool_calls) {
          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(tc.function?.arguments || '{}');
          } catch {
            parsedArgs = { raw: tc.function?.arguments };
          }
          functionCalls.push({
            id: tc.id || tc.function?.name,
            name: tc.function?.name,
            args: parsedArgs,
          });
        }
      }

      return {
        content: msg?.content || '',
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
        usage: {
          promptTokens: resp.data?.usage?.prompt_tokens,
          completionTokens: resp.data?.usage?.completion_tokens,
          totalTokens: resp.data?.usage?.total_tokens,
        },
        finishReason: choice?.finish_reason || 'stop',
      };
    } catch (err: any) {
      const detail = err?.response?.data?.error?.message || err?.message || String(err);
      console.error(`[Local LLM Tools Error (${model})]:`, detail);
      throw new Error(`Local LLM Error (${this.baseUrl}): ${detail}`);
    }
  }

  /**
   * Single text embed
   */
  public async embed(text: string): Promise<number[]> {
    if (!this.embeddingsSupported) {
      return new Array(EMBEDDING_DIM).fill(0);
    }
    try {
      const resp = await this.http.post('/embeddings', {
        model: process.env.LOCAL_LLM_EMBEDDING_MODEL || this.defaultModel,
        input: text || ' ',
      }, { headers: this.getHeaders() });
      const data = resp.data?.data?.[0]?.embedding || [];
      return this.adjustDimensions(data, EMBEDDING_DIM);
    } catch (err: any) {
      this.embeddingsSupported = false;
      return new Array(EMBEDDING_DIM).fill(0);
    }
  }

  /**
   * Batch text embeddings
   */
  public async batchEmbed(texts: string[], _batchSize?: number): Promise<number[][]> {
    if (!texts || texts.length === 0) return [];
    if (!this.embeddingsSupported) {
      return texts.map(() => new Array(EMBEDDING_DIM).fill(0));
    }
    try {
      const resp = await this.http.post('/embeddings', {
        model: process.env.LOCAL_LLM_EMBEDDING_MODEL || this.defaultModel,
        input: texts,
      }, { headers: this.getHeaders() });
      const items = resp.data?.data || [];
      return items.map((item: any) => this.adjustDimensions(item.embedding, EMBEDDING_DIM));
    } catch {
      this.embeddingsSupported = false;
      return texts.map(() => new Array(EMBEDDING_DIM).fill(0));
    }
  }

  private adjustDimensions(vec: number[], targetDim: number = EMBEDDING_DIM): number[] {
    if (!Array.isArray(vec)) return new Array(targetDim).fill(0);
    if (vec.length === targetDim) return vec;
    if (vec.length > targetDim) return vec.slice(0, targetDim);
    const padded = new Array(targetDim).fill(0);
    for (let i = 0; i < vec.length; i++) padded[i] = vec[i];
    return padded;
  }
}
