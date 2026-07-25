export interface AIAskOptions {
  provider?: string;
  model?: string;
  systemPrompt?: string;
}

export interface AIAskResult {
  content: string;
}

export type AIAskHandler = (prompt: string, options?: AIAskOptions) => Promise<AIAskResult>;

let askHandler: AIAskHandler | undefined;

/**
 * Internal bridge used by NPSharp's extension host. Extensions depend on this
 * provider-neutral contract rather than a concrete remote API.
 */
export function configureAIService(handler: AIAskHandler): void {
  askHandler = handler;
}

export async function ask(prompt: string, options?: AIAskOptions): Promise<AIAskResult> {
  if (!askHandler) throw new Error("NPSharp AIService is not available in this extension host.");
  return askHandler(prompt, options);
}
