import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { toFile } from 'openai';
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
export class OpenAIProvider implements IAIProvider {
  protected readonly client: OpenAI;
  private readonly logger = new Logger(OpenAIProvider.name);
  protected readonly defaultModel: string;
  private readonly embeddingModel: string;
  private readonly tenantClients = new Map<string, OpenAIProvider>();

  constructor(private readonly configService: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.configService.get<string>('ai.openai.apiKey'),
      timeout: 30000, // 30 second timeout
      maxRetries: 1,
    });
    this.defaultModel = this.configService.get<string>('ai.openai.model') || 'gpt-4o';
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
  withCredentials(creds: { apiKey?: string; model?: string }): OpenAIProvider {
    if (!creds?.apiKey && !creds?.model) return this;

    const cacheKey = `${creds.apiKey || ''}|${creds.model || ''}`;
    const cached = this.tenantClients.get(cacheKey);
    if (cached) return cached;

    const clone: OpenAIProvider = Object.create(this);
    if (creds.apiKey) {
      Object.defineProperty(clone, 'client', {
        value: new OpenAI({ apiKey: creds.apiKey, timeout: 30000, maxRetries: 1 }),
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

  private mapTools(options?: ChatCompletionOptions) {
    return options?.tools?.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  private safeParse(json: string): Record<string, any> {
    try {
      return json ? JSON.parse(json) : {};
    } catch {
      this.logger.warn(`Could not parse tool arguments: ${json.slice(0, 120)}`);
      return {};
    }
  }

  async chatCompletion(
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): Promise<ChatCompletionResult> {
    const tools = this.mapTools(options);

    const response = await this.client.chat.completions.create({
      model: options?.model || this.defaultModel,
      messages: messages.map((m) =>
        m.images?.length && m.role === 'user'
          ? {
              role: 'user' as const,
              content: [
                { type: 'text' as const, text: m.content || 'Look at the attached picture.' },
                ...m.images.map((url) => ({ type: 'image_url' as const, image_url: { url, detail: 'low' as const } })),
              ],
            }
          : { role: m.role, content: m.content },
      ) as any,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 1024,
      ...(tools?.length ? { tools } : {}),
    });

    const choice = response.choices[0];

    return {
      content: choice.message.content || '',
      toolCalls: choice.message.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: this.safeParse(tc.function.arguments),
      })),
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
      finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : choice.finish_reason === 'length' ? 'length' : 'stop',
    };
  }

  /**
   * Streams text deltas as they arrive. Tool-call deltas are accumulated and
   * returned in the final `done` chunk, so callers can execute tools afterwards.
   */
  async *chatCompletionStream(
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): AsyncIterable<ChatStreamChunk> {
    const tools = this.mapTools(options);

    const stream = await this.client.chat.completions.create({
      model: options?.model || this.defaultModel,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 1024,
      stream: true,
      stream_options: { include_usage: true },
      ...(tools?.length ? { tools } : {}),
    });

    let content = '';
    let finishReason: ChatCompletionResult['finishReason'] = 'stop';
    let usage: ChatCompletionResult['usage'];
    const toolAcc = new Map<number, { id: string; name: string; args: string }>();

    for await (const chunk of stream) {
      if (chunk.usage) {
        usage = {
          promptTokens: chunk.usage.prompt_tokens,
          completionTokens: chunk.usage.completion_tokens,
          totalTokens: chunk.usage.total_tokens,
        };
      }
      const choice = chunk.choices?.[0];
      if (!choice) continue;

      const delta = choice.delta;
      if (delta?.content) {
        content += delta.content;
        yield { type: 'text', delta: delta.content };
      }
      for (const tc of delta?.tool_calls || []) {
        const idx = tc.index ?? 0;
        const entry = toolAcc.get(idx) || { id: '', name: '', args: '' };
        if (tc.id) entry.id = tc.id;
        if (tc.function?.name) entry.name += tc.function.name;
        if (tc.function?.arguments) entry.args += tc.function.arguments;
        toolAcc.set(idx, entry);
      }
      if (choice.finish_reason) {
        finishReason =
          choice.finish_reason === 'tool_calls' ? 'tool_calls' : choice.finish_reason === 'length' ? 'length' : 'stop';
      }
    }

    const toolCalls = Array.from(toolAcc.values())
      .filter((t) => t.name)
      .map((t) => ({ id: t.id, name: t.name, arguments: this.safeParse(t.args) }));
    if (toolCalls.length && finishReason !== 'tool_calls') finishReason = 'tool_calls';

    yield {
      type: 'done',
      result: { content, toolCalls: toolCalls.length ? toolCalls : undefined, usage, finishReason },
    };
  }

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    const response = await this.client.embeddings.create({
      model: this.embeddingModel,
      input: text,
    });

    return {
      embedding: response.data[0].embedding,
      usage: {
        totalTokens: response.usage.total_tokens,
      },
    };
  }

  /** Whisper transcription of a call recording (mp3/wav, up to 25MB). */
  async transcribeAudio(audio: Buffer, fileName: string, language?: string): Promise<string> {
    const file = await toFile(audio, fileName || 'recording.mp3');
    const result = await this.client.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      // Whisper handles Hindi/Hinglish well when a language hint is omitted; only
      // pass one when the tenant pinned a language for its calls.
      ...(language && language !== 'auto' ? { language } : {}),
      response_format: 'text',
    });
    return typeof result === 'string' ? result : (result as any)?.text || '';
  }

  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    const response = await this.client.embeddings.create({
      model: this.embeddingModel,
      input: texts,
    });

    return response.data.map((item) => ({
      embedding: item.embedding,
      usage: {
        totalTokens: Math.ceil(response.usage.total_tokens / texts.length),
      },
    }));
  }
}
