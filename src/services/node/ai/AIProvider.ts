import type {
  AIMessage,
  AIModel,
  AIProviderDescriptor,
  AISettings,
  AIStreamEvent
} from "../../../shared/types";

export interface AIProviderRequest {
  requestId: string;
  messages: AIMessage[];
  settings: AISettings;
  apiKey?: string;
  signal: AbortSignal;
}

export interface AIProvider {
  readonly descriptor: AIProviderDescriptor;
  sendMessage(request: AIProviderRequest): AsyncIterable<AIStreamEvent>;
  listModels(apiKey: string | undefined, settings: AISettings): Promise<AIModel[]>;
}

