import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import {
  IAIProvider,
  ChatMessage,
  ChatCompletionOptions,
  ChatCompletionResult,
  ChatStreamChunk,
  EmbeddingResult,
} from '../../common/interfaces';

/** Bounded so a platform with many workspaces cannot grow clones without limit. */
const MAX_TENANT_CLIENTS = 50;

@Injectable()
export class AnthropicProvider implements IAIProvider {
  protected readonly client: Anthropic;
  private readonly openaiClient: OpenAI;
  private readonly logger = new Logger(AnthropicProvider.name);
  protected readonly defaultModel: string;
  private readonly embeddingModel: string;
  private readonly tenantClients = new Map<string, AnthropicProvider>();

  constructor(private readonly configService: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.configService.get<string>('ai.anthropic.apiKey'),
      timeout: 30000,
      maxRetries: 1,
    });
    // Anthropic doesn't have embeddings API - use OpenAI for embeddings
    this.openaiClient = new OpenAI({
      apiKey: this.configService.get<string>('ai.openai.apiKey'),
      timeout: 30000,
      maxRetries: 1,
    });
    this.defaultModel = this.configService.get<string>('ai.anthropic.model') || 'claude-sonnet-4-20250514';
    this.embeddingModel = this.configService.get<string>('ai.openai.embeddingModel') || 'text-embedding-3-small';
  }


  /**
   * A view of this provider bound to one workspace's own API key.
   *
   * The clone delegates to this instance through the prototype chain and only
   * overrides `client` and `defaultModel`, so every method keeps working without
   * being rewritten. Clones are cached per key+model because constructing an SDK
   * client on each call would drop connection pooling.
   */
  withCredentials(creds: { apiKey?: string; model?: string }): AnthropicProvider {
    if (!creds?.apiKey && !creds?.model) return this;

    const cacheKey = `${creds.apiKey || ''}|${creds.model || ''}`;
    const cached = this.tenantClients.get(cacheKey);
    if (cached) return cached;

    const clone: AnthropicProvider = Object.create(this);
    if (creds.apiKey) {
      Object.defineProperty(clone, 'client', {
        value: new Anthropic({ apiKey: creds.apiKey, timeout: 30000, maxRetries: 1 }),
      });
    }
    if (creds.model) {
      Object.defineProperty(clone, 'defaultModel', { value: creds.model });
    }

    if (this.tenantClients.size >= MAX_TENANT_CLIENTS) {
      this.tenantClients.delete(this.tenantClients.keys().next().value as string);
    }
    this.tenantClients.set(cacheKey, clone);
    return clone;
  }

  private splitMessages(messages: ChatMessage[]) {
    const systemMessage = messages.find((m) => m.role === 'system');
    const nonSystemMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        if (m.images?.length && m.role === 'user') {
          const blocks: any[] = [];
          for (const img of m.images) {
            const match = /^data:([^;]+);base64,(.+)$/.exec(img);
            if (match) blocks.push({ type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } });
            else blocks.push({ type: 'image', source: { type: 'url', url: img } });
          }
          blocks.push({ type: 'text', text: m.content || 'Look at the attached picture.' });
          return { role: 'user' as const, content: blocks };
        }
        return { role: m.role as 'user' | 'assistant', content: m.content };
      });
    return { systemMessage, nonSystemMessages };
  }

  private mapTools(options?: ChatCompletionOptions) {
    return options?.tools?.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters as any,
    }));
  }

  private safeParse(json: string): Record<string, any> {
    try {
      return json ? JSON.parse(json) : {};
    } catch {
      this.logger.warn(`Could not parse tool input: ${json.slice(0, 120)}`);
      return {};
    }
  }

  async chatCompletion(
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): Promise<ChatCompletionResult> {
    const { systemMessage, nonSystemMessages } = this.splitMessages(messages);
    const tools = this.mapTools(options);

    const response = await this.client.messages.create({
      model: options?.model || this.defaultModel,
      max_tokens: options?.maxTokens ?? 1024,
      ...(systemMessage ? { system: systemMessage.content } : {}),
      messages: nonSystemMessages,
      ...(tools?.length ? { tools } : {}),
    });

    const textContent = response.content.find((c) => c.type === 'text');
    const toolUseBlocks = response.content.filter((c: any) => c.type === 'tool_use');

    return {
      content: textContent?.type === 'text' ? textContent.text : '',
      toolCalls: toolUseBlocks.map((tc: any) => ({
        id: tc.id,
        name: tc.name,
        arguments: tc.input as Record<string, any>,
      })),
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      finishReason: (response.stop_reason as string) === 'tool_use' ? 'tool_calls' : response.stop_reason === 'max_tokens' ? 'length' : 'stop',
    };
  }

  /**
   * Streams text deltas; tool_use blocks are assembled from input_json deltas
   * and returned in the final `done` chunk.
   */
  async *chatCompletionStream(
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): AsyncIterable<ChatStreamChunk> {
    const { systemMessage, nonSystemMessages } = this.splitMessages(messages);
    const tools = this.mapTools(options);

    const stream = this.client.messages.stream({
      model: options?.model || this.defaultModel,
      max_tokens: options?.maxTokens ?? 1024,
      ...(systemMessage ? { system: systemMessage.content } : {}),
      messages: nonSystemMessages,
      ...(tools?.length ? { tools } : {}),
    });

    let content = '';
    let finishReason: ChatCompletionResult['finishReason'] = 'stop';
    let inputTokens = 0;
    let outputTokens = 0;
    const blocks = new Map<number, { id: string; name: string; json: string }>();

    for await (const event of stream as any) {
      switch (event.type) {
        case 'message_start':
          inputTokens = event.message?.usage?.input_tokens || 0;
          break;
        case 'content_block_start':
          if (event.content_block?.type === 'tool_use') {
            blocks.set(event.index, { id: event.content_block.id, name: event.content_block.name, json: '' });
          }
          break;
        case 'content_block_delta':
          if (event.delta?.type === 'text_delta' && event.delta.text) {
            content += event.delta.text;
            yield { type: 'text', delta: event.delta.text };
          } else if (event.delta?.type === 'input_json_delta') {
            const b = blocks.get(event.index);
            if (b) b.json += event.delta.partial_json || '';
          }
          break;
        case 'message_delta':
          if (event.usage?.output_tokens) outputTokens = event.usage.output_tokens;
          if (event.delta?.stop_reason) {
            finishReason =
              event.delta.stop_reason === 'tool_use' ? 'tool_calls' : event.delta.stop_reason === 'max_tokens' ? 'length' : 'stop';
          }
          break;
        default:
          break;
      }
    }

    const toolCalls = Array.from(blocks.values()).map((b) => ({
      id: b.id,
      name: b.name,
      arguments: this.safeParse(b.json),
    }));
    if (toolCalls.length && finishReason !== 'tool_calls') finishReason = 'tool_calls';

    yield {
      type: 'done',
      result: {
        content,
        toolCalls: toolCalls.length ? toolCalls : undefined,
        usage: { promptTokens: inputTokens, completionTokens: outputTokens, totalTokens: inputTokens + outputTokens },
        finishReason,
      },
    };
  }

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    // Use OpenAI for embeddings since Anthropic doesn't have an embeddings API
    const response = await this.openaiClient.embeddings.create({
      model: this.embeddingModel,
      input: text,
    });

    return {
      embedding: response.data[0].embedding,
      usage: { totalTokens: response.usage.total_tokens },
    };
  }

  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    const response = await this.openaiClient.embeddings.create({
      model: this.embeddingModel,
      input: texts,
    });

    return response.data.map((item) => ({
      embedding: item.embedding,
      usage: { totalTokens: Math.ceil(response.usage.total_tokens / texts.length) },
    }));
  }
}
