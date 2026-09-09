import { Global, Module } from '@nestjs/common';
import { OpenAIProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { AIProviderFactory } from './ai-provider.factory';

@Global()
@Module({
  providers: [OpenAIProvider, AnthropicProvider, AIProviderFactory],
  exports: [AIProviderFactory, OpenAIProvider, AnthropicProvider],
})
export class AIModule {}
