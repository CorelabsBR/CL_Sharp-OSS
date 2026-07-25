import type { AIChatRequest, AIContextItem, AIStreamEvent } from "../../../shared/types";
import { AISettingsService } from "./AISettingsService";
import { PromptBuilder } from "./PromptBuilder";
import { ProviderManager } from "./ProviderManager";
import { StreamingController } from "./StreamingController";
import { TokenCounter } from "./TokenCounter";

export class AIService {
  private readonly promptBuilder = new PromptBuilder();
  private readonly tokenCounter = new TokenCounter();

  constructor(
    private readonly providers: ProviderManager,
    private readonly settingsService: AISettingsService,
    private readonly streaming: StreamingController
  ) {}

  async ask(request: AIChatRequest, emit: (event: AIStreamEvent) => void): Promise<void> {
    const signal = this.streaming.start(request.requestId);
    emit({ requestId: request.requestId, type: "start" });
    try {
      const provider = this.providers.get(request.settings.provider);
      const contexts = this.limitContexts(request.contexts, request.settings.contextSize);
      const messages = this.promptBuilder.build(request.messages, contexts);
      const apiKey = await this.settingsService.apiKey(request.settings.provider);
      let buffered = "";
      let completion: AIStreamEvent | undefined;
      for await (const event of provider.sendMessage({ requestId: request.requestId, messages, settings: request.settings, apiKey, signal })) {
        if (event.type === "complete") {
          completion = event;
        } else if (!request.settings.streaming && event.type === "delta") {
          buffered += event.delta ?? "";
        } else {
          emit(event);
        }
      }
      if (!request.settings.streaming && buffered) {
        emit({ requestId: request.requestId, type: "delta", delta: buffered });
      }
      emit(completion ?? { requestId: request.requestId, type: "complete" });
    } catch (error) {
      if (isAbortError(error) || signal.aborted) {
        emit({ requestId: request.requestId, type: "cancelled" });
      } else {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[NPSharp AI] Request ${request.requestId} failed.`, error);
        emit({ requestId: request.requestId, type: "error", message });
      }
    } finally {
      this.streaming.finish(request.requestId);
    }
  }

  private limitContexts(contexts: readonly AIContextItem[], contextSize: number): AIContextItem[] {
    const budget = Math.max(512, Math.floor(contextSize * 0.7));
    let remaining = budget;
    const result: AIContextItem[] = [];
    for (const context of contexts) {
      if (remaining <= 0) break;
      const limited = this.tokenCounter.truncateToTokens(context.content, remaining);
      result.push({ ...context, content: limited.text, truncated: context.truncated || limited.truncated });
      remaining -= this.tokenCounter.estimate(limited.text);
    }
    return result;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
