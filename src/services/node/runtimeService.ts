/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import type {
  InstalledRuntime,
  LanguageRuntime,
  LanguageRuntimeConfig,
  LanguageRuntimeState,
  LanguageRuntimeValidation,
  RuntimeDependencyInstallRequest,
  RuntimeDependencyInstallResult,
  RuntimeRunRequest,
  RuntimeRunResult
} from "../../shared/types";
import { PortugolInterpreter } from "../../core/portugol/interpreter";
import { LANGUAGE_RUNTIMES, languageFromFileName } from "../../core/runtime/languages";
import { commandExists, runProcess } from "./processService";
import { languageRuntimesPath, runtimeRegistryPath, toolBinDir } from "./paths";

const CONFIGURABLE_LANGUAGE_IDS = LANGUAGE_RUNTIMES
  .filter(language => language.id !== "git" && language.id !== "portugol")
  .map(language => language.id);
const CONFIGURABLE_LANGUAGE_SET = new Set<string>(CONFIGURABLE_LANGUAGE_IDS);

type RuntimeConfigFile = Record<string, Partial<LanguageRuntimeConfig>>;

const PYTHON_STANDARD_LIBRARY = new Set([
  "__future__", "__main__", "abc", "argparse", "array", "ast", "asyncio", "base64", "binascii", "bisect", "builtins",
  "calendar", "cmath", "collections", "concurrent", "contextlib", "copy", "csv", "ctypes", "dataclasses", "datetime", "decimal",
  "difflib", "dis", "email", "encodings", "enum", "errno", "faulthandler", "filecmp", "fileinput", "fnmatch", "fractions",
  "functools", "gc", "getopt", "getpass", "gettext", "glob", "graphlib", "gzip", "hashlib", "heapq", "hmac", "html", "http",
  "imaplib", "importlib", "inspect", "io", "ipaddress", "itertools", "json", "keyword", "linecache", "locale", "logging", "lzma",
  "mailbox", "marshal", "math", "mimetypes", "mmap", "multiprocessing", "numbers", "operator", "optparse", "os", "pathlib", "pdb",
  "pickle", "pkgutil", "platform", "plistlib", "poplib", "posixpath", "pprint", "profile", "pstats", "pty", "py_compile", "pyclbr",
  "pydoc", "queue", "quopri", "random", "re", "readline", "reprlib", "resource", "rlcompleter", "runpy", "sched", "secrets",
  "select", "selectors", "shelve", "shlex", "shutil", "signal", "site", "smtplib", "socket", "socketserver", "sqlite3", "ssl",
  "stat", "statistics", "string", "stringprep", "struct", "subprocess", "sys", "sysconfig", "tabnanny", "tarfile", "tempfile",
  "termios", "textwrap", "threading", "time", "timeit", "tkinter", "token", "tokenize", "tomllib", "trace", "traceback",
  "tracemalloc", "tty", "turtle", "types", "typing", "unicodedata", "unittest", "urllib", "uuid", "venv", "warnings", "wave",
  "weakref", "webbrowser", "wsgiref", "xml", "xmlrpc", "zipapp", "zipfile", "zipimport", "zlib", "zoneinfo"
]);

const PYTHON_PACKAGE_ALIASES: Record<string, string> = {
  "PIL": "Pillow",
  "bs4": "beautifulsoup4",
  "cv2": "opencv-python",
  "dotenv": "python-dotenv",
  "sklearn": "scikit-learn",
  "yaml": "PyYAML",
  "serial": "pyserial",
  "dateutil": "python-dateutil",
  "Crypto": "pycryptodome",
  "jwt": "PyJWT"
};

export async function listRuntimes(): Promise<InstalledRuntime[]> {
  return discoverRuntimes(false);
}

export async function discoverRuntimes(rescan = true): Promise<InstalledRuntime[]> {
  const states = await resolveRuntimeStates(rescan, rescan);
  const installed: InstalledRuntime[] = [];
  for (const state of states) {
    if (state.status !== "installed" || !state.path) continue;
    installed.push({
      language: state.language,
      rootPath: state.path === path.join(toolBinDir(), "internal-portugol") ? toolBinDir() : path.dirname(state.path),
      executablePath: state.path,
      debuggerPath: state.language.id === "portugol" ? state.path : undefined,
      version: state.version ?? "detected",
      source: state.source === "auto" ? "system" : state.source === "internal" ? "internal" : "configured"
    });
  }
  return installed;
}

export async function configureRuntime(languageId: string, executablePath: string): Promise<InstalledRuntime[]> {
  const config = await loadRuntimeConfig();
  const language = requireLanguage(languageId);
  if (language.id === "portugol") return discoverRuntimes(true);
  config.set(language.id, { path: executablePath.trim(), autoDetect: false });
  await saveRuntimeConfig(config);
  return discoverRuntimes(true);
}

export async function listRuntimeConfigStates(): Promise<LanguageRuntimeState[]> {
  return resolveRuntimeStates(true, true, configurableLanguages());
}

export async function updateRuntimeConfig(languageId: string, nextConfig: LanguageRuntimeConfig): Promise<LanguageRuntimeState[]> {
  const language = requireConfigurableLanguage(languageId);
  const config = await loadRuntimeConfig();
  config.set(language.id, normalizeRuntimeConfig(nextConfig));
  await saveRuntimeConfig(config);
  return listRuntimeConfigStates();
}

export async function autoDetectRuntime(languageId: string): Promise<LanguageRuntimeState[]> {
  const language = requireConfigurableLanguage(languageId);
  const config = await loadRuntimeConfig();
  const detectedPath = await detectExecutable(language);
  config.set(language.id, { path: detectedPath ?? "", autoDetect: true });
  await saveRuntimeConfig(config);
  return listRuntimeConfigStates();
}

export async function validateRuntime(languageId: string, executablePath?: string): Promise<LanguageRuntimeValidation> {
  const language = requireLanguage(languageId);
  const value = executablePath?.trim();
  if (value) return validateExecutable(language, value);

  const config = await loadRuntimeConfig();
  const state = await resolveLanguageState(language, config.get(language.id) ?? defaultRuntimeConfig(language), true);
  return {
    languageId: language.id,
    path: state.path,
    version: state.version,
    status: state.status,
    message: state.message
  };
}

/**
 * Creates a project-local Python environment and installs the dependencies requested by the active source file.
 * The action is deliberately explicit in the UI, so package downloads never happen during an ordinary Run.
 */
export async function installRuntimeDependencies(request: RuntimeDependencyInstallRequest): Promise<RuntimeDependencyInstallResult> {
  const language = languageFromFileName(path.basename(request.filePath));
  if (language?.id !== "python") {
    return {
      output: "[ERRO] O download automático de imports está disponível somente para arquivos Python (.py).",
      code: 1,
      packages: []
    };
  }

  const source = request.content ?? await fs.readFile(request.filePath, "utf8");
  const runtimes = await discoverRuntimes(true);
  const runtime = runtimes.find(item => item.language.id === "python");
  if (!runtime) {
    return {
      language: language.displayName,
      output: "[ERRO] Runtime Python não encontrado. Configure Python em Configurar runtimes de linguagem.",
      code: 127,
      packages: []
    };
  }

  const projectRoot = await findPythonProjectRoot(path.dirname(request.filePath), request.workspace);
  const environmentPath = path.join(projectRoot, ".venv");
  const environmentPython = pythonVenvExecutable(environmentPath);
  const output: string[] = [`[Python] Projeto: ${projectRoot}`, `[Python] Ambiente local: ${environmentPath}`];
  let failed = false;

  if (!await executableExists(environmentPython)) {
    const create = await runProcess(runtime.executablePath, ["-m", "venv", environmentPath], { cwd: projectRoot, timeoutMs: 120000 });
    output.push(formatRunOutput("Python venv", [runtime.executablePath, "-m", "venv", environmentPath], create.output || "Ambiente criado.", create.code));
    if ((create.code ?? 1) !== 0 || !await executableExists(environmentPython)) {
      return {
        language: language.displayName,
        output: output.join("\n\n"),
        code: create.code ?? 1,
        environmentPath,
        packages: []
      };
    }
  } else {
    output.push("[Python] Usando o .venv já existente.");
  }

  const requirements = path.join(projectRoot, "requirements.txt");
  if (await fileExists(requirements)) {
    const installRequirements = await runProcess(
      environmentPython,
      ["-m", "pip", "install", "--disable-pip-version-check", "-r", requirements],
      { cwd: projectRoot, timeoutMs: 300000 }
    );
    output.push(formatRunOutput("Python requirements", [environmentPython, "-m", "pip", "install", "-r", requirements], installRequirements.output, installRequirements.code));
    failed ||= (installRequirements.code ?? 1) !== 0;
  }

  const packages = await pythonPackagesFromImports(source, projectRoot, path.dirname(request.filePath));
  if (!packages.length) {
    output.push("[Python] Nenhum import externo adicional foi detectado.");
  }
  for (const packageName of packages) {
    const install = await runProcess(
      environmentPython,
      ["-m", "pip", "install", "--disable-pip-version-check", packageName],
      { cwd: projectRoot, timeoutMs: 300000 }
    );
    output.push(formatRunOutput("Python pip", [environmentPython, "-m", "pip", "install", packageName], install.output, install.code));
    failed ||= (install.code ?? 1) !== 0;
  }

  output.push(failed
    ? "[Python] O .venv foi preservado; corrija os pacotes que falharam e tente novamente."
    : "[Python] Dependências preparadas no .venv. A próxima execução usará este ambiente.");
  return {
    language: language.displayName,
    output: output.join("\n\n").trim(),
    code: failed ? 1 : 0,
    environmentPath,
    packages
  };
}

export async function runFile(request: RuntimeRunRequest): Promise<RuntimeRunResult> {
  const language = languageFromFileName(path.basename(request.filePath));
  if (!language || language.id === "git") {
    return { output: `[ERRO] Linguagem nao reconhecida para ${path.basename(request.filePath)}`, code: 1 };
  }

  const debugWarning = request.debug
    ? `[AVISO] O depurador integrado para ${language.displayName} nao esta disponivel. Executando sem depuracao.`
    : undefined;
  const complete = (result: RuntimeRunResult): RuntimeRunResult => debugWarning
    ? { ...result, output: `${debugWarning}\n${result.output}`.trim() }
    : result;

  const source = request.content ?? await fs.readFile(request.filePath, "utf8");
  if (language.id === "portugol") {
    const output: string[] = [];
    const interpreter = new PortugolInterpreter();
    interpreter.executeWithOutput(source, line => output.push(`[PORTUGOL] ${line}`));
    return complete({
      language: language.displayName,
      output: [`[Run] Runtime Portugol selecionado`, ...output, "[Run] Execucao finalizada"].join("\n"),
      code: output.some(line => line.includes("[ERRO]")) ? 1 : 0
    });
  }

  const runtimes = await discoverRuntimes(true);
  const runtime = runtimes.find(item => item.language.id === language.id);

  if (language.id === "python") {
    return complete(await runPythonFile(language.displayName, request.filePath, runtime, request.workspace));
  }

  if (language.id === "node") {
    return complete(await runNodeLikeFile(language.displayName, request.filePath, runtime));
  }

  if (language.id === "java") {
    return complete(await runJavaSource(language.displayName, request.filePath, source, runtime));
  }

  if (language.id === "rust") {
    return complete(await runRustFile(language.displayName, request.filePath, runtime));
  }

  if (language.id === "c" || language.id === "cpp") {
    return complete(await runNativeSource(language.displayName, request.filePath, runtime));
  }

  if (language.id === "csharp") {
    return complete(await runCSharpSource(language.displayName, request.filePath, runtime));
  }

  if (language.id === "kotlin") {
    return complete(await runKotlinSource(language.displayName, request.filePath, runtime));
  }

  if (!runtime) {
    return complete({
      language: language.displayName,
      output: `[ERRO] Runtime nao encontrado: ${language.displayName}. Use Configure Language Runtimes para definir ou detectar o executavel.`,
      code: 127
    });
  }

  const command = buildRunCommand(language.id, runtime.executablePath, request.filePath);
  const result = await runProcess(command[0], command.slice(1), {
    cwd: path.dirname(request.filePath),
    timeoutMs: 120000,
    env: { SHARP_RUNTIME_HOME: runtime.rootPath, PATH: `${toolBinDir()}${path.delimiter}${process.env.PATH ?? ""}` }
  });

  return complete({
    language: language.displayName,
    output: formatRunOutput(language.displayName, command, result.output, result.code),
    code: result.code ?? 1
  });
}

async function resolveRuntimeStates(
  rescan: boolean,
  persistDetected: boolean,
  languages = LANGUAGE_RUNTIMES
): Promise<LanguageRuntimeState[]> {
  const config = await loadRuntimeConfig();
  const states: LanguageRuntimeState[] = [];
  let changed = false;

  for (const language of languages) {
    const configured = config.get(language.id) ?? defaultRuntimeConfig(language);
    const state = await resolveLanguageState(language, configured, rescan);
    states.push(state);

    if (persistDetected && CONFIGURABLE_LANGUAGE_SET.has(language.id) && state.config.autoDetect) {
      const detectedPath = state.detectedPath ?? "";
      const current = config.get(language.id) ?? defaultRuntimeConfig(language);
      if (current.path !== detectedPath || current.autoDetect !== true) {
        config.set(language.id, { path: detectedPath, autoDetect: true });
        changed = true;
      }
    }
  }

  if (changed) await saveRuntimeConfig(config);
  return states;
}

async function resolveLanguageState(language: LanguageRuntime, config: LanguageRuntimeConfig, rescan: boolean): Promise<LanguageRuntimeState> {
  if (language.id === "portugol") {
    const executable = path.join(toolBinDir(), "internal-portugol");
    return {
      language,
      languageId: language.id,
      config: { path: executable, autoDetect: false },
      path: executable,
      version: "sharp",
      status: "installed",
      source: "internal",
      message: "Runtime interno do Sharp-OSS."
    };
  }

  const normalized = normalizeRuntimeConfig(config);
  if (normalized.autoDetect) {
    const detectedPath = rescan ? await detectExecutable(language) : normalized.path || undefined;
    if (!detectedPath) {
      return {
        language,
        languageId: language.id,
        config: normalized,
        status: "missing",
        source: "missing",
        message: `${language.displayName} nao foi encontrado no PATH.`
      };
    }
    const validation = await validateExecutable(language, detectedPath);
    return {
      ...validation,
      language,
      config: normalized,
      detectedPath,
      source: validation.status === "installed" ? "auto" : "missing"
    };
  }

  if (!normalized.path) {
    return {
      language,
      languageId: language.id,
      config: normalized,
      status: "missing",
      source: "missing",
      message: `${language.displayName} ainda nao possui executavel configurado.`
    };
  }

  const validation = await validateExecutable(language, normalized.path);
  return {
    ...validation,
    language,
    config: normalized,
    source: validation.status === "installed" ? "configured" : "missing"
  };
}

async function detectExecutable(language: LanguageRuntime): Promise<string | undefined> {
  for (const candidate of language.executableCandidates) {
    const executable = await commandExists(candidate);
    if (executable) return executable;
  }
  return undefined;
}

async function validateExecutable(language: LanguageRuntime, executablePath: string): Promise<LanguageRuntimeValidation> {
  const resolved = await commandExists(executablePath) ?? executablePath;
  try {
    await fs.access(resolved, process.platform === "win32" ? fsConstants.F_OK : fsConstants.X_OK);
  } catch {
    return {
      languageId: language.id,
      path: resolved,
      status: "invalid",
      message: `Executavel invalido: ${resolved}`
    };
  }

  const version = await readVersion(language.id, resolved);
  if (!version) {
    return {
      languageId: language.id,
      path: resolved,
      status: "invalid",
      message: `Nao foi possivel validar ${language.displayName}.`
    };
  }

  return {
    languageId: language.id,
    path: resolved,
    version,
    status: "installed",
    message: `${language.displayName} instalado.`
  };
}

async function loadRuntimeConfig(): Promise<Map<string, LanguageRuntimeConfig>> {
  const file = languageRuntimesPath();
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as RuntimeConfigFile;
    const config = configMapFromObject(parsed);
    let changed = ensureConfigurableDefaults(config);
    if (changed) await saveRuntimeConfig(config);
    return config;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(`[Sharp-OSS runtime] Failed to read ${file}; defaults will be used.`, error);
    }
  }

  const config = await loadLegacyRuntimeConfig();
  ensureConfigurableDefaults(config);
  await saveRuntimeConfig(config);
  return config;
}

async function saveRuntimeConfig(config: Map<string, LanguageRuntimeConfig>): Promise<void> {
  const file = languageRuntimesPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const payload: Record<string, LanguageRuntimeConfig> = {};
  for (const language of configurableLanguages()) {
    payload[language.id] = normalizeRuntimeConfig(config.get(language.id) ?? defaultRuntimeConfig(language));
  }
  await fs.writeFile(file, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

function configMapFromObject(parsed: RuntimeConfigFile): Map<string, LanguageRuntimeConfig> {
  const config = new Map<string, LanguageRuntimeConfig>();
  for (const language of LANGUAGE_RUNTIMES) {
    const value = parsed[language.id];
    if (!value || typeof value !== "object") continue;
    config.set(language.id, normalizeRuntimeConfig(value));
  }
  return config;
}

async function loadLegacyRuntimeConfig(): Promise<Map<string, LanguageRuntimeConfig>> {
  const map = new Map<string, LanguageRuntimeConfig>();
  try {
    const raw = await fs.readFile(runtimeRegistryPath(), "utf8");
    const props = parseProperties(raw);
    for (const language of LANGUAGE_RUNTIMES) {
      const executable = props.get(`${language.id}.exe`);
      if (executable) map.set(language.id, { path: executable, autoDetect: false });
    }
  } catch {
    // Legacy registry is optional and only used for migration.
  }
  return map;
}

function ensureConfigurableDefaults(config: Map<string, LanguageRuntimeConfig>): boolean {
  let changed = false;
  for (const language of configurableLanguages()) {
    if (!config.has(language.id)) {
      config.set(language.id, defaultRuntimeConfig(language));
      changed = true;
    }
  }
  return changed;
}

function defaultRuntimeConfig(language: LanguageRuntime): LanguageRuntimeConfig {
  return {
    path: "",
    autoDetect: CONFIGURABLE_LANGUAGE_SET.has(language.id)
  };
}

function normalizeRuntimeConfig(config: Partial<LanguageRuntimeConfig>): LanguageRuntimeConfig {
  return {
    path: typeof config.path === "string" ? config.path.trim() : "",
    autoDetect: Boolean(config.autoDetect)
  };
}

function configurableLanguages(): LanguageRuntime[] {
  return CONFIGURABLE_LANGUAGE_IDS
    .map(id => LANGUAGE_RUNTIMES.find(language => language.id === id))
    .filter((language): language is LanguageRuntime => Boolean(language));
}

function requireLanguage(languageId: string): LanguageRuntime {
  const language = LANGUAGE_RUNTIMES.find(item => item.id === languageId);
  if (!language) throw new Error(`Runtime desconhecido: ${languageId}`);
  return language;
}

function requireConfigurableLanguage(languageId: string): LanguageRuntime {
  const language = requireLanguage(languageId);
  if (!CONFIGURABLE_LANGUAGE_SET.has(language.id)) {
    throw new Error(`Runtime nao configuravel: ${language.displayName}`);
  }
  return language;
}

async function runPythonFile(displayName: string, filePath: string, runtime?: InstalledRuntime, workspace?: string): Promise<RuntimeRunResult> {
  if (!runtime) {
    return {
      language: displayName,
      output: "[ERRO] Runtime Python não encontrado. Configure o caminho em Configurar runtimes de linguagem.",
      code: 127
    };
  }

  const projectRoot = await findPythonProjectRoot(path.dirname(filePath), workspace);
  const environmentPython = pythonVenvExecutable(path.join(projectRoot, ".venv"));
  const python = await executableExists(environmentPython) ? environmentPython : runtime.executablePath;
  const command = [python, filePath];
  const result = await runProcess(command[0], command.slice(1), { cwd: path.dirname(filePath), timeoutMs: 120000 });
  const environment = python === environmentPython
    ? `[Python] Ambiente: ${path.join(projectRoot, ".venv")}`
    : "[Python] Ambiente: interpretador configurado (nenhum .venv do projeto foi encontrado).";
  return {
    language: displayName,
    output: `${environment}\n${formatRunOutput(displayName, command, result.output, result.code)}`,
    code: result.code ?? 1
  };
}

function pythonVenvExecutable(environmentPath: string): string {
  return process.platform === "win32"
    ? path.join(environmentPath, "Scripts", "python.exe")
    : path.join(environmentPath, "bin", "python");
}

async function findPythonProjectRoot(startDir: string, workspace?: string): Promise<string> {
  if (workspace && isPathInside(startDir, workspace)) return path.resolve(workspace);

  const fallback = path.resolve(startDir);
  let current = path.resolve(startDir);
  while (true) {
    if (await hasAnyFile(current, ["pyproject.toml", "requirements.txt", "setup.py", "setup.cfg"])) return current;
    const parent = path.dirname(current);
    if (parent === current) return fallback;
    current = parent;
  }
}

function isPathInside(child: string, parent: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

async function hasAnyFile(directory: string, names: string[]): Promise<boolean> {
  for (const name of names) {
    if (await fileExists(path.join(directory, name))) return true;
  }
  return false;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function executableExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, process.platform === "win32" ? fsConstants.F_OK : fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function pythonPackagesFromImports(source: string, projectRoot: string, sourceDirectory: string): Promise<string[]> {
  const modules = new Set<string>();
  for (const line of source.split(/\r?\n/)) {
    const stripped = line.replace(/#.*/, "").trim();
    if (!stripped) continue;
    const importMatch = stripped.match(/^import\s+(.+)$/);
    if (importMatch) {
      for (const item of importMatch[1].split(",")) {
        const moduleName = item.trim().split(/\s+as\s+/i)[0]?.trim();
        const topLevel = moduleName?.split(".")[0];
        if (topLevel) modules.add(topLevel);
      }
      continue;
    }
    const fromMatch = stripped.match(/^from\s+([\w.]+)\s+import\s+/);
    const topLevel = fromMatch?.[1]?.split(".")[0];
    if (topLevel) modules.add(topLevel);
  }

  const packages: string[] = [];
  for (const moduleName of modules) {
    if (PYTHON_STANDARD_LIBRARY.has(moduleName) || await isLocalPythonModule(moduleName, sourceDirectory, projectRoot)) continue;
    packages.push(PYTHON_PACKAGE_ALIASES[moduleName] ?? moduleName);
  }
  return [...new Set(packages)].sort((left, right) => left.localeCompare(right));
}

async function isLocalPythonModule(moduleName: string, sourceDirectory: string, projectRoot: string): Promise<boolean> {
  const directories = [...new Set([sourceDirectory, projectRoot])];
  for (const directory of directories) {
    if (await fileExists(path.join(directory, `${moduleName}.py`))) return true;
    if (await fileExists(path.join(directory, moduleName, "__init__.py"))) return true;
  }
  return false;
}

async function runNodeLikeFile(displayName: string, filePath: string, runtime?: InstalledRuntime): Promise<RuntimeRunResult> {
  const extension = path.extname(filePath).toLowerCase();
  let command: string[] | undefined;

  if (extension === ".ts" || extension === ".tsx") {
    const tsNode = await commandExists("ts-node");
    const tsx = await commandExists("tsx");
    if (tsNode) command = [tsNode, filePath];
    else if (tsx) command = [tsx, filePath];
  } else if (runtime) {
    command = [runtime.executablePath, filePath];
  }

  if (!command) {
    return {
      language: displayName,
      output: extension === ".ts" || extension === ".tsx"
        ? "[ERRO] Runtime TypeScript nao encontrado. Instale/configure tsx ou ts-node em Configure Language Runtimes."
        : "[ERRO] Runtime Node.js nao encontrado. Configure o caminho em Configure Language Runtimes.",
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

async function runJavaSource(displayName: string, filePath: string, source: string, runtime?: InstalledRuntime): Promise<RuntimeRunResult> {
  const java = runtime?.executablePath ?? await commandExists("java");
  if (!java) {
    return { language: displayName, output: "[ERRO] Runtime Java nao encontrado. Configure java em Configure Language Runtimes.", code: 127 };
  }

  const javac = await siblingExecutable(java, "javac") ?? await commandExists("javac");
  if (!javac) {
    const command = [java, filePath];
    const result = await runProcess(command[0], command.slice(1), { cwd: path.dirname(filePath), timeoutMs: 120000 });
    return {
      language: displayName,
      output: formatRunOutput(displayName, command, result.output, result.code),
      code: result.code ?? 1
    };
  }

  const buildDir = path.join(os.tmpdir(), "sharp-java", createHash("sha1").update(filePath).digest("hex"));
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

async function runRustFile(displayName: string, filePath: string, runtime?: InstalledRuntime): Promise<RuntimeRunResult> {
  const cargoRoot = await findUp(path.dirname(filePath), "Cargo.toml");
  if (cargoRoot) {
    const cargo = runtime && path.basename(runtime.executablePath).toLowerCase().startsWith("cargo")
      ? runtime.executablePath
      : await commandExists("cargo");
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

  const rustc = runtime && path.basename(runtime.executablePath).toLowerCase().startsWith("rustc")
    ? runtime.executablePath
    : await commandExists("rustc");
  if (!rustc) {
    return { language: displayName, output: "[ERRO] rustc nao encontrado para executar este arquivo Rust.", code: 127 };
  }

  const buildDir = path.join(os.tmpdir(), "sharp-rust", createHash("sha1").update(filePath).digest("hex"));
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

async function runNativeSource(displayName: string, filePath: string, runtime?: InstalledRuntime): Promise<RuntimeRunResult> {
  if (!runtime) {
    return { language: displayName, output: `[ERRO] Compilador ${displayName} nao encontrado. Configure-o em Configure Language Runtimes.`, code: 127 };
  }

  const buildDir = path.join(os.tmpdir(), "sharp-native", createHash("sha1").update(filePath).digest("hex"));
  await fs.rm(buildDir, { recursive: true, force: true });
  await fs.mkdir(buildDir, { recursive: true });
  const binary = path.join(buildDir, process.platform === "win32" ? "program.exe" : "program");
  const compileCommand = [runtime.executablePath, filePath, "-o", binary];
  const compile = await runProcess(compileCommand[0], compileCommand.slice(1), { cwd: path.dirname(filePath), timeoutMs: 120000 });
  if ((compile.code ?? 1) !== 0) {
    return {
      language: displayName,
      output: formatRunOutput(`${displayName} compile`, compileCommand, compile.output, compile.code),
      code: compile.code ?? 1
    };
  }

  const command = [binary];
  const result = await runProcess(command[0], [], { cwd: path.dirname(filePath), timeoutMs: 120000 });
  return {
    language: displayName,
    output: `${formatRunOutput(`${displayName} compile`, compileCommand, compile.output || "Compilacao concluida.", compile.code)}\n\n${formatRunOutput(displayName, command, result.output, result.code)}`.trim(),
    code: result.code ?? 1
  };
}

async function runCSharpSource(displayName: string, filePath: string, runtime?: InstalledRuntime): Promise<RuntimeRunResult> {
  const dotnet = runtime?.executablePath ?? await commandExists("dotnet");
  if (!dotnet) {
    return { language: displayName, output: "[ERRO] Runtime .NET nao encontrado. Configure dotnet em Configure Language Runtimes.", code: 127 };
  }

  const project = await findProjectFile(path.dirname(filePath), ".csproj");
  let generatedProject: string | undefined;
  if (!project) {
    const buildDir = path.join(os.tmpdir(), "sharp-csharp", createHash("sha1").update(filePath).digest("hex"));
    await fs.rm(buildDir, { recursive: true, force: true });
    await fs.mkdir(buildDir, { recursive: true });
    generatedProject = path.join(buildDir, "SharpRun.csproj");
    await fs.writeFile(generatedProject, createCSharpProject(filePath, await dotnetTargetFramework(dotnet)), "utf8");
  }
  const command = [dotnet, "run", "--project", project ?? generatedProject!];
  const result = await runProcess(command[0], command.slice(1), { cwd: path.dirname(filePath), timeoutMs: 120000 });
  return {
    language: displayName,
    output: formatRunOutput(displayName, command, result.output, result.code),
    code: result.code ?? 1
  };
}

async function runKotlinSource(displayName: string, filePath: string, runtime?: InstalledRuntime): Promise<RuntimeRunResult> {
  const extension = path.extname(filePath).toLowerCase();
  const configured = runtime?.executablePath;
  const kotlinc = configured && path.basename(configured).toLowerCase().startsWith("kotlinc")
    ? configured
    : await siblingExecutable(configured ?? "", "kotlinc") ?? await commandExists("kotlinc");

  if (extension === ".kts" && !kotlinc && configured) {
    const command = [configured, filePath];
    const result = await runProcess(command[0], command.slice(1), { cwd: path.dirname(filePath), timeoutMs: 120000 });
    return { language: displayName, output: formatRunOutput(displayName, command, result.output, result.code), code: result.code ?? 1 };
  }
  if (!kotlinc) {
    return { language: displayName, output: "[ERRO] Compilador Kotlin (kotlinc) nao encontrado. Configure-o em Configure Language Runtimes.", code: 127 };
  }

  const java = await commandExists("java");
  if (!java) {
    return { language: displayName, output: "[ERRO] Runtime Java nao encontrado para executar Kotlin.", code: 127 };
  }
  const buildDir = path.join(os.tmpdir(), "sharp-kotlin", createHash("sha1").update(filePath).digest("hex"));
  await fs.rm(buildDir, { recursive: true, force: true });
  await fs.mkdir(buildDir, { recursive: true });
  const jar = path.join(buildDir, "program.jar");
  const compileCommand = [kotlinc, filePath, "-include-runtime", "-d", jar];
  const compile = await runProcess(compileCommand[0], compileCommand.slice(1), { cwd: path.dirname(filePath), timeoutMs: 120000 });
  if ((compile.code ?? 1) !== 0) {
    return { language: displayName, output: formatRunOutput(`${displayName} compile`, compileCommand, compile.output, compile.code), code: compile.code ?? 1 };
  }
  const command = [java, "-jar", jar];
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

async function findProjectFile(startDir: string, extension: string): Promise<string | undefined> {
  let current = path.resolve(startDir);
  while (true) {
    try {
      const entries = await fs.readdir(current, { withFileTypes: true });
      const project = entries.find(entry => entry.isFile() && entry.name.toLowerCase().endsWith(extension));
      if (project) return path.join(current, project.name);
    } catch {
      // A directory that cannot be inspected cannot contain a usable project file.
    }
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

async function dotnetTargetFramework(dotnet: string): Promise<string> {
  const result = await runProcess(dotnet, ["--list-sdks"], { timeoutMs: 5000 });
  const versions = [...result.output.matchAll(/^(\d+)\.(\d+)\.\d+/gm)];
  const latest = versions.at(-1);
  return latest ? `net${latest[1]}.${latest[2]}` : "net8.0";
}

function createCSharpProject(sourcePath: string, targetFramework: string): string {
  const includePath = sourcePath.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return [
    '<Project Sdk="Microsoft.NET.Sdk">',
    "  <PropertyGroup>",
    "    <OutputType>Exe</OutputType>",
    `    <TargetFramework>${targetFramework}</TargetFramework>`,
    "    <ImplicitUsings>enable</ImplicitUsings>",
    "    <Nullable>enable</Nullable>",
    "  </PropertyGroup>",
    "  <ItemGroup>",
    `    <Compile Include="${includePath}" Link="Program.cs" />`,
    "  </ItemGroup>",
    "</Project>",
    ""
  ].join("\n");
}

async function siblingExecutable(executable: string, siblingName: string): Promise<string | undefined> {
  const extension = process.platform === "win32" ? ".exe" : "";
  const sibling = path.join(path.dirname(executable), `${siblingName}${extension}`);
  try {
    await fs.access(sibling, process.platform === "win32" ? fsConstants.F_OK : fsConstants.X_OK);
    return sibling;
  } catch {
    return undefined;
  }
}

function formatRunOutput(displayName: string, command: string[], output: string, code: number | null): string {
  return [
    `[Run] Runtime selecionado: ${displayName}`,
    `[Run] Comando: ${formatCommand(command)}`,
    output,
    `[Run] Processo finalizado com codigo ${code ?? 1}`
  ].filter(Boolean).join("\n").trim();
}

function formatCommand(command: string[]): string {
  return command.map(part => /\s/.test(part) ? `"${part.replace(/"/g, "\\\"")}"` : part).join(" ");
}

async function readVersion(languageId: string, executable: string): Promise<string> {
  const args = versionArgs(languageId);
  const result = await runProcess(executable, args, { timeoutMs: 5000 });
  return result.output.split(/\r?\n/).find(Boolean)?.trim() || "";
}

function versionArgs(languageId: string): string[] {
  switch (languageId) {
    case "go":
      return ["version"];
    case "java":
    case "kotlin":
      return ["-version"];
    case "lua":
      return ["-v"];
    default:
      return ["--version"];
  }
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
