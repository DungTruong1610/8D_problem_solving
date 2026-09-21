/**
 * GeminiLlmProvider.ts
 *
 * Standalone Google Gemini API Provider implementation for 8D Hackathon / CNMA Proresolve.
 * Implements LlmProvider interface from @cnma/sap-aicore-integrate/types.
 *
 * Allows running 100% independently from SAP AI Core by simply configuring:
 * GEMINI_API_KEY=...
 * GEMINI_MODEL=gemini-2.5-flash (or gemini-3.7-flash, gemini-2.5-pro, etc.)
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

export interface GeminiProviderOptions {
  apiKey?: string;
  defaultModel?: string;
  embeddingModel?: string;
  baseUrl?: string;
}

export class GeminiLlmProvider implements LlmProvider {
  public readonly name = 'gemini';
  private apiKey: string;
  private defaultModel: string;
  private embeddingModel: string;
  private baseUrl: string;
  private http: AxiosInstance;

  constructor(options: GeminiProviderOptions = {}) {
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || '';
    this.defaultModel =
      options.defaultModel ||
      process.env.GEMINI_MODEL ||
      process.env.AICORE_DEFAULT_MODEL ||
      'gemini-2.5-flash';
    this.embeddingModel =
      options.embeddingModel ||
      process.env.GEMINI_EMBEDDING_MODEL ||
      'text-embedding-004';
    this.baseUrl =
      options.baseUrl ||
      process.env.GEMINI_API_BASE_URL ||
      'https://generativelanguage.googleapis.com/v1beta';

    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 120_000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  public getModelName(requestedModel?: string): string {
    if (!requestedModel) return this.defaultModel;
    // Map Claude/OpenAI model names or SAP AI Core aliases if passed
    const clean = requestedModel.toLowerCase();
    if (clean.includes('gemini')) {
      // Remove sap prefixes if any, e.g. "google--gemini-2.5-pro" -> "gemini-2.5-pro"
      return requestedModel.replace(/^google--/i, '');
    }
    // If an Anthropic or OpenAI model was configured as default, route to configured GEMINI_MODEL
    return this.defaultModel;
  }

  private normalizeTextContent(content?: string | ContentPart[]): string {
    if (!content) return '';
    if (typeof content === 'string') return content;
    return content
      .map((part) => (part.type === 'text' ? part.text : ''))
      .join('\n');
  }

  private formatCanonicalMessages(messages: CanonicalMessage[]): {
    systemInstruction?: { parts: Array<{ text: string }> };
    contents: Array<{
      role: 'user' | 'model';
      parts: Array<Record<string, any>>;
    }>;
  } {
    const systemParts: string[] = [];
    const contents: Array<{
      role: 'user' | 'model';
      parts: Array<Record<string, any>>;
    }> = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        const txt = this.normalizeTextContent(msg.content);
        if (txt) systemParts.push(txt);
        continue;
      }

      if (msg.role === 'user') {
        const parts: Array<Record<string, any>> = [];
        if (typeof msg.content === 'string') {
          parts.push({ text: msg.content });
        } else if (Array.isArray(msg.content)) {
          for (const p of msg.content) {
            if (p.type === 'text') {
              parts.push({ text: p.text });
            } else if (p.type === 'image') {
              parts.push({
                inlineData: {
                  mimeType: p.mimeType,
                  data: p.dataBase64,
                },
              });
            }
          }
        }
        contents.push({ role: 'user', parts });
      } else if (msg.role === 'assistant') {
        const parts: Array<Record<string, any>> = [];
        const txt = this.normalizeTextContent(msg.content);
        if (txt) {
          parts.push({ text: txt });
        }
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          for (const tc of msg.toolCalls) {
            parts.push({
              functionCall: {
                name: tc.name,
                args: tc.args || {},
              },
            });
          }
        }
        contents.push({ role: 'model', parts });
      } else if (msg.role === 'tool') {
        // Tool result sent back to model
        let parsedResult: any = msg.content;
        if (typeof msg.content === 'string') {
          try {
            parsedResult = JSON.parse(msg.content);
          } catch {
            parsedResult = { result: msg.content };
          }
        }
        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: msg.name || 'tool_response',
                response:
                  typeof parsedResult === 'object' && parsedResult !== null
                    ? parsedResult
                    : { result: parsedResult },
              },
            },
          ],
        });
      }
    }

    return {
      systemInstruction:
        systemParts.length > 0
          ? { parts: systemParts.map((t) => ({ text: t })) }
          : undefined,
      contents,
    };
  }

  /**
   * Plain chat completion
   */
  public async complete(
    messages: CanonicalMessage[],
    config?: AIConfig,
  ): Promise<AIResponse> {
    const model = this.getModelName(config?.model);
    const { systemInstruction, contents } = this.formatCanonicalMessages(messages);

    const generationConfig: Record<string, any> = {};
    if (config?.temperature !== undefined) {
      generationConfig.temperature = config.temperature;
    }
    if (config?.max_tokens !== undefined) {
      generationConfig.maxOutputTokens = config.max_tokens;
    }
    if (config?.responseMimeType) {
      generationConfig.responseMimeType = config.responseMimeType;
    }
    if (config?.responseSchema) {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseSchema = config.responseSchema;
    }
    if (config?.thinkingBudget !== undefined && config.thinkingBudget > 0) {
      generationConfig.thinkingConfig = {
        thinkingBudget: config.thinkingBudget,
      };
    }

    const payload: Record<string, any> = {
      contents,
    };
    if (systemInstruction) {
      payload.systemInstruction = systemInstruction;
    }
    if (Object.keys(generationConfig).length > 0) {
      payload.generationConfig = generationConfig;
    }

    const url = `/models/${model}:generateContent?key=${this.apiKey}`;
    try {
      const resp = await this.http.post(url, payload);
      const data = resp.data;
      const candidate = data.candidates?.[0];
      const textParts = (candidate?.content?.parts || [])
        .map((p: any) => p.text || '')
        .join('');

      return {
        content: textParts,
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount,
          completionTokens: data.usageMetadata?.candidatesTokenCount,
          totalTokens: data.usageMetadata?.totalTokenCount,
        },
        finishReason: candidate?.finishReason || 'stop',
      };
    } catch (err: any) {
      const detail =
        err?.response?.data?.error?.message || err?.message || String(err);
      console.error(`[Gemini Provider] Error generating content with model "${model}":`, detail);
      throw new Error(`Google Gemini API Error (${model}): ${detail}`);
    }
  }

  /**
   * Chat completion with tool calling
   */
  public async completeWithTools(
    messages: CanonicalMessage[],
    tools: ToolSchema[],
    config?: AIConfig,
  ): Promise<AIToolResponse> {
    const model = this.getModelName(config?.model);
    const { systemInstruction, contents } = this.formatCanonicalMessages(messages);

    const generationConfig: Record<string, any> = {};
    if (config?.temperature !== undefined) {
      generationConfig.temperature = config.temperature;
    }
    if (config?.max_tokens !== undefined) {
      generationConfig.maxOutputTokens = config.max_tokens;
    }

    const geminiTools = [
      {
        functionDeclarations: tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      },
    ];

    const payload: Record<string, any> = {
      contents,
      tools: geminiTools,
    };
    if (systemInstruction) {
      payload.systemInstruction = systemInstruction;
    }
    if (Object.keys(generationConfig).length > 0) {
      payload.generationConfig = generationConfig;
    }

    const url = `/models/${model}:generateContent?key=${this.apiKey}`;
    try {
      const resp = await this.http.post(url, payload);
      const data = resp.data;
      const candidate = data.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      const textParts = parts.map((p: any) => p.text || '').join('');
      const functionCalls: Array<{
        id?: string;
        name: string;
        args: Record<string, unknown>;
      }> = [];

      for (const p of parts) {
        if (p.functionCall) {
          functionCalls.push({
            id: p.functionCall.name,
            name: p.functionCall.name,
            args: p.functionCall.args || {},
          });
        }
      }

      return {
        content: textParts,
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount,
          completionTokens: data.usageMetadata?.candidatesTokenCount,
          totalTokens: data.usageMetadata?.totalTokenCount,
        },
        finishReason: candidate?.finishReason || (functionCalls.length > 0 ? 'tool_calls' : 'stop'),
      };
    } catch (err: any) {
      const detail =
        err?.response?.data?.error?.message || err?.message || String(err);
      console.error(`[Gemini Provider] Error calling tools with model "${model}":`, detail);
      throw new Error(`Google Gemini API Error (${model}): ${detail}`);
    }
  }

  /**
   * Adjust vector dimensions to targetDim (default 1536)
   */
  private adjustDimensions(vec: number[], targetDim: number = EMBEDDING_DIM): number[] {
    if (!Array.isArray(vec)) return new Array(targetDim).fill(0);
    if (vec.length === targetDim) return vec;
    if (vec.length > targetDim) return vec.slice(0, targetDim);
    // Pad with zeros if smaller (e.g. 768 -> 1536)
    const padded = new Array(targetDim).fill(0);
    for (let i = 0; i < vec.length; i++) {
      padded[i] = vec[i];
    }
    return padded;
  }

  /**
   * Embed single text
   */
  public async embed(text: string): Promise<number[]> {
    const url = `/models/${this.embeddingModel}:embedContent?key=${this.apiKey}`;
    try {
      const resp = await this.http.post(url, {
        model: `models/${this.embeddingModel}`,
        content: {
          parts: [{ text: text || ' ' }],
        },
        outputDimensionality: EMBEDDING_DIM,
      });
      const values = resp.data?.embedding?.values || [];
      return this.adjustDimensions(values, EMBEDDING_DIM);
    } catch (err: any) {
      // Fallback try without outputDimensionality parameter if model doesn't support it
      try {
        const retryResp = await this.http.post(url, {
          model: `models/${this.embeddingModel}`,
          content: {
            parts: [{ text: text || ' ' }],
          },
        });
        const values = retryResp.data?.embedding?.values || [];
        return this.adjustDimensions(values, EMBEDDING_DIM);
      } catch (retryErr: any) {
        const detail =
          retryErr?.response?.data?.error?.message || retryErr?.message || String(retryErr);
        console.error(`[Gemini Provider] Error embedding content:`, detail);
        // Return zero vector instead of crashing application
        return new Array(EMBEDDING_DIM).fill(0);
      }
    }
  }

  /**
   * Batch text embeddings
   */
  public async batchEmbed(texts: string[], batchSize: number = 20): Promise<number[][]> {
    if (!texts || texts.length === 0) return [];
    const results: number[][] = [];

    // Process in batches
    for (let i = 0; i < texts.length; i += batchSize) {
      const chunk = texts.slice(i, i + batchSize);
      const url = `/models/${this.embeddingModel}:batchEmbedContents?key=${this.apiKey}`;
      const requests = chunk.map((t) => ({
        model: `models/${this.embeddingModel}`,
        content: { parts: [{ text: t || ' ' }] },
        outputDimensionality: EMBEDDING_DIM,
      }));

      try {
        const resp = await this.http.post(url, { requests });
        const embeddings = resp.data?.embeddings || [];
        for (let j = 0; j < chunk.length; j++) {
          const vals = embeddings[j]?.values || [];
          results.push(this.adjustDimensions(vals, EMBEDDING_DIM));
        }
      } catch {
        // If batch fails, fallback to sequential single embed
        for (const item of chunk) {
          const v = await this.embed(item);
          results.push(v);
        }
      }
    }

    return results;
  }
}
