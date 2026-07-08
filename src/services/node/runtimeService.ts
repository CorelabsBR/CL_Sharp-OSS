import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import type { InstalledRuntime, RuntimeRunRequest, RuntimeRunResult } from "../../shared/types";
import { PortugolInterpreter } from "../../core/portugol/interpreter";
import { LANGUAGE_RUNTIMES, languageFromFileName } from "../../core/runtime/languages";
import { commandExists, runProcess } from "./processService";
import { runtimeRegistryPath, toolBinDir } from "./paths";

export async function listRuntimes(): Promise<InstalledRuntime[]> {
  return discoverRuntimes(false);
}

export async function discoverRuntimes(rescan = true): Promise<InstalledRuntime[]> {
  const configured = await loadRegistry();
  const installed: InstalledRuntime[] = [];

  for (const language of LANGUAGE_RUNTIMES) {
    if (language.id === "portugol") {
      installed.push({ language, rootPath: toolBinDir(), executablePath: path.join(toolBinDir(), "internal-portugol"), debuggerPath: path.join(toolBinDir(), "internal-portugol"), version: "npsharp", source: "internal" });
      continue;
    }

    const configuredRuntime = configured.get(language.id);
    if (configuredRuntime) {
      installed.push({ ...configuredRuntime, language, source: "configured" });
      continue;
    }

    if (!rescan) continue;
    for (const candidate of language.executableCandidates) {
      const executable = await commandExists(candidate);
      if (executable) {
        installed.push({
          language,
          rootPath: path.dirname(executable),
          executablePath: executable,
          version: await readVersion(executable),
          source: "system"
        });
        break;
      }
    }
  }

  await saveRegistryFromInstalled(installed);
  return installed;
}

export async function configureRuntime(languageId: string, executablePath: string): Promise<InstalledRuntime[]> {
  const current = await loadRegistry();
  const language = LANGUAGE_RUNTIMES.find(item => item.id === languageId);
  if (language && executablePath) {
    current.set(languageId, {
      language,
      rootPath: path.dirname(executablePath),
      executablePath,
      version: "configured",
      source: "configured"
    });
  }
  await saveRegistryMap(current);
  return discoverRuntimes(true);
}

export async function runFile(request: RuntimeRunRequest): Promise<RuntimeRunResult> {
  const language = languageFromFileName(path.basename(request.filePath));
  if (!language || language.id === "git") {
    return { output: `[ERRO] Linguagem nao reconhecida para ${path.basename(request.filePath)}`, code: 1 };
  }

  const source = request.content ?? await fs.readFile(request.filePath, "utf8");
  if (language.id === "portugol") {
    const output: string[] = [];
    const interpreter = new PortugolInterpreter();
    interpreter.executeWithOutput(source, line => output.push(`[PORTUGOL] ${line}`));
    return {
      language: language.displayName,
      output: [`[DEBUG] Runtime Portugol selecionado`, ...output, "[DEBUG] Execucao finalizada"].join("\n"),
      code: output.some(line => line.includes("[ERRO]")) ? 1 : 0
    };
  }

  const runtimes = await discoverRuntimes(true);
  const runtime = runtimes.find(item => item.language.id === language.id);

  if (language.id === "node") {
    return runNodeLikeFile(language.displayName, request.filePath, runtime);
  }

  if (language.id === "java") {
    return runJavaSource(language.displayName, request.filePath, source);
  }

  if (language.id === "rust") {
    return runRustFile(language.displayName, request.filePath);
  }

  if (!runtime) {
    return {
      language: language.displayName,
      output: `[ERRO] Runtime nao encontrado: ${language.displayName}. Configure o caminho em Run and Debug.`,
      code: 127
    };
  }

  const command = buildRunCommand(language.id, runtime.executablePath, request.filePath);
  const result = await runProcess(command[0], command.slice(1), {
    cwd: path.dirname(request.filePath),
    timeoutMs: 120000,
    env: { NPSHARP_RUNTIME_HOME: runtime.rootPath, PATH: `${toolBinDir()}${path.delimiter}${process.env.PATH ?? ""}` }
  });

  return {
    language: language.displayName,
    output: formatRunOutput(language.displayName, command, result.output, result.code),
    code: result.code ?? 1
  };
}

async function runNodeLikeFile(displayName: string, filePath: string, runtime?: InstalledRuntime): Promise<RuntimeRunResult> {
  const extension = path.extname(filePath).toLowerCase();
  let command: string[] | undefined;

  if (extension === ".ts" || extension === ".tsx") {
    const tsx = await commandExists("tsx");
    const tsNode = await commandExists("ts-node");
    if (tsx) command = [tsx, filePath];
    else if (tsNode) command = [tsNode, filePath];
  } else if (runtime) {
    command = [runtime.executablePath, filePath];
  }

  if (!command) {
    return {
      language: displayName,
      output: extension === ".ts" || extension === ".tsx"
        ? "[ERRO] Runtime TypeScript nao encontrado. Instale/configure tsx ou ts-node em Run and Debug."
        : "[ERRO] Runtime Node.js nao encontrado. Configure o caminho em Run and Debug.",
      code: 127
    };
  }

  const result = await runProcess(command[0], command.slice(1), { cwd: path.dirname(filePath), timeoutMs: 120000 });
  return {
    language: displayName,
    output: formatRunOutput(displayName, command, result.output, result.code),
    code: result.code ?? 1
  };
}

async function runJavaSource(displayName: string, filePath: string, source: string): Promise<RuntimeRunResult> {
  const java = await commandExists("java");
  if (!java) {
    return { language: displayName, output: "[ERRO] Runtime Java nao encontrado. Configure java em Run and Debug.", code: 127 };
  }

  const javac = await commandExists("javac");
  if (!javac) {
    const command = [java, filePath];
    const result = await runProcess(command[0], command.slice(1), { cwd: path.dirname(filePath), timeoutMs: 120000 });
    return {
      language: displayName,
      output: formatRunOutput(displayName, command, result.output, result.code),
      code: result.code ?? 1
    };
  }

  const buildDir = path.join(os.tmpdir(), "npsharp-java", createHash("sha1").update(filePath).digest("hex"));
  await fs.rm(buildDir, { recursive: true, force: true });
  await fs.mkdir(buildDir, { recursive: true });

  const compileCommand = [javac, "-d", buildDir, filePath];
  const compile = await runProcess(compileCommand[0], compileCommand.slice(1), { cwd: path.dirname(filePath), timeoutMs: 120000 });
  if ((compile.code ?? 1) !== 0) {
    return {
      language: displayName,
      output: formatRunOutput(`${displayName} compile`, compileCommand, compile.output, compile.code),
      code: compile.code ?? 1
    };
  }

  const className = mainClassName(filePath, source);
  const runCommand = [java, "-cp", buildDir, className];
  const result = await runProcess(runCommand[0], runCommand.slice(1), { cwd: path.dirname(filePath), timeoutMs: 120000 });
  const compileOutput = formatRunOutput(`${displayName} compile`, compileCommand, compile.output || "Compilacao concluida.", compile.code);
  const runOutput = formatRunOutput(displayName, runCommand, result.output, result.code);
  return {
    language: displayName,
    output: `${compileOutput}\n\n${runOutput}`.trim(),
    code: result.code ?? 1
  };
}

async function runRustFile(displayName: string, filePath: string): Promise<RuntimeRunResult> {
  const cargoRoot = await findUp(path.dirname(filePath), "Cargo.toml");
  if (cargoRoot) {
    const cargo = await commandExists("cargo");
    if (!cargo) {
      return { language: displayName, output: "[ERRO] Cargo nao encontrado para executar este projeto Rust.", code: 127 };
    }
    const command = [cargo, "run"];
    const result = await runProcess(command[0], command.slice(1), { cwd: cargoRoot, timeoutMs: 120000 });
    return {
      language: displayName,
      output: formatRunOutput(displayName, command, result.output, result.code),
      code: result.code ?? 1
    };
  }

  const rustc = await commandExists("rustc");
  if (!rustc) {
    return { language: displayName, output: "[ERRO] rustc nao encontrado para executar este arquivo Rust.", code: 127 };
  }

  const buildDir = path.join(os.tmpdir(), "npsharp-rust", createHash("sha1").update(filePath).digest("hex"));
  await fs.rm(buildDir, { recursive: true, force: true });
  await fs.mkdir(buildDir, { recursive: true });
  const binary = path.join(buildDir, process.platform === "win32" ? "main.exe" : "main");
  const compileCommand = [rustc, filePath, "-o", binary];
  const compile = await runProcess(compileCommand[0], compileCommand.slice(1), { cwd: path.dirname(filePath), timeoutMs: 120000 });
  if ((compile.code ?? 1) !== 0) {
    return {
      language: displayName,
      output: formatRunOutput(`${displayName} compile`, compileCommand, compile.output, compile.code),
      code: compile.code ?? 1
    };
  }

  const command = [binary];
  const result = await runProcess(command[0], command.slice(1), { cwd: path.dirname(filePath), timeoutMs: 120000 });
  return {
    language: displayName,
    output: `${formatRunOutput(`${displayName} compile`, compileCommand, compile.output || "Compilacao concluida.", compile.code)}\n\n${formatRunOutput(displayName, command, result.output, result.code)}`.trim(),
    code: result.code ?? 1
  };
}

function buildRunCommand(languageId: string, executable: string, filePath: string): string[] {
  switch (languageId) {
    case "powershell":
      return [executable, "-ExecutionPolicy", "Bypass", "-File", filePath];
    case "go":
      return [executable, "run", filePath];
    case "csharp":
      return [executable, "run", "--project", path.dirname(filePath)];
    case "kotlin":
      return [executable, "-script", filePath];
    default:
      return [executable, filePath];
  }
}

function mainClassName(filePath: string, source: string): string {
  const packageMatch = source.match(/^\s*package\s+([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*;/m);
  const className = path.basename(filePath, ".java");
  return packageMatch ? `${packageMatch[1]}.${className}` : className;
}

async function findUp(startDir: string, fileName: string): Promise<string | undefined> {
  let current = path.resolve(startDir);
  while (true) {
    try {
      await fs.access(path.join(current, fileName));
      return current;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return undefined;
      current = parent;
    }
  }
}

function formatRunOutput(displayName: string, command: string[], output: string, code: number | null): string {
  return [
    `[DEBUG] Runtime selecionado: ${displayName}`,
    `[DEBUG] Comando: ${formatCommand(command)}`,
    output,
    `[DEBUG] Processo finalizado com codigo ${code ?? 1}`
  ].filter(Boolean).join("\n").trim();
}

function formatCommand(command: string[]): string {
  return command.map(part => /\s/.test(part) ? `"${part.replace(/"/g, "\\\"")}"` : part).join(" ");
}

async function readVersion(executable: string): Promise<string> {
  const result = await runProcess(executable, ["--version"], { timeoutMs: 5000 });
  return result.output.split(/\r?\n/).find(Boolean)?.trim() || "detected";
}

async function loadRegistry(): Promise<Map<string, InstalledRuntime>> {
  const map = new Map<string, InstalledRuntime>();
  try {
    const raw = await fs.readFile(runtimeRegistryPath(), "utf8");
    const props = parseProperties(raw);
    for (const language of LANGUAGE_RUNTIMES) {
      const root = props.get(`${language.id}.root`);
      const exe = props.get(`${language.id}.exe`);
      if (!root || !exe) continue;
      const debuggerPath = props.get(`${language.id}.debugger`);
      map.set(language.id, {
        language,
        rootPath: root,
        executablePath: exe,
        debuggerPath: debuggerPath || undefined,
        version: props.get(`${language.id}.version`) ?? "unknown",
        source: "configured"
      });
    }
  } catch {
    // registry is optional
  }
  return map;
}

async function saveRegistryFromInstalled(installed: InstalledRuntime[]): Promise<void> {
  const map = new Map<string, InstalledRuntime>();
  for (const runtime of installed) {
    map.set(runtime.language.id, runtime);
  }
  await saveRegistryMap(map);
}

async function saveRegistryMap(installed: Map<string, InstalledRuntime>): Promise<void> {
  await fs.mkdir(path.dirname(runtimeRegistryPath()), { recursive: true });
  const lines = ["# NPSharp Runtime Registry"];
  for (const runtime of installed.values()) {
    lines.push(`${runtime.language.id}.root=${runtime.rootPath}`);
    lines.push(`${runtime.language.id}.exe=${runtime.executablePath}`);
    if (runtime.debuggerPath) lines.push(`${runtime.language.id}.debugger=${runtime.debuggerPath}`);
    lines.push(`${runtime.language.id}.version=${runtime.version}`);
    lines.push("");
  }
  await fs.writeFile(runtimeRegistryPath(), lines.join("\n"), "utf8");
}

function parseProperties(raw: string): Map<string, string> {
  const props = new Map<string, string>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equals = trimmed.indexOf("=");
    if (equals < 0) continue;
    props.set(trimmed.slice(0, equals).trim(), trimmed.slice(equals + 1).trim());
  }
  return props;
}
