import fs from "node:fs/promises";
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
    output: `[DEBUG] Runtime selecionado: ${language.displayName}\n${result.output}\n[DEBUG] Processo finalizado com codigo ${result.code ?? 1}`.trim(),
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
