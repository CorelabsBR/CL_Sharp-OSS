import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { TerminalRunResult } from "../../shared/types";

export interface ProcessResult {
  output: string;
  code: number | null;
}

export function normalizeCwd(cwd?: string): string {
  if (!cwd || cwd.trim() === "") {
    return os.homedir();
  }
  return path.resolve(cwd);
}

export function runShell(command: string, cwd?: string, configuredShell?: string): Promise<TerminalRunResult> {
  const shell = configuredShell?.trim() || defaultShell();
  const normalizedCwd = normalizeCwd(cwd);
  const args = process.platform === "win32" ? windowsShellArgs(shell, command) : ["-lc", command];
  return runProcess(shell, args, { cwd: normalizedCwd, timeoutMs: 120000 }).then(result => ({
    cwd: normalizedCwd,
    output: result.output,
    code: result.code
  }));
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

    let output = "";
    const timeout = options.timeoutMs
      ? setTimeout(() => {
        output += "\n[ERRO] Processo excedeu o tempo limite.";
        child.kill("SIGKILL");
      }, options.timeoutMs)
      : undefined;

    child.stdout.on("data", chunk => {
      output += chunk.toString();
    });
    child.stderr.on("data", chunk => {
      output += chunk.toString();
    });
    child.on("error", error => {
      if (timeout) clearTimeout(timeout);
      resolve({ output: error.message, code: 1 });
    });
    child.on("close", code => {
      if (timeout) clearTimeout(timeout);
      resolve({ output: output.trimEnd(), code });
    });
  });
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
