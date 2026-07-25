import type { AIModel, AIProviderDescriptor, AIStreamEvent } from "../../../../shared/types";
import type { AIProvider, AIProviderRequest } from "../AIProvider";
import { asRecord, asRecords, checkedFetch, readSse, stringValue } from "../http";

export class GeminiProvider implements AIProvider {
  readonly descriptor: AIProviderDescriptor = {
    id: "gemini",
    displayName: "Google Gemini",
    supportsStreaming: true,
    requiresApiKey: true,
    defaultModel: "gemini-2.5-flash"
  };

  async *sendMessage(request: AIProviderRequest): AsyncIterable<AIStreamEvent> {
    if (!request.apiKey) throw new Error("Gemini API key is not configured.");
    const model = encodeURIComponent(request.settings.model || this.descriptor.defaultModel);
    const response = await checkedFetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": request.apiKey
        },
        body: JSON.stringify({
          systemInstruction: request.settings.systemPrompt
            ? { parts: [{ text: request.settings.systemPrompt }] }
            : undefined,
          contents: request.messages.map(message => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }]
          })),
          generationConfig: {
            temperature: request.settings.temperature,
            maxOutputTokens: request.settings.maxTokens
          }
        }),
        signal: request.signal
      }
    );
    for await (const chunk of readSse(response)) {
      const error = asRecord(chunk.error);
      if (error) throw new Error(stringValue(error.message) ?? "Gemini stream failed.");
      for (const candidate of asRecords(chunk.candidates)) {
        const content = asRecord(candidate.content);
        for (const part of asRecords(content?.parts)) {
          const delta = stringValue(part.text);
          if (delta) yield { requestId: request.requestId, type: "delta", delta };
        }
      }
    }
    yield { requestId: request.requestId, type: "complete" };
  }

  async listModels(apiKey: string | undefined): Promise<AIModel[]> {
    const fallback = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
    if (!apiKey) return fallback.map(toModel);
    const response = await checkedFetch("https://generativelanguage.googleapis.com/v1beta/models", {
      headers: { "x-goog-api-key": apiKey }
    });
    const json = asRecord(await response.json());
    const models = asRecords(json?.models)
      .filter(item => {
        const methods = item.supportedGenerationMethods;
        return Array.isArray(methods) && methods.includes("generateContent");
      })
      .map(item => stringValue(item.name)?.replace(/^models\//u, ""))
      .filter((id): id is string => Boolean(id))
      .map(toModel);
    return models.length ? models : fallback.map(toModel);
  }
}

function toModel(id: string): AIModel {
  return { id, displayName: id };
}

