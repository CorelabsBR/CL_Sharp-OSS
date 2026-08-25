/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { TextDecoder } from "node:util";
import os from "node:os";
import path from "node:path";
import type { TerminalRunResult } from "../../shared/types";

const optionalRequire = createRequire(__filename);

export interface ProcessResult {
  output: string;
  code: number | null;
}

interface PtyProcess {
  onData(callback: (data: string) => void): void;
  onExit(callback: (event: { exitCode: number; signal?: number }) => void): void;
  kill(signal?: string): void;
}

interface NodePtyModule {
  spawn(file: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv; name: string; cols: number; rows: number }): PtyProcess;
}

let cachedPty: NodePtyModule | null | undefined;

export function normalizeCwd(cwd?: string): string {
  if (!cwd || cwd.trim() === "") {
    return os.homedir();
  }
  return path.resolve(cwd);
}

export async function runShell(command: string, cwd?: string, configuredShell?: string): Promise<TerminalRunResult> {
  const shell = configuredShell?.trim() || defaultShell();
  const normalizedCwd = normalizeCwd(cwd);
  const args = process.platform === "win32" ? windowsShellArgs(shell, command) : ["-lc", command];

  const ptyResult = await runShellWithPty(shell, args, normalizedCwd);
  if (ptyResult) return ptyResult;

  return runProcess(shell, args, { cwd: normalizedCwd, timeoutMs: 120000 }).then(result => ({
    cwd: normalizedCwd,
    output: result.output,
    code: result.code
  }));
}

function runShellWithPty(shell: string, args: string[], cwd: string): Promise<TerminalRunResult | undefined> {
  const pty = loadNodePty();
  if (!pty) return Promise.resolve(undefined);

  return new Promise(resolve => {
    let output = "";
    let settled = false;
    const finish = (result: TerminalRunResult | undefined) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    try {
      const terminal = pty.spawn(shell, args, {
        cwd,
        env: { ...process.env, TERM: process.env.TERM || "xterm-256color" },
        name: "xterm-256color",
        cols: 120,
        rows: 30
      });
      const timeout = setTimeout(() => {
        output += "\n[ERRO] Processo excedeu o tempo limite.";
        terminal.kill("SIGKILL");
      }, 120000);

      terminal.onData(data => {
        output += data;
      });
      terminal.onExit(event => {
        clearTimeout(timeout);
        finish({ cwd, output: output.trimEnd(), code: event.exitCode });
      });
    } catch (error) {
      console.warn("[Sharp-OSS process] node-pty command failed, falling back to child_process.", error);
      finish(undefined);
    }
  });
}

function loadNodePty(): NodePtyModule | undefined {
  if (cachedPty !== undefined) return cachedPty ?? undefined;
  try {
    cachedPty = optionalRequire("node-pty") as NodePtyModule;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "MODULE_NOT_FOUND") {
      console.warn("[Sharp-OSS process] node-pty could not be loaded.", error);
    }
    cachedPty = null;
  }
  return cachedPty ?? undefined;
}

export function runProcess(
  executable: string,
  args: string[],
  options: { cwd?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv } = {}
): Promise<ProcessResult> {
  return new Promise(resolve => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: false,
      windowsHide: true
    });

    const outputChunks: Buffer[] = [];
    let timeoutMessage = "";
    let settled = false;
    const timeout = options.timeoutMs
      ? setTimeout(() => {
        timeoutMessage = "\n[ERRO] Processo excedeu o tempo limite.";
        child.kill("SIGKILL");
      }, options.timeoutMs)
      : undefined;
    const finish = (result: ProcessResult) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      resolve(result);
    };

    child.stdout.on("data", (chunk: Buffer) => {
      outputChunks.push(Buffer.from(chunk));
    });
    child.stderr.on("data", (chunk: Buffer) => {
      outputChunks.push(Buffer.from(chunk));
    });
    child.on("error", error => {
      finish({ output: error.message, code: 1 });
    });
    child.on("close", code => {
      const output = `${decodeProcessOutput(Buffer.concat(outputChunks))}${timeoutMessage}`;
      finish({ output: output.trimEnd(), code });
    });
  });
}

/** Decodes compiler output without replacing localized Windows characters with U+FFFD. */
export function decodeProcessOutput(buffer: Buffer, allowWindowsFallback = process.platform === "win32"): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return allowWindowsFallback
      ? new TextDecoder("windows-1252").decode(buffer)
      : new TextDecoder("utf-8").decode(buffer);
  }
}

export async function commandExists(command: string): Promise<string | undefined> {
  if (command.includes(path.sep) || command.includes("/")) {
    try {
      await fs.access(command);
      return path.resolve(command);
    } catch {
      return undefined;
    }
  }

  const pathValue = process.env.PATH ?? "";
  const extensions = process.platform === "win32" ? ["", ".exe", ".cmd", ".bat"] : [""];
  for (const dir of pathValue.split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of extensions) {
      const candidate = path.join(dir, command + ext);
      try {
        await fs.access(candidate);
        return candidate;
      } catch {
        // keep scanning PATH
      }
    }
  }
  return undefined;
}

function defaultShell(): string {
  if (process.platform === "win32") {
    return process.env.ComSpec || "powershell.exe";
  }
  return process.env.SHELL || "/bin/bash";
}

function windowsShellArgs(shell: string, command: string): string[] {
  const name = path.basename(shell).toLowerCase();
  if (name === "cmd.exe" || name === "cmd") {
    return ["/D", "/Q", "/C", normalizeCmdCommand(command)];
  }
  if (name === "bash.exe" || name === "bash") {
    return ["-lc", command];
  }
  return ["-NoLogo", "-Command", command];
}

function normalizeCmdCommand(command: string): string {
  const trimmed = command.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "pwd") return "cd";
  if (lower === "ls") return "dir";
  if (lower.startsWith("ls ")) return `dir ${trimmed.slice(3)}`;
  if (lower === "clear") return "cls";
  return command;
}
