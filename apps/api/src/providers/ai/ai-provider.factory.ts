import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAIProvider } from '../../common/interfaces';
import { OpenAIProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { CredentialsService } from '../../modules/credentials/credentials.service';

export const AI_PROVIDER = 'AI_PROVIDER';

@Injectable()
export class AIProviderFactory {
  constructor(
    private readonly configService: ConfigService,
    private readonly openaiProvider: OpenAIProvider,
    private readonly anthropicProvider: AnthropicProvider,
    private readonly credentials: CredentialsService,
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

  /**
   * The provider a specific workspace has configured, using that workspace's own
   * API key when it saved one and the platform's otherwise. Async because the
   * key has to be decrypted out of the credential vault.
   */
  async getProviderForTenant(tenantId?: string): Promise<IAIProvider> {
    if (!tenantId || tenantId === 'all') return this.getProvider();

    const creds = await this.credentials.resolve(tenantId, 'ai');
    const selected = (creds.provider || this.configService.get<string>('ai.provider') || 'openai')
      .toLowerCase();

    if (selected === 'anthropic') {
      return this.anthropicProvider.withCredentials({
        apiKey: creds.anthropicApiKey,
        model: creds.anthropicModel,
      });
    }
    return this.openaiProvider.withCredentials({
      apiKey: creds.openaiApiKey,
      model: creds.openaiModel,
    });
  }
}
