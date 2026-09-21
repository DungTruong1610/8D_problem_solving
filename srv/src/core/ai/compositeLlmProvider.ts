/**
 * CompositeLlmProvider — ghép hai provider rời thành một.
 *
 * Tình huống thật: chat chạy DeepSeek V4.1 Flash, còn vector nhúng phải đi nhà
 * cung cấp khác vì DeepSeek không có API embedding. `LlmProvider` là một
 * interface duy nhất cho cả hai việc, nên thay vì nhồi logic embedding vào
 * provider chat, ta để một object mỏng chia việc:
 *
 *     complete / completeWithTools  → provider chat
 *     embed / batchEmbed            → provider embedding
 *
 * Không cache, không retry, không chuyển đổi dữ liệu — đúng một tầng định
 * tuyến, để hành vi của từng provider vẫn là hành vi quan sát được.
 */

import type { LlmProvider, ToolSchema } from '@cnma/sap-aicore-integrate/types';
import type {
  CanonicalMessage,
  AIConfig,
  AIResponse,
  AIToolResponse,
} from '@cnma/sap-aicore-integrate/types';

export class CompositeLlmProvider implements LlmProvider {
  public readonly name: string;

  constructor(
    private readonly chat: LlmProvider,
    private readonly embeddings: LlmProvider,
  ) {
    this.name = `composite(${chat.name}+${embeddings.name})`;
  }

  public complete(messages: CanonicalMessage[], config?: AIConfig): Promise<AIResponse> {
    return this.chat.complete(messages, config);
  }

  public completeWithTools(
    messages: CanonicalMessage[],
    tools: ToolSchema[],
    config?: AIConfig,
  ): Promise<AIToolResponse> {
    return this.chat.completeWithTools(messages, tools, config);
  }

  public embed(text: string): Promise<number[]> {
    return this.embeddings.embed(text);
  }

  public batchEmbed(texts: string[], batchSize?: number): Promise<number[][]> {
    return this.embeddings.batchEmbed(texts, batchSize);
  }
}
