/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  AIConversation,
  AIConversationUpdate,
  AIMessage,
  AIProviderId
} from "../../../shared/types";

export class ConversationManager {
  private readonly directory: string;

  constructor(userDataPath: string) {
    this.directory = path.join(userDataPath, "chat");
  }

  async list(): Promise<AIConversation[]> {
    await fs.mkdir(this.directory, { recursive: true });
    const entries = await fs.readdir(this.directory, { withFileTypes: true });
    const conversations = await Promise.all(entries
      .filter(entry => entry.isFile() && entry.name.endsWith(".json"))
      .map(entry => this.read(path.basename(entry.name, ".json")).catch(error => {
        console.warn(`[NPSharp AI] Ignoring invalid conversation ${entry.name}.`, error);
        return undefined;
      })));
    return conversations
      .filter((item): item is AIConversation => Boolean(item))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async create(provider: AIProviderId = "codex", model = ""): Promise<AIConversation> {
    const timestamp = new Date().toISOString();
    const conversation: AIConversation = {
      id: randomUUID(),
      title: "New conversation",
      provider,
      model,
      createdAt: timestamp,
      updatedAt: timestamp,
      messages: []
    };
    await this.write(conversation);
    return conversation;
  }

  async update(update: AIConversationUpdate): Promise<AIConversation> {
    const current = await this.read(update.id);
    const conversation: AIConversation = {
      ...current,
      ...(update.title !== undefined ? { title: normalizedTitle(update.title) } : {}),
      ...(update.provider !== undefined ? { provider: update.provider } : {}),
      ...(update.model !== undefined ? { model: update.model } : {}),
      ...(update.messages !== undefined ? { messages: update.messages.map(normalizeMessage) } : {}),
      updatedAt: new Date().toISOString()
    };
    await this.write(conversation);
    return conversation;
  }

  async delete(id: string): Promise<void> {
    await fs.unlink(this.filePath(id)).catch(error => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    });
  }

  private async read(id: string): Promise<AIConversation> {
    const raw = await fs.readFile(this.filePath(id), "utf8");
    const parsed = JSON.parse(raw) as AIConversation;
    if (!parsed || parsed.id !== id || !Array.isArray(parsed.messages)) {
      throw new Error("Conversation file has an invalid shape.");
    }
    return { ...parsed, messages: parsed.messages.map(normalizeMessage) };
  }

  private async write(conversation: AIConversation): Promise<void> {
    await fs.mkdir(this.directory, { recursive: true });
    const target = this.filePath(conversation.id);
    const temporary = `${target}.${process.pid}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(conversation, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await fs.rename(temporary, target);
  }

  private filePath(id: string): string {
    if (!/^[a-zA-Z0-9-]+$/u.test(id)) throw new Error("Invalid conversation identifier.");
    return path.join(this.directory, `${id}.json`);
  }
}

function normalizedTitle(value: string): string {
  return value.trim().replace(/\s+/gu, " ").slice(0, 120) || "New conversation";
}

function normalizeMessage(message: AIMessage): AIMessage {
  return {
    id: String(message.id),
    role: message.role,
    content: String(message.content),
    timestamp: String(message.timestamp),
    ...(message.contexts ? { contexts: message.contexts } : {}),
    ...(message.stopped ? { stopped: true } : {}),
    ...(message.error ? { error: String(message.error) } : {})
  };
}

