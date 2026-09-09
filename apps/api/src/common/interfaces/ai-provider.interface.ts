export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: AIToolDefinition[];
  stream?: boolean;
}

export interface AIToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface AIToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ChatCompletionResult {
  content: string;
  toolCalls?: AIToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'tool_calls' | 'length';
}

/**
 * Streaming chunk. `text` chunks arrive as the model writes; exactly one `done`
 * chunk closes the stream and carries the fully assembled result (including any
 * tool calls the model decided to make).
 */
export type ChatStreamChunk =
  | { type: 'text'; delta: string }
  | { type: 'done'; result: ChatCompletionResult };

export interface EmbeddingResult {
  embedding: number[];
  usage?: {
    totalTokens: number;
  };
}

export interface IAIProvider {
  chatCompletion(
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): Promise<ChatCompletionResult>;

  chatCompletionStream(
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): AsyncIterable<ChatStreamChunk>;

  generateEmbedding(text: string): Promise<EmbeddingResult>;

  generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]>;
}
