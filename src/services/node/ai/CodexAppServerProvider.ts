/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { BUILD_CONFIG } from "../../../shared/buildConfig";
import type { AIModel, AIProviderDescriptor, AIStreamEvent, CodexChatGptLoginResult } from "../../../shared/types";
import { commandExists } from "../processService";
import type { AIProvider, AIProviderRequest } from "./AIProvider";

interface JsonRecord {
  [key: string]: unknown;
}

interface PendingRequest {
  resolve(value: JsonRecord): void;
  reject(error: Error): void;
}

interface LoginSession {
  authUrl: string;
  completed: Promise<CodexChatGptLoginResult>;
}

interface LoginWaiter {
  resolve(value: CodexChatGptLoginResult): void;
}

interface TurnStream {
  queue: AsyncQueue<AIStreamEvent>;
  receivedText: boolean;
  turnId?: string;
}

/**
 * Local JSON-RPC client for `codex app-server`.
 *
 * The App Server owns ChatGPT OAuth and persists its own refresh tokens. The
 * NPSharp renderer only receives a success/failure result and never sees an
 * access token or API key.
 */
export class CodexAppServerProvider implements AIProvider {
  readonly descriptor: AIProviderDescriptor = {
    id: "codex",
    displayName: "Codex",
    supportsStreaming: true,
    requiresApiKey: false,
    defaultModel: "gpt-5.2-codex"
  };

  private process?: ChildProcess;
  private starting?: Promise<void>;
  private nextRequestId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly loginWaiters = new Map<string, LoginWaiter>();
  private readonly conversationThreads = new Map<string, string>();
  private readonly turnStreams = new Map<string, TurnStream>();

  async startChatGptLogin(): Promise<LoginSession> {
    await this.ensureStarted();
    const result = await this.request("account/login/start", {
      type: "chatgpt",
      useHostedLoginSuccessPage: true,
      appBrand: "codex"
    });
    const loginId = text(result.loginId);
    const authUrl = text(result.authUrl);
    if (!loginId || !authUrl) throw new Error("O Codex não retornou uma URL de login do ChatGPT.");
    const completed = new Promise<CodexChatGptLoginResult>(resolve => {
      this.loginWaiters.set(loginId, { resolve });
    });
    return { authUrl, completed };
  }

  async *sendMessage(request: AIProviderRequest): AsyncIterable<AIStreamEvent> {
    await this.ensureStarted();
    await this.assertChatGptLogin();

    const threadId = await this.threadFor(request);
    const stream: TurnStream = { queue: new AsyncQueue<AIStreamEvent>(), receivedText: false };
    this.turnStreams.set(threadId, stream);
    const abort = () => {
      if (stream.turnId) void this.request("turn/interrupt", { threadId, turnId: stream.turnId }).catch(() => undefined);
    };
    request.signal.addEventListener("abort", abort, { once: true });

    try {
      const userMessage = [...request.messages].reverse().find(message => message.role === "user")?.content.trim();
      if (!userMessage) throw new Error("A conversa não possui uma mensagem do usuário para enviar ao Codex.");
      const result = await this.request("turn/start", {
        threadId,
        input: [{ type: "text", text: userMessage }],
        cwd: request.workspace || undefined,
        approvalPolicy: "never",
        sandboxPolicy: { type: "readOnly" },
        model: request.settings.model || this.descriptor.defaultModel,
        effort: "medium",
        summary: "concise"
      });
      stream.turnId = text(record(result.turn)?.id);
      for await (const event of stream.queue) yield { ...event, requestId: request.requestId };
    } finally {
      request.signal.removeEventListener("abort", abort);
      this.turnStreams.delete(threadId);
    }
  }

  async listModels(): Promise<AIModel[]> {
    return ["gpt-5.2-codex", "gpt-5.1-codex-max", "gpt-5.1-codex-mini"].map(id => ({ id, displayName: id }));
  }

  private async threadFor(request: AIProviderRequest): Promise<string> {
    const existing = this.conversationThreads.get(request.conversationId);
    if (existing) return existing;
    const result = await this.request("thread/start", {
      cwd: request.workspace || undefined,
      approvalPolicy: "never",
      sandboxPolicy: { type: "readOnly" },
      model: request.settings.model || this.descriptor.defaultModel,
      serviceName: "npsharp"
    });
    const threadId = text(record(result.thread)?.id);
    if (!threadId) throw new Error("O Codex não iniciou uma conversa.");
    this.conversationThreads.set(request.conversationId, threadId);
    return threadId;
  }

  private async assertChatGptLogin(): Promise<void> {
    const result = await this.request("account/read", { refreshToken: false });
    const account = record(result.account);
    if (text(account?.type) !== "chatgpt") {
      throw new Error("Entre com sua conta ChatGPT em Configurações de IA antes de usar o Codex.");
    }
  }

  private async ensureStarted(): Promise<void> {
    if (this.process && !this.process.killed) return;
    if (this.starting) return this.starting;
    this.starting = this.start();
    try {
      await this.starting;
    } finally {
      this.starting = undefined;
    }
  }

  private async start(): Promise<void> {
    const executable = await findCodexExecutable();
    if (!executable) {
      throw new Error("Codex não foi encontrado. Instale ou habilite a extensão Codex no VS Code, ou defina NPSHARP_CODEX_PATH.");
    }
    const child = spawn(executable, ["app-server", "--stdio"], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    this.process = child;
    child.once("error", error => this.failAll(`Não foi possível iniciar o Codex: ${error.message}`));
    child.once("exit", (code, signal) => {
      this.process = undefined;
      this.failAll(`O Codex foi encerrado${code === null ? "" : ` (código ${code})`}${signal ? ` (${signal})` : ""}.`);
    });
    if (!child.stdout || !child.stdin) throw new Error("O processo Codex não forneceu o canal de comunicação esperado.");
    readline.createInterface({ input: child.stdout }).on("line", line => this.handleLine(line));
    child.stderr?.on("data", value => console.warn(`[NPSharp Codex] ${String(value).trim()}`));

    await this.request("initialize", {
      clientInfo: {
        name: "npsharp",
        title: "NPSharp",
        version: BUILD_CONFIG.version
      }
    });
    this.notify("initialized", {});
  }

  private request(method: string, params: JsonRecord): Promise<JsonRecord> {
    const child = this.process;
    if (!child?.stdin || child.killed) return Promise.reject(new Error("O Codex não está em execução."));
    const input = child.stdin;
    const id = this.nextRequestId++;
    return new Promise<JsonRecord>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        input.write(`${JSON.stringify({ method, id, params })}\n`);
      } catch (error) {
        this.pending.delete(id);
        reject(asError(error));
      }
    });
  }

  private notify(method: string, params: JsonRecord): void {
    const input = this.process?.stdin;
    if (!input || this.process?.killed) return;
    input.write(`${JSON.stringify({ method, params })}\n`);
  }

  private handleLine(line: string): void {
    let message: JsonRecord;
    try {
      message = JSON.parse(line) as JsonRecord;
    } catch {
      console.warn("[NPSharp Codex] Ignorando mensagem JSON inválida.");
      return;
    }
    const id = typeof message.id === "number" ? message.id : undefined;
    if (id !== undefined && this.pending.has(id)) {
      const pending = this.pending.get(id)!;
      this.pending.delete(id);
      const failure = record(message.error);
      if (failure) pending.reject(new Error(text(failure.message) ?? "O Codex recusou a solicitação."));
      else pending.resolve(record(message.result) ?? {});
      return;
    }
    const method = text(message.method);
    const params = record(message.params) ?? {};
    if (!method) return;
    if (method === "account/login/completed") {
      this.handleLoginCompleted(params);
      return;
    }
    if (method === "item/agentMessage/delta") {
      const stream = this.streamFor(params);
      const delta = text(params.delta) ?? text(params.text);
      if (stream && delta) {
        stream.receivedText = true;
        stream.queue.push({ requestId: "", type: "delta", delta });
      }
      return;
    }
    if (method === "item/completed") {
      const stream = this.streamFor(params);
      const item = record(params.item);
      if (stream && text(item?.type) === "agentMessage" && !stream.receivedText) {
        const content = itemText(item);
        if (content) stream.queue.push({ requestId: "", type: "delta", delta: content });
      }
      return;
    }
    if (method === "turn/completed") {
      const stream = this.streamFor(params);
      if (!stream) return;
      const turn = record(params.turn);
      const failure = record(turn?.error);
      if (text(turn?.status) === "failed") stream.queue.fail(new Error(text(failure?.message) ?? "O Codex não concluiu a tarefa."));
      else stream.queue.end({ requestId: "", type: "complete" });
      return;
    }
    if (method === "error") {
      const stream = this.streamFor(params);
      const failure = record(params.error);
      if (stream) stream.queue.fail(new Error(text(failure?.message) ?? "O Codex retornou um erro."));
    }
  }

  private streamFor(params: JsonRecord): TurnStream | undefined {
    const threadId = text(params.threadId) ?? text(record(params.turn)?.threadId);
    if (threadId) return this.turnStreams.get(threadId);
    return this.turnStreams.size === 1 ? this.turnStreams.values().next().value : undefined;
  }

  private async handleLoginCompleted(params: JsonRecord): Promise<void> {
    const loginId = text(params.loginId);
    if (!loginId) return;
    const waiter = this.loginWaiters.get(loginId);
    if (!waiter) return;
    this.loginWaiters.delete(loginId);
    if (!params.success) {
      waiter.resolve({ success: false, error: text(params.error) ?? "O login do ChatGPT foi cancelado." });
      return;
    }
    try {
      const state = await this.request("account/read", { refreshToken: false });
      const account = record(state.account);
      waiter.resolve({ success: true, email: text(account?.email), planType: text(account?.planType) });
    } catch (error) {
      waiter.resolve({ success: false, error: asError(error).message });
    }
  }

  private failAll(message: string): void {
    for (const pending of this.pending.values()) pending.reject(new Error(message));
    this.pending.clear();
    for (const stream of this.turnStreams.values()) stream.queue.fail(new Error(message));
    this.turnStreams.clear();
    for (const waiter of this.loginWaiters.values()) waiter.resolve({ success: false, error: message });
    this.loginWaiters.clear();
  }
}

class AsyncQueue<T> implements AsyncIterable<T> {
  private readonly values: T[] = [];
  private nextValue?: (value: IteratorResult<T>) => void;
  private failure?: Error;
  private closed = false;

  push(value: T): void {
    if (this.closed) return;
    if (this.nextValue) {
      const next = this.nextValue;
      this.nextValue = undefined;
      next({ value, done: false });
    } else {
      this.values.push(value);
    }
  }

  end(finalValue?: T): void {
    if (finalValue) this.push(finalValue);
    this.closed = true;
    if (this.nextValue && this.values.length === 0) {
      const next = this.nextValue;
      this.nextValue = undefined;
      next({ value: undefined as never, done: true });
    }
  }

  fail(error: Error): void {
    this.failure = error;
    this.closed = true;
    if (this.nextValue) {
      const next = this.nextValue;
      this.nextValue = undefined;
      next({ value: undefined as never, done: true });
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    while (true) {
      if (this.values.length) {
        yield this.values.shift()!;
        continue;
      }
      if (this.failure) throw this.failure;
      if (this.closed) return;
      const next = await new Promise<IteratorResult<T>>(resolve => {
        this.nextValue = resolve;
      });
      if (this.failure) throw this.failure;
      if (next.done) return;
      yield next.value;
    }
  }
}

async function findCodexExecutable(): Promise<string | undefined> {
  const configured = process.env.NPSHARP_CODEX_PATH?.trim();
  if (configured && await fileExists(configured)) return configured;
  const fromPath = await commandExists("codex");
  if (fromPath) return fromPath;
  const binary = codexBundledBinary();
  if (!binary) return undefined;
  for (const extensionsRoot of codexExtensionRoots()) {
    try {
      const entries = await fs.readdir(extensionsRoot, { withFileTypes: true });
      const folders = entries.filter(entry => entry.isDirectory() && entry.name.startsWith("openai.chatgpt-"))
        .map(entry => entry.name)
        .sort()
        .reverse();
      for (const folder of folders) {
        const candidate = path.join(extensionsRoot, folder, "bin", binary.directory, binary.name);
        if (await fileExists(candidate)) return candidate;
      }
    } catch {
      // Each editor is optional; keep looking in the remaining extension roots.
    }
  }
  return undefined;
}

function codexBundledBinary(): { directory: string; name: string } | undefined {
  const architecture = process.arch === "x64" ? "x86_64" : process.arch === "arm64" ? "aarch64" : undefined;
  if (!architecture) return undefined;
  if (process.platform === "win32") return { directory: `windows-${architecture}`, name: "codex.exe" };
  if (process.platform === "linux") return { directory: `linux-${architecture}`, name: "codex" };
  if (process.platform === "darwin") return { directory: `darwin-${architecture}`, name: "codex" };
  return undefined;
}

function codexExtensionRoots(): string[] {
  const home = os.homedir();
  const configured = process.env.VSCODE_EXTENSIONS?.trim();
  return [...new Set([
    configured,
    path.join(home, ".vscode", "extensions"),
    path.join(home, ".vscode-insiders", "extensions"),
    path.join(home, ".vscode-oss", "extensions"),
    path.join(home, ".vscodium", "extensions"),
    path.join(home, ".cursor", "extensions"),
    path.join(home, ".windsurf", "extensions")
  ].filter((value): value is string => Boolean(value)))];
}

async function fileExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function record(value: unknown): JsonRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function itemText(item: JsonRecord | undefined): string | undefined {
  if (!item) return undefined;
  if (text(item.text)) return text(item.text);
  const content = item.content;
  if (!Array.isArray(content)) return undefined;
  return content.map(entry => text(record(entry)?.text) ?? "").join("") || undefined;
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
