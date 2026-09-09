import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAIProvider } from '../../common/interfaces';
import { OpenAIProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';

export const AI_PROVIDER = 'AI_PROVIDER';

@Injectable()
export class AIProviderFactory {
  constructor(
    private readonly configService: ConfigService,
    private readonly openaiProvider: OpenAIProvider,
    private readonly anthropicProvider: AnthropicProvider,
  ) {}

  getProvider(provider?: string): IAIProvider {
    const selectedProvider = provider || this.configService.get<string>('ai.provider') || 'openai';

    switch (selectedProvider) {
      case 'anthropic':
        return this.anthropicProvider;
      case 'openai':
      default:
        return this.openaiProvider;
    }
  }
}
