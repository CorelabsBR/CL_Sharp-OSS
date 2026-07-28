/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { AIContextItem, AIMessage } from "../../../shared/types";

const CONTEXT_HEADER = "The following NPSharp editor context was explicitly selected by the user.";

export class PromptBuilder {
  build(messages: readonly AIMessage[], contexts: readonly AIContextItem[]): AIMessage[] {
    const clean = messages
      .filter(message => message.role !== "system")
      .map(message => ({ ...message, contexts: undefined }));
    if (!contexts.length) return clean;

    const contextText = contexts.map(context => {
      const metadata = [
        `source=${context.source}`,
        context.path ? `path=${context.path}` : "",
        context.language ? `language=${context.language}` : "",
        context.truncated ? "truncated=true" : ""
      ].filter(Boolean).join(", ");
      return `### ${context.label}\n<metadata ${metadata}>\n${context.content}\n</metadata>`;
    }).join("\n\n");
    const lastUser = [...clean].reverse().find(message => message.role === "user");
    if (!lastUser) return clean;
    lastUser.content = `${lastUser.content}\n\n${CONTEXT_HEADER}\n\n${contextText}`;
    return clean;
  }
}

