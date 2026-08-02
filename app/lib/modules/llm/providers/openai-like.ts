import { BaseProvider, getOpenAILikeModel } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { logger } from '~/utils/logger';

interface OpenAIModelsResponse {
  data: Array<{ id: string }>;
}

export default class OpenAILikeProvider extends BaseProvider {
  name = 'OpenAILike';
  getApiKeyLink = undefined;

  config = {
    baseUrlKey: 'OPENAI_LIKE_API_BASE_URL',
    apiTokenKey: 'OPENAI_LIKE_API_KEY',
    modelsKey: 'OPENAI_LIKE_API_MODELS',
  };

  // Hardcode GLM-5.2 here to guarantee it always appears as a foundational coding option
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
    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv,
      defaultBaseUrlKey: 'OPENAI_LIKE_API_BASE_URL',
      defaultApiTokenKey: 'OPENAI_LIKE_API_KEY',
    });

    if (!baseUrl || !apiKey) {
      return this.staticModels;
    }

    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: this.createTimeoutSignal(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const res = (await response.json()) as OpenAIModelsResponse;

      const fetchedModels = res.data.map((model) => ({
        name: model.id,
        label: this._generateModelLabel(model.id),
        provider: this.name,
        maxTokenAllowed: 8000,
      }));

      return [...this.staticModels, ...fetchedModels];
    } catch (error) {
      logger.info(`${this.name}: Could not fetch /models endpoint, checking fallback env`, error);

      const modelsEnv = serverEnv['OPENAI_LIKE_API_MODELS'] || settings?.OPENAI_LIKE_API_MODELS;

      if (modelsEnv) {
        logger.info(`${this.name}: Using OPENAI_LIKE_API_MODELS fallback`);
        return [...this.staticModels, ...this._parseModelsFromEnv(modelsEnv)];
      }

      return this.staticModels;
    }
  }

  private _parseModelsFromEnv(modelsEnv: string): ModelInfo[] {
    if (!modelsEnv) {
      return [];
    }

    try {
      const models: ModelInfo[] = [];
      const modelEntries = modelsEnv.split(',');

      for (const entry of modelEntries) {
        const modelName = entry.trim();

        if (!modelName) {
          continue;
        }

        models.push({
          name: modelName,
          label: this._generateModelLabel(modelName),
          provider: this.name,
          maxTokenAllowed: 8000,
        });
      }

      return models;
    } catch (error) {
      logger.error(`${this.name}: Error parsing models:`, error);
      return [];
    }
  }

  private _generateModelLabel(modelPath: string): string {
    const parts = modelPath.split('/');
    const lastPart = parts[parts.length - 1];
    return lastPart.toUpperCase();
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;
    const envRecord = this.convertEnvToRecord(serverEnv);

    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: envRecord,
      defaultBaseUrlKey: 'OPENAI_LIKE_API_BASE_URL',
      defaultApiTokenKey: 'OPENAI_LIKE_API_KEY',
    });

    // Check if the password entered in the UI matches your wrangler.toml file
    const userEnteredKey = apiKey;
    const expectedPassword = envRecord.OPENAI_LIKE_API_KEY;

    if (userEnteredKey !== expectedPassword) {
      throw new Error('Unauthorized: Invalid custom Bolt gateway password.');
    }

    // Swaps your password for the hidden real NVIDIA key from Cloudflare Secrets
    const realNvidiaToken = envRecord.REAL_NVIDIA_API_KEY;
    const finalBaseUrl = baseUrl || envRecord.OPENAI_LIKE_API_BASE_URL;

    if (!realNvidiaToken) {
      throw new Error('Server Config Error: REAL_NVIDIA_API_KEY missing in Cloudflare Dashboard.');
    }

    return getOpenAILikeModel(finalBaseUrl, realNvidiaToken, model);
  }
}
