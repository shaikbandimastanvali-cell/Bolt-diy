import { BaseProvider, getOpenAILikeModel } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';

interface OpenAIModelsResponse {
  data: Array<{ id: string }>;
}

export default class OpenAILikeProvider extends BaseProvider {
  name = 'OpenAILike';
  getApiKeyLink = 'https://build.nvidia.com';

  config = {
    baseUrlKey: 'OPENAI_LIKE_API_BASE_URL',
    apiTokenKey: 'OPENAI_LIKE_API_KEY',
    modelsKey: 'OPENAI_LIKE_MODELS',
  };

  // Default models that will always show up
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
    },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    const envRecord = this.convertEnvToRecord(serverEnv);

    const userEnteredKey = (apiKeys?.[this.name] || '').trim();
    const envKey = (envRecord.OPENAI_LIKE_API_KEY || '').trim();
    const apiKey = userEnteredKey || envKey;

    const baseUrl = (envRecord.OPENAI_LIKE_API_BASE_URL || 'https://integrate.api.nvidia.com/v1').trim();

    // Automatically fetch all available models directly from NVIDIA NIM
    if (apiKey) {
      try {
        const response = await fetch(`${baseUrl}/models`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });

        if (response.ok) {
          const res = (await response.json()) as OpenAIModelsResponse;

          if (res.data && Array.isArray(res.data)) {
            const fetchedModels: ModelInfo[] = res.data.map((m) => ({
              name: m.id,
              label: m.id,
              provider: this.name,
              maxTokenAllowed: 128000,
            }));

            // Merge static models with fetched models and remove duplicates
            const combined = [...this.staticModels, ...fetchedModels];
            const uniqueMap = new Map<string, ModelInfo>();
            combined.forEach((item) => uniqueMap.set(item.name, item));

            return Array.from(uniqueMap.values());
          }
        }
      } catch {
        // Fall back gracefully if NVIDIA's endpoint times out
      }
    }

    // Fallback: Parse models listed in OPENAI_LIKE_MODELS environment variable
    const modelsEnv = envRecord.OPENAI_LIKE_MODELS || envRecord.OPENAI_LIKE_API_MODELS || '';

    if (modelsEnv) {
      const parsed = this._parseModelsFromEnv(modelsEnv);
      const combined = [...this.staticModels, ...parsed];
      const uniqueMap = new Map<string, ModelInfo>();
      combined.forEach((item) => uniqueMap.set(item.name, item));

      return Array.from(uniqueMap.values());
    }

    return this.staticModels;
  }

  private _parseModelsFromEnv(modelsEnv: string): ModelInfo[] {
    try {
      return modelsEnv.split(',').map((entry) => {
        const modelName = entry.trim();
        return {
          name: modelName,
          label: modelName,
          provider: this.name,
          maxTokenAllowed: 128000,
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

    const userEnteredKey = (apiKeys?.[this.name] || '').trim();
    const envKey = (envRecord.OPENAI_LIKE_API_KEY || '').trim();
    const apiKey = userEnteredKey || envKey;

    const baseUrl = (envRecord.OPENAI_LIKE_API_BASE_URL || 'https://integrate.api.nvidia.com/v1').trim();

    if (!apiKey) {
      throw new Error('Please enter your NVIDIA API Key in the settings box or set OPENAI_LIKE_API_KEY in Cloudflare.');
    }

    return getOpenAILikeModel(baseUrl, apiKey, model);
  }
}
