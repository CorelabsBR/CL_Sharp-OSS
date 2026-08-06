/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { safeStorage } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import type { AISaveSettingsRequest, AIProviderId, AISettings } from "../../../shared/types";

interface PersistedAISettings extends Omit<AISettings, "apiKeyConfigured"> {
  encryptedKeys: Partial<Record<AIProviderId, string>>;
}

const DEFAULT_AI_SETTINGS: AISettings = {
  provider: "codex",
  model: "gpt-5.2-codex",
  temperature: 0.2,
  maxTokens: 8192,
  streaming: true,
  systemPrompt: "You are NPSharp Codex, a precise coding assistant. Use only the provided editor context. Explain the intended change before proposing it. For code changes, identify the target file and return the complete replacement in a fenced code block so the user can review and apply it with the editor actions. Never claim that you changed a file or ran a command yourself.",
  contextSize: 128000,
  ollamaBaseUrl: "http://127.0.0.1:11434",
  apiKeyConfigured: false
};

export class AISettingsService {
  private readonly settingsPath: string;
  private readonly sessionKeys = new Map<AIProviderId, string>();

  constructor(userDataPath: string) {
    this.settingsPath = path.join(userDataPath, "ai-settings.json");
  }

  async load(): Promise<AISettings> {
    const persisted = await this.loadPersisted();
    return {
      ...DEFAULT_AI_SETTINGS,
      ...withoutKeys(persisted),
      apiKeyConfigured: Boolean(await this.apiKey(persisted.provider))
    };
  }

  async save(request: AISaveSettingsRequest): Promise<AISettings> {
    const current = await this.loadPersisted();
    const encryptedKeys = { ...current.encryptedKeys };
    const suppliedKey = request.apiKey?.trim();
    if (request.clearApiKey) {
      delete encryptedKeys[request.provider];
      this.sessionKeys.delete(request.provider);
    } else if (suppliedKey) {
      if (safeStorage.isEncryptionAvailable()) {
        encryptedKeys[request.provider] = safeStorage.encryptString(suppliedKey).toString("base64");
        this.sessionKeys.delete(request.provider);
      } else {
        this.sessionKeys.set(request.provider, suppliedKey);
        console.warn("[NPSharp AI] OS-backed encryption is unavailable; the API key will remain in memory for this session only.");
      }
    }
    const next: PersistedAISettings = {
      provider: request.provider,
      model: request.model.trim(),
      temperature: clamp(request.temperature, 0, 2),
      maxTokens: Math.round(clamp(request.maxTokens, 1, 128000)),
      streaming: request.streaming,
      systemPrompt: request.systemPrompt,
      contextSize: Math.round(clamp(request.contextSize, 1024, 1_050_000)),
      ollamaBaseUrl: request.ollamaBaseUrl.trim() || DEFAULT_AI_SETTINGS.ollamaBaseUrl,
      encryptedKeys
    };
    await this.write(next);
    return {
      ...withoutKeys(next),
      apiKeyConfigured: Boolean(await this.apiKey(next.provider))
    };
  }

  async apiKey(provider: AIProviderId): Promise<string | undefined> {
    const sessionKey = this.sessionKeys.get(provider);
    if (sessionKey) return sessionKey;
    const persisted = await this.loadPersisted();
    const encrypted = persisted.encryptedKeys[provider];
    if (!encrypted) return undefined;
    if (!safeStorage.isEncryptionAvailable()) return undefined;
    try {
      return safeStorage.decryptString(Buffer.from(encrypted, "base64"));
    } catch (error) {
      console.warn(`[NPSharp AI] Failed to decrypt the ${provider} API key.`, error);
      return undefined;
    }
  }

  private async loadPersisted(): Promise<PersistedAISettings> {
    try {
      const raw = await fs.readFile(this.settingsPath, "utf8");
      const parsed = JSON.parse(raw) as Partial<PersistedAISettings>;
      return {
        ...withoutApiFlag(DEFAULT_AI_SETTINGS),
        ...parsed,
        encryptedKeys: parsed.encryptedKeys ?? {}
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn(`[NPSharp AI] Failed to load AI settings from ${this.settingsPath}.`, error);
      }
      return { ...withoutApiFlag(DEFAULT_AI_SETTINGS), encryptedKeys: {} };
    }
  }

  private async write(settings: PersistedAISettings): Promise<void> {
    await fs.mkdir(path.dirname(this.settingsPath), { recursive: true });
    await fs.writeFile(this.settingsPath, `${JSON.stringify(settings, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await fs.chmod(this.settingsPath, 0o600).catch(() => undefined);
  }
}

function withoutApiFlag(settings: AISettings): Omit<AISettings, "apiKeyConfigured"> {
  const { apiKeyConfigured: _ignored, ...rest } = settings;
  return rest;
}

function withoutKeys(settings: PersistedAISettings): Omit<AISettings, "apiKeyConfigured"> {
  const { encryptedKeys: _ignored, ...rest } = settings;
  return rest;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

