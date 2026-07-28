/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { AIConversation } from "../../shared/types";

export class HistoryManager {
  filter(conversations: readonly AIConversation[], query: string): AIConversation[] {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return [...conversations];
    return conversations.filter(conversation =>
      conversation.title.toLocaleLowerCase().includes(normalized)
      || conversation.messages.some(message => message.content.toLocaleLowerCase().includes(normalized))
      || conversation.provider.includes(normalized)
      || conversation.model.toLocaleLowerCase().includes(normalized)
    );
  }
}

