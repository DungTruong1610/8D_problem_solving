/**
 * OpenAiEmbeddingLlmProvider — nhúng vector qua bất kỳ API chuẩn OpenAI
 * `/v1/embeddings`.
 *
 * Mặc định nhắm Jina AI (`https://api.jina.ai/v1`, model
 * `jina-embeddings-v5-text-small`) vì DeepSeek không có API embedding, còn
 * Gemini thì app đang muốn bỏ. Đổi nhà cung cấp bằng `EMBEDDING_BASE_URL` /
 * `EMBEDDING_MODEL` / `EMBEDDING_API_KEY` — Mistral, OpenAI, LM Studio, vLLM…
 * đều dùng chung một hình dạng request.
 *
 * ── Vì sao trả mảng rỗng thay vì vector 0 khi lỗi ──
 * `cosineSimilarity` coi vector 0 là "không so được" và trả `null`, nhưng chỉ
 * sau khi kho đã bị ghi toàn số 0 kèm nhãn model hợp lệ. Lần nhúng sau thấy
 * `embeddingModel` khớp nên bỏ qua luôn — kho nhiễm độc vĩnh viễn, và tiêu chí
 * ngữ nghĩa im lặng cho 0 điểm. Ném lỗi ở đây để `embedLibrary` đếm vào cột
 * `failed` và để `embedQuery` bỏ tiêu chí ngữ nghĩa một cách tường minh.
 */

import axios, { AxiosInstance } from 'axios';
import type { LlmProvider, ToolSchema } from '@cnma/sap-aicore-integrate/types';
import type {
  CanonicalMessage,
  AIConfig,
  AIResponse,
  AIToolResponse,
} from '@cnma/sap-aicore-integrate/types';
import { EMBEDDING_DIM } from '../../config/ai';

export interface OpenAiEmbeddingOptions {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  /** LoRA task cho câu truy vấn (Jina: `retrieval.query`). */
  queryTask?: string;
  /** LoRA task cho văn bản được đánh chỉ mục (Jina: `retrieval.passage`). */
  passageTask?: string;
  timeoutMs?: number;
}

export class OpenAiEmbeddingLlmProvider implements LlmProvider {
  public readonly name = 'openai-compatible-embedding';

  private apiKey: string;
  private model: string;
  private queryTask?: string;
  private passageTask?: string;
  private http: AxiosInstance;

  /**
   * Đã gặp lỗi vì tham số `task` chưa. Nhà cung cấp không hỗ trợ task (OpenAI,
   * LM Studio…) sẽ trả 400 cho field lạ; bỏ nó đi vẫn nhúng được bình thường.
   */
  private taskRejected = false;

  constructor(options: OpenAiEmbeddingOptions = {}) {
    const baseUrl = (
      options.baseUrl ||
      process.env.EMBEDDING_BASE_URL ||
      'https://api.jina.ai/v1'
    ).replace(/\/+$/, '');

    this.apiKey =
      options.apiKey ||
      process.env.EMBEDDING_API_KEY ||
      process.env.JINA_API_KEY ||
      '';

    this.model = options.model || process.env.EMBEDDING_MODEL || 'jina-embeddings-v5-text-small';
    this.queryTask = options.queryTask ?? process.env.EMBEDDING_QUERY_TASK ?? 'retrieval.query';
    this.passageTask = options.passageTask ?? process.env.EMBEDDING_TASK ?? 'retrieval.passage';

    this.http = axios.create({
      baseURL: baseUrl,
      timeout: options.timeoutMs ?? 60_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /** Model đang dùng — cũng là nhãn ghi kèm mỗi vector trong DB. */
  public getEmbeddingModelName(): string {
    return this.model;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  private authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.apiKey}` };
  }

  /** Chat không thuộc provider này — composite định tuyến phần đó đi nơi khác. */
  public async complete(_messages: CanonicalMessage[], _config?: AIConfig): Promise<AIResponse> {
    throw new Error('OpenAI embedding provider không hỗ trợ chat completion.');
  }

  public async completeWithTools(
    _messages: CanonicalMessage[],
    _tools: ToolSchema[],
    _config?: AIConfig,
  ): Promise<AIToolResponse> {
    throw new Error('OpenAI embedding provider không hỗ trợ chat completion.');
  }

  public async embed(text: string): Promise<number[]> {
    const vectors = await this.request([text || ' '], this.queryTask);
    return vectors[0] ?? [];
  }

  public async batchEmbed(texts: string[], _batchSize?: number): Promise<number[][]> {
    if (!texts || texts.length === 0) return [];
    return this.request(
      texts.map((t) => t || ' '),
      this.passageTask,
    );
  }

  /**
   * Một lượt gọi `/embeddings`. Lỗi `task` không được phép làm hỏng lượt nhúng:
   * thử lại đúng một lần, không kèm `task`, rồi mới ném.
   */
  private async request(inputs: string[], task?: string): Promise<number[][]> {
    const payload: Record<string, unknown> = { model: this.model, input: inputs };
    if (task && !this.taskRejected) payload.task = task;

    try {
      const resp = await this.post(payload);
      return this.toVectors(resp.data);
    } catch (err: any) {
      const detail = err?.response?.data?.error?.message || err?.message || String(err);
      const status = err?.response?.status;

      if (payload.task && status === 400 && !this.taskRejected) {
        this.taskRejected = true;
        console.warn(
          `[Embedding] Nhà cung cấp từ chối tham số "task" (${detail}) — `
            + 'thử lại không kèm tham số này; chất lượng truy hồi có thể giảm nhẹ.',
        );
        const retryPayload = { model: this.model, input: inputs };
        const retry = await this.post(retryPayload);
        return this.toVectors(retry.data);
      }

      console.error(`[Embedding] Lỗi nhúng bằng "${this.model}":`, detail);
      throw new Error(`Embedding API Error (${this.model}): ${detail}`);
    }
  }

  private async post(payload: Record<string, unknown>) {
    return this.http.post('/embeddings', payload, { headers: this.authHeaders() });
  }

  /** Chuẩn hoá response OpenAI; kích thước về đúng EMBEDDING_DIM của schema. */
  private toVectors(data: any): number[][] {
    const items = Array.isArray(data?.data) ? data.data : [];
    if (!items.length) {
      throw new Error('Embedding API trả về danh sách rỗng.');
    }
    return items.map((item: any) => this.adjustDimensions(item?.embedding));
  }

  /**
   * Cắt hoặc đệm cho đủ `targetDim`.
   *
   * Jina v5-text-small trả 1024 chiều, schema CDS khai `cds.Vector(1536)`. Đệm
   * số 0 KHÔNG làm sai cosine: các chiều 0 không đóng góp vào tích vô hướng và
   * không đổi độ dài vector.
   */
  private adjustDimensions(vec: unknown, targetDim: number = EMBEDDING_DIM): number[] {
    if (!Array.isArray(vec)) throw new Error('Embedding API trả về vector không hợp lệ.');
    if (vec.length === targetDim) return vec as number[];
    if (vec.length > targetDim) return (vec as number[]).slice(0, targetDim);
    const padded = new Array(targetDim).fill(0);
    for (let i = 0; i < vec.length; i++) padded[i] = vec[i];
    return padded;
  }
}
