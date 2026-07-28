/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { AIModel, AIProviderDescriptor, AIStreamEvent } from "../../../../shared/types";
import type { AIProvider, AIProviderRequest } from "../AIProvider";
import { asRecord, asRecords, checkedFetch, numberValue, readNdjson, stringValue } from "../http";

export class OllamaProvider implements AIProvider {
  readonly descriptor: AIProviderDescriptor = {
    id: "ollama",
    displayName: "Ollama (Local)",
    supportsStreaming: true,
    requiresApiKey: false,
    defaultModel: "qwen2.5-coder:7b"
  };

  async *sendMessage(request: AIProviderRequest): AsyncIterable<AIStreamEvent> {
    const baseUrl = normalizeBaseUrl(request.settings.ollamaBaseUrl);
    const response = await checkedFetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: request.settings.model || this.descriptor.defaultModel,
        messages: [
          ...(request.settings.systemPrompt ? [{ role: "system", content: request.settings.systemPrompt }] : []),
          ...request.messages.map(message => ({ role: message.role, content: message.content }))
        ],
        stream: true,
        options: {
          temperature: request.settings.temperature,
          num_predict: request.settings.maxTokens,
          num_ctx: request.settings.contextSize
        }
      }),
      signal: request.signal
    });
    for await (const chunk of readNdjson(response)) {
      const error = stringValue(chunk.error);
      if (error) throw new Error(error);
      const message = asRecord(chunk.message);
      const delta = stringValue(message?.content);
      if (delta) yield { requestId: request.requestId, type: "delta", delta };
      if (chunk.done === true) {
        const input = numberValue(chunk.prompt_eval_count);
        const output = numberValue(chunk.eval_count);
        yield {
          requestId: request.requestId,
          type: "complete",
          usage: { inputTokens: input, outputTokens: output, totalTokens: (input ?? 0) + (output ?? 0) }
        };
      }
    }
  }

  async listModels(_apiKey: string | undefined, settings: AIProviderRequest["settings"]): Promise<AIModel[]> {
    const response = await checkedFetch(`${normalizeBaseUrl(settings.ollamaBaseUrl)}/api/tags`, {});
    const json = asRecord(await response.json());
    return asRecords(json?.models)
      .map(item => stringValue(item.name))
      .filter((id): id is string => Boolean(id))
      .map(id => ({ id, displayName: id }));
  }
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/u, "");
  if (!/^https?:\/\//iu.test(trimmed)) throw new Error("Ollama URL must start with http:// or https://.");
  return trimmed;
}

