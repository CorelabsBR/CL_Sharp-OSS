/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { AIModel, AIProviderDescriptor, AIProviderId, AISettings } from "../../../shared/types";
import type { AIProvider } from "./AIProvider";
import { AISettingsService } from "./AISettingsService";
import { GeminiProvider } from "./providers/GeminiProvider";
import { OllamaProvider } from "./providers/OllamaProvider";
import { OpenAIProvider } from "./providers/OpenAIProvider";
import { OpenRouterProvider } from "./providers/OpenRouterProvider";
import { CodexAppServerProvider } from "./CodexAppServerProvider";
import type { CodexAccountState, CodexChatGptLoginResult } from "../../../shared/types";

export class ProviderManager {
  private readonly providers = new Map<AIProviderId, AIProvider>();

  constructor(private readonly settingsService: AISettingsService, npsharpExtensionsRoot?: string) {
    this.register(new OpenAIProvider("openai"));
    this.register(new CodexAppServerProvider(npsharpExtensionsRoot));
    this.register(new GeminiProvider());
    this.register(new OpenRouterProvider());
    this.register(new OllamaProvider());
  }

  descriptors(): AIProviderDescriptor[] {
    return [...this.providers.values()].map(provider => provider.descriptor);
  }

  get(id: AIProviderId): AIProvider {
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`Unknown AI provider: ${id}`);
    return provider;
  }

  async listModels(id: AIProviderId, settings: AISettings): Promise<AIModel[]> {
    return this.get(id).listModels(await this.settingsService.apiKey(id), settings);
  }

  async startCodexChatGptLogin(): Promise<{ authUrl: string; completed: Promise<CodexChatGptLoginResult> }> {
    const provider = this.get("codex");
    if (!(provider instanceof CodexAppServerProvider)) throw new Error("O provedor Codex não está disponível.");
    return provider.startChatGptLogin();
  }

  async codexAccount(): Promise<CodexAccountState> {
    return this.codexProvider().accountState();
  }

  async logoutCodex(): Promise<void> {
    await this.codexProvider().logout();
  }

  private codexProvider(): CodexAppServerProvider {
    const provider = this.get("codex");
    if (!(provider instanceof CodexAppServerProvider)) throw new Error("O provedor Codex não está disponível.");
    return provider;
  }

  register(provider: AIProvider): void {
    if (this.providers.has(provider.descriptor.id)) {
      throw new Error(`AI provider already registered: ${provider.descriptor.id}`);
    }
    this.providers.set(provider.descriptor.id, provider);
  }
}
