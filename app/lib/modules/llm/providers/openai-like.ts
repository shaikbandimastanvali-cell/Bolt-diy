import { BaseProvider, getOpenAILikeModel } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';

export default class OpenAILikeProvider extends BaseProvider {
  name = 'OpenAILike';
  getApiKeyLink = undefined;

  // This maps the UI boxes to the internal Bolt system
  config = {
    baseUrlKey: 'OPENAI_LIKE_API_BASE_URL',
    apiTokenKey: 'OPENAI_LIKE_API_KEY',
    modelsKey: 'OPENAI_LIKE_MODELS',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'z-ai/glm-5.2',
      label: 'NVIDIA Z-AI GLM-5.2 (1M Context)',
      provider: 'OpenAILike',
      maxTokenAllowed: 1000000,
    }
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    const envRecord = this.convertEnvToRecord(serverEnv);
    const modelsEnv = envRecord.OPENAI_LIKE_MODELS || '';

    if (modelsEnv) {
      return [...this.staticModels, ...this._parseModelsFromEnv(modelsEnv)];
    }

    return this.staticModels;
  }

  private _parseModelsFromEnv(modelsEnv: string): ModelInfo[] {
    try {
      return modelsEnv.split(',').map((entry) => {
        const modelName = entry.trim();
        return {
          name: modelName,
          label: modelName.split('/').pop()?.toUpperCase() || modelName,
          provider: this.name,
          maxTokenAllowed: 8000,
        };
      });
    } catch {
      return [];
    }
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;
    const envRecord = this.convertEnvToRecord(serverEnv);

    // This fetches exactly what you typed into the UI Settings boxes
    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: envRecord,
      defaultBaseUrlKey: 'OPENAI_LIKE_API_BASE_URL',
      defaultApiTokenKey: 'OPENAI_LIKE_API_KEY',
    });

    const finalApiKey = (apiKey || '').trim();
    const finalBaseUrl = (baseUrl || envRecord.OPENAI_LIKE_API_BASE_URL || 'https://nvidia.com').trim();

    if (!finalApiKey) {
      throw new Error('Please enter your API Key in the OpenAILike settings panel.');
    }

    return getOpenAILikeModel(finalBaseUrl, finalApiKey, model);
  }
}
