/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type {
  AIMessage,
  AIModel,
  AIProviderDescriptor,
  AISettings,
  AIStreamEvent
} from "../../../shared/types";

export interface AIProviderRequest {
  requestId: string;
  conversationId: string;
  messages: AIMessage[];
  settings: AISettings;
  apiKey?: string;
  workspace?: string;
  signal: AbortSignal;
}

export interface AIProvider {
  readonly descriptor: AIProviderDescriptor;
  sendMessage(request: AIProviderRequest): AsyncIterable<AIStreamEvent>;
  listModels(apiKey: string | undefined, settings: AISettings): Promise<AIModel[]>;
}

