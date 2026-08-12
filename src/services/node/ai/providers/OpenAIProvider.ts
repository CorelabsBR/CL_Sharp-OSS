/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { AIMessage, AIModel, AIProviderDescriptor, AIStreamEvent } from "../../../../shared/types";
import type { AIProvider, AIProviderRequest } from "../AIProvider";
import { asRecord, asRecords, checkedFetch, numberValue, readSse, stringValue } from "../http";

export class OpenAIProvider implements AIProvider {
  readonly descriptor: AIProviderDescriptor;

  constructor(id: "openai") {
    this.descriptor = {
      id,
      displayName: "OpenAI",
      supportsStreaming: true,
      requiresApiKey: true,
      defaultModel: "gpt-5.6-terra"
    };
  }

  async *sendMessage(request: AIProviderRequest): AsyncIterable<AIStreamEvent> {
    if (!request.apiKey) throw new Error(`${this.descriptor.displayName} API key is not configured.`);
    const body: Record<string, unknown> = {
      model: request.settings.model || this.descriptor.defaultModel,
      instructions: request.settings.systemPrompt,
      input: request.messages.map(toResponseInput),
      max_output_tokens: request.settings.maxTokens,
      stream: true,
      store: false
    };
    if (!/^gpt-5(?:\.|-)/u.test(String(body.model))) body.temperature = request.settings.temperature;
    const response = await checkedFetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${request.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: request.signal
    });
    for await (const event of readSse(response)) {
      const type = stringValue(event.type);
      if (type === "response.output_text.delta") {
        const delta = stringValue(event.delta);
        if (delta) yield { requestId: request.requestId, type: "delta", delta };
      } else if (type === "response.failed" || type === "error") {
        const error = asRecord(event.error);
        throw new Error(stringValue(error?.message) ?? "OpenAI response failed.");
      } else if (type === "response.completed") {
        const responseRecord = asRecord(event.response);
        const usage = asRecord(responseRecord?.usage);
        yield {
          requestId: request.requestId,
          type: "complete",
          usage: {
            inputTokens: numberValue(usage?.input_tokens),
            outputTokens: numberValue(usage?.output_tokens),
            totalTokens: numberValue(usage?.total_tokens)
          }
        };
      }
    }
  }

  async listModels(apiKey: string | undefined): Promise<AIModel[]> {
    const fallback = ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna", "gpt-5.4-mini"];
    if (!apiKey) return fallback.map(model);
    const response = await checkedFetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const json = asRecord(await response.json());
    const ids = asRecords(json?.data)
      .map(item => stringValue(item.id))
      .filter((id): id is string => Boolean(id))
      .filter(id => /^gpt-/u.test(id) && !id.includes("codex"))
      .sort();
    return (ids.length ? ids : fallback).map(model);
  }
}

function toResponseInput(message: AIMessage): Record<string, unknown> {
  return {
    role: message.role === "assistant" ? "assistant" : "user",
    content: message.content
  };
}

function model(id: string): AIModel {
  return { id, displayName: id };
}
