import { BaseProvider, getOpenAILikeModel } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';

export default class OpenAILikeProvider extends BaseProvider {
  name = 'OpenAILike';
  getApiKeyLink = undefined;

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

  // KILL THE CORS HEALTH CHECK: This stops the browser from ever pinging NVIDIA directly
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

    // Grab the key typed into the UI box right above your chat panel
    const userEnteredKey = (apiKeys?.[this.name] || '').trim();
    
    const finalBaseUrl = (envRecord.OPENAI_LIKE_API_BASE_URL || 'https://integrate.api.nvidia.com/v1').trim();

    if (!userEnteredKey) {
      throw new Error('Please enter your NVIDIA API Key in the box above the chat.');
    }

    // Proxy the request safely through Cloudflare using the key from your chat header box
    return getOpenAILikeModel(finalBaseUrl, userEnteredKey, model);
  }
}
