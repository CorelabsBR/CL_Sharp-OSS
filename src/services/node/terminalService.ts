import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import type {
  TerminalBackend,
  TerminalCreateRequest,
  TerminalDataEvent,
  TerminalExitEvent,
  TerminalSessionInfo,
  TerminalShellOption
} from "../../shared/types";
import { commandExists, normalizeCwd } from "./processService";

const optionalRequire = createRequire(__filename);

interface PtyProcess {
  pid?: number;
  onData(callback: (data: string) => void): void;
  onExit(callback: (event: { exitCode: number; signal?: number | string }) => void): void;
  write(data: string): void;
  resize?(cols: number, rows: number): void;
  kill(signal?: string): void;
}

interface NodePtyModule {
  spawn(file: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv; name: string; cols: number; rows: number }): PtyProcess;
}

interface TerminalCallbacks {
  onData(event: TerminalDataEvent): void;
  onExit(event: TerminalExitEvent): void;
}

interface ManagedTerminal {
  info: TerminalSessionInfo;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  close(): void;
}

interface ShellCandidate {
  id: string;
  label: string;
  names: string[];
}

const sessions = new Map<string, ManagedTerminal>();
let cachedPty: NodePtyModule | null | undefined;

export async function listTerminalShells(): Promise<TerminalShellOption[]> {
  const candidates = shellCandidates();
  const defaultShellPath = defaultShell();
  const options: TerminalShellOption[] = [];

  for (const candidate of candidates) {
    const resolved = await resolveShell(candidate.names);
    const fallback = candidate.names[0];
    options.push({
      id: candidate.id,
      label: candidate.label,
      path: resolved ?? fallback,
      available: Boolean(resolved),
      default: shellMatches(defaultShellPath, resolved ?? fallback, candidate.id),
      platform: normalizedPlatform()
    });
  }

  if (!options.some(option => option.default)) {
    const firstAvailable = options.find(option => option.available) ?? options[0];
    if (firstAvailable) firstAvailable.default = true;
  }

  return options;
}

export function createTerminalSession(request: TerminalCreateRequest, callbacks: TerminalCallbacks): TerminalSessionInfo {
  const id = randomUUID();
  const cwd = normalizeCwd(request.cwd);
  const shell = request.shell?.trim() || defaultShell();
  const args = interactiveShellArgs(shell);
  const cols = request.cols ?? 120;
  const rows = request.rows ?? 30;
  const name = request.name?.trim() || shellDisplayName(shell);
  const pty = loadNodePty();
  const session = pty
    ? createPtySession(id, name, shell, args, cwd, cols, rows, pty, callbacks)
    : createChildProcessSession(id, name, shell, args, cwd, callbacks);

  sessions.set(id, session);
  return { ...session.info };
}

export function writeTerminal(id: string, data: string): void {
  sessions.get(id)?.write(data);
}

export function resizeTerminal(id: string, cols: number, rows: number): void {
  sessions.get(id)?.resize(cols, rows);
}

export function killTerminal(id: string): void {
  sessions.get(id)?.kill();
}

export function closeTerminal(id: string): void {
  const session = sessions.get(id);
  if (!session) return;
  sessions.delete(id);
  session.close();
}

export function closeAllTerminals(): void {
  for (const id of [...sessions.keys()]) {
    closeTerminal(id);
  }
}

function createPtySession(
  id: string,
  name: string,
  shell: string,
  args: string[],
  cwd: string,
  cols: number,
  rows: number,
  pty: NodePtyModule,
  callbacks: TerminalCallbacks
): ManagedTerminal {
  try {
    const terminal = pty.spawn(shell, args, {
      cwd,
      env: { ...process.env, TERM: process.env.TERM || "xterm-256color" },
      name: "xterm-256color",
      cols,
      rows
    });
    const info = terminalInfo(id, name, cwd, shell, "node-pty", terminal.pid);
    let exited = false;
    terminal.onData(data => callbacks.onData({ id, data }));
    terminal.onExit(event => {
      if (exited) return;
      exited = true;
      info.running = false;
      callbacks.onExit({ id, code: event.exitCode, signal: event.signal ? String(event.signal) : undefined });
    });
    return {
      info,
      write: data => {
        if (info.running) terminal.write(data);
      },
      resize: (nextCols, nextRows) => terminal.resize?.(nextCols, nextRows),
      kill: () => {
        if (info.running) terminal.kill("SIGTERM");
      },
      close: () => {
        if (info.running) terminal.kill("SIGKILL");
      }
    };
  } catch (error) {
    console.warn("[NPSharp terminal] node-pty failed, falling back to child_process.", error);
    return createChildProcessSession(id, name, shell, args, cwd, callbacks);
  }
}

function createChildProcessSession(
  id: string,
  name: string,
  shell: string,
  args: string[],
  cwd: string,
  callbacks: TerminalCallbacks
): ManagedTerminal {
  let child: ChildProcessWithoutNullStreams | undefined;
  const info = terminalInfo(id, name, cwd, shell, "child_process");
  let exited = false;

  const finish = (code: number | null, signal?: NodeJS.Signals | string | null) => {
    if (exited) return;
    exited = true;
    info.running = false;
    callbacks.onExit({ id, code, signal: signal ? String(signal) : undefined });
  };

  try {
    child = spawn(shell, args, {
      cwd,
      env: { ...process.env, TERM: process.env.TERM || "xterm-256color" },
      shell: false,
      windowsHide: false
    });
    info.pid = child.pid;
    child.stdout.on("data", chunk => callbacks.onData({ id, data: chunk.toString() }));
    child.stderr.on("data", chunk => callbacks.onData({ id, data: chunk.toString() }));
    child.on("error", error => {
      callbacks.onData({ id, data: `\n[terminal] ${error.message}\n` });
      finish(1);
    });
    child.on("close", (code, signal) => finish(code, signal));
  } catch (error) {
    callbacks.onData({ id, data: `\n[terminal] ${error instanceof Error ? error.message : String(error)}\n` });
    finish(1);
  }

  return {
    info,
    write: data => {
      if (info.running) child?.stdin.write(data);
    },
    resize: () => undefined,
    kill: () => {
      if (info.running) child?.kill("SIGTERM");
    },
    close: () => {
      if (info.running) child?.kill("SIGKILL");
    }
  };
}

function terminalInfo(id: string, name: string, cwd: string, shell: string, backend: TerminalBackend, pid?: number): TerminalSessionInfo {
  return {
    id,
    name,
    cwd,
    shell,
    backend,
    pid,
    running: true
  };
}

function loadNodePty(): NodePtyModule | undefined {
  if (cachedPty !== undefined) return cachedPty ?? undefined;
  try {
    cachedPty = optionalRequire("node-pty") as NodePtyModule;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "MODULE_NOT_FOUND") {
      console.warn("[NPSharp terminal] node-pty could not be loaded.", error);
    }
    cachedPty = null;
  }
  return cachedPty ?? undefined;
}

async function resolveShell(names: string[]): Promise<string | undefined> {
  for (const name of names) {
    const resolved = await commandExists(name);
    if (resolved) return resolved;
  }
  return undefined;
}

function shellCandidates(): ShellCandidate[] {
  if (process.platform === "win32") {
    return [
      { id: "powershell", label: "PowerShell", names: ["pwsh", "powershell.exe", "powershell"] },
      { id: "cmd", label: "cmd", names: ["cmd.exe", "cmd"] }
    ];
  }
  if (process.platform === "darwin") {
    return [
      { id: "zsh", label: "zsh", names: ["zsh", "/bin/zsh"] },
      { id: "bash", label: "bash", names: ["bash", "/bin/bash"] }
    ];
  }
  return [
    { id: "bash", label: "bash", names: ["bash", "/bin/bash"] },
    { id: "zsh", label: "zsh", names: ["zsh", "/bin/zsh"] },
    { id: "sh", label: "sh", names: ["sh", "/bin/sh"] },
    { id: "fish", label: "fish", names: ["fish", "/usr/bin/fish"] }
  ];
}

function defaultShell(): string {
  if (process.platform === "win32") {
    return process.env.ComSpec || "powershell.exe";
  }
  return process.env.SHELL || (process.platform === "darwin" ? "/bin/zsh" : "/bin/bash");
}

function interactiveShellArgs(shell: string): string[] {
  const name = path.basename(shell).toLowerCase();
  if (process.platform === "win32") {
    if (name === "cmd.exe" || name === "cmd") return ["/Q"];
    return ["-NoLogo"];
  }
  return [];
}

function shellDisplayName(shell: string): string {
  const name = path.basename(shell).replace(/\.exe$/i, "");
  return name || "Terminal";
}

function shellMatches(defaultShellPath: string, shellPath: string, id: string): boolean {
  const defaultName = path.basename(defaultShellPath).replace(/\.exe$/i, "").toLowerCase();
  const shellName = path.basename(shellPath).replace(/\.exe$/i, "").toLowerCase();
  return defaultName === shellName || defaultName === id.toLowerCase();
}

function normalizedPlatform(): "linux" | "darwin" | "win32" {
  if (process.platform === "darwin" || process.platform === "win32") return process.platform;
  return "linux";
}
