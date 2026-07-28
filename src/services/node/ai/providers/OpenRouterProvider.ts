/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { AIModel, AIProviderDescriptor, AIStreamEvent } from "../../../../shared/types";
import type { AIProvider, AIProviderRequest } from "../AIProvider";
import { asRecord, asRecords, checkedFetch, numberValue, readSse, stringValue } from "../http";

export class OpenRouterProvider implements AIProvider {
  readonly descriptor: AIProviderDescriptor = {
    id: "openrouter",
    displayName: "OpenRouter",
    supportsStreaming: true,
    requiresApiKey: true,
    defaultModel: "openai/gpt-5.6-terra"
  };

  async *sendMessage(request: AIProviderRequest): AsyncIterable<AIStreamEvent> {
    if (!request.apiKey) throw new Error("OpenRouter API key is not configured.");
    const response = await checkedFetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${request.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/girellidev/npsharp",
        "X-Title": "NPSharp"
      },
      body: JSON.stringify({
        model: request.settings.model || this.descriptor.defaultModel,
        messages: [
          ...(request.settings.systemPrompt ? [{ role: "system", content: request.settings.systemPrompt }] : []),
          ...request.messages.map(message => ({ role: message.role, content: message.content }))
        ],
        temperature: request.settings.temperature,
        max_tokens: request.settings.maxTokens,
        stream: true,
        stream_options: { include_usage: true }
      }),
      signal: request.signal
    });
    for await (const chunk of readSse(response)) {
      const error = asRecord(chunk.error);
      if (error) throw new Error(stringValue(error.message) ?? "OpenRouter stream failed.");
      const choice = asRecords(chunk.choices)[0];
      const delta = asRecord(choice?.delta);
      const content = stringValue(delta?.content);
      if (content) yield { requestId: request.requestId, type: "delta", delta: content };
      const usage = asRecord(chunk.usage);
      if (usage) {
        yield {
          requestId: request.requestId,
          type: "complete",
          usage: {
            inputTokens: numberValue(usage.prompt_tokens),
            outputTokens: numberValue(usage.completion_tokens),
            totalTokens: numberValue(usage.total_tokens)
          }
        };
      }
    }
  }

  async listModels(): Promise<AIModel[]> {
    const response = await checkedFetch("https://openrouter.ai/api/v1/models", {});
    const json = asRecord(await response.json());
    return asRecords(json?.data)
      .map(item => stringValue(item.id))
      .filter((id): id is string => Boolean(id))
      .map(id => ({ id, displayName: id }));
  }
}

