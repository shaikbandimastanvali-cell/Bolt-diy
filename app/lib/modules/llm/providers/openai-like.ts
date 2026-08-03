import { BaseProvider, getOpenAILikeModel } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';

export default class OpenAILikeProvider extends BaseProvider {
  name = 'OpenAILike';
  
  // Setting a link tells bolt.diy that this provider takes an API key in the UI
  getApiKeyLink = 'https://build.nvidia.com';

  config = {
    baseUrlKey: 'OPENAI_LIKE_API_BASE_URL',
    apiTokenKey: 'OPENAI_LIKE_API_KEY',
    modelsKey: 'OPENAI_LIKE_MODELS',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'z-ai/glm-5.2',
      label: 'NVIDIA Z-AI GLM-5.2',
      provider: 'OpenAILike',
      maxTokenAllowed: 128000,
    },
    {
      name: 'nvidia/glm-4-5-128k',
      label: 'NVIDIA GLM-4.5',
      provider: 'OpenAILike',
      maxTokenAllowed: 128000,
    }
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    const envRecord = this.convertEnvToRecord(serverEnv);
    const modelsEnv = envRecord.OPENAI_LIKE_MODELS || envRecord.OPENAI_LIKE_API_MODELS || '';

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
    const { model, serverEnv, apiKeys } = options;
    const envRecord = this.convertEnvToRecord(serverEnv);

    // 1. Check for API key entered in the UI box
    const userEnteredKey = (apiKeys?.[this.name] || '').trim();
    
    // 2. Fall back to OPENAI_LIKE_API_KEY set in Cloudflare/wrangler.toml
    const envKey = (envRecord.OPENAI_LIKE_API_KEY || '').trim();
    
    const apiKey = userEnteredKey || envKey;
    const baseUrl = (envRecord.OPENAI_LIKE_API_BASE_URL || 'https://integrate.api.nvidia.com/v1').trim();

    if (!apiKey) {
      throw new Error('Please enter your NVIDIA API Key in the settings/chat box or set OPENAI_LIKE_API_KEY in Cloudflare.');
    }

    return getOpenAILikeModel(baseUrl, apiKey, model);
  }
}
