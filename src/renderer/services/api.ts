import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import type {
  AppInfo,
  AppSettings,
  ArduinoCliRequest,
  ArduinoCompileRequest,
  ArduinoConfig,
  ArduinoConfigRequest,
  ArduinoCreateSketchRequest,
  ArduinoMonitorRequest,
  ArduinoOperationResult,
  ArduinoSaveConfigRequest,
  ArduinoUploadRequest,
  DialogFileResult,
  EditorDiagnostic,
  FileReadResult,
  GitCommit,
  GitFileStatus,
  GitOperationResult,
  GitRepositoryStatus,
  InstalledRuntime,
  LiveServerRequest,
  LiveServerResult,
  NpsharpApi,
  PersistedSession,
  RemoteCommandRequest,
  RemoteFileRequest,
  RemoteHostConfig,
  RemoteListRequest,
  ReplaceAllRequest,
  ReplaceAllResult,
  RuntimeRunRequest,
  RuntimeRunResult,
  SaveFileRequest,
  SaveFileResult,
  SearchQuery,
  SearchResult,
  TemplateApplyRequest,
  TerminalCreateRequest,
  TerminalDataEvent,
  TerminalExitEvent,
  TerminalRunRequest,
  TerminalRunResult,
  TerminalSessionInfo,
  TerminalShellOption,
  WorkspaceEntry
} from "../../shared/types";
import { basename, dirname, extname, joinPath, relativePath } from "../utils/path";
import { DEFAULT_MOBILE_WORKSPACE, getDesktopApi, MOBILE_ROOT, MOBILE_WORKSPACES_ROOT, platform, type PlatformInfo } from "./platform";

export { DEFAULT_MOBILE_WORKSPACE, MOBILE_ROOT, MOBILE_WORKSPACES_ROOT, platform } from "./platform";

type FsApi = NpsharpApi["fs"];
type RemoteApi = NpsharpApi["remote"];

export interface RendererApi extends NpsharpApi {
  platform: PlatformInfo;
  notes: {
    path(workspace?: string): string;
    read(workspace?: string): Promise<FileReadResult>;
    write(content: string, workspace?: string): Promise<void>;
  };
  theme: {
    get(): Promise<string>;
    set(theme: string): Promise<AppSettings>;
  };
  projectHealth: {
    java(workspace: string, filePath?: string): Promise<EditorDiagnostic[]>;
    summary(): Promise<string>;
  };
  buildGuard: {
    platform: PlatformInfo;
    describe(feature: "git" | "terminal" | "liveServer" | "run"): string;
  };
  run: {
    file(request: RuntimeRunRequest): Promise<RuntimeRunResult>;
    canRun(filePath: string): boolean;
  };
}

const SETTINGS_PATH = `${MOBILE_ROOT}/settings.json`;
const SESSION_PATH = `${MOBILE_ROOT}/session.json`;
const REMOTE_HOSTS_PATH = `${MOBILE_ROOT}/remote-hosts.json`;
const ARDUINO_CONFIG_PATH = `${MOBILE_ROOT}/.npsharp/arduino.json`;
const NOTES_PATH = `${MOBILE_ROOT}/notes.nps.md`;

const DEFAULT_SETTINGS: AppSettings = {
  theme: "np-dark",
  iconTheme: "default",
  iconColor: "",
  wallpaperPath: "",
  wallpaperOpacity: 0.18,
  editorFontFamily: "JetBrains Mono",
  editorFontSize: 14,
  editorTabSize: 4,
  editorWordWrap: false,
  editorLineNumbers: true,
  editorAutoSave: false,
  editorFormatOnSave: false,
  brandSpecialName: "",
  terminalEnabled: true,
  terminalShellLinux: "/bin/bash",
  terminalShellWindows: "powershell.exe",
  terminalInitialDirectory: "",
  diagnosticsEnabled: true,
  errorLensEnabled: true,
  compileOnSave: false,
  problemsAutoOpen: true,
  buildCommand: "mvn -q -DskipTests compile",
  buildSkipTests: true,
  statusBarVisible: true,
  activityBarVisible: true,
  sideBarVisible: true
};

const DEFAULT_SESSION: PersistedSession = {
  openFiles: [],
  sidePanel: "explorer",
  terminalVisible: true
};

const NOTES_TEMPLATE = "# NPSharp Notes\n\n## TODO\n\n- \n\n## Ideias\n\n## Bugs\n\n## Observacoes\n";
const MOBILE_GIT_MESSAGE = "Git nativo ainda nao esta disponivel no mobile.";
const WEB_GIT_MESSAGE = "Git local nao esta disponivel neste modo web.";
const MOBILE_TERMINAL_MESSAGE = "Terminal real Node nao esta disponivel no mobile. Use este painel como Output/Command Log.";
const WEB_TERMINAL_MESSAGE = "Terminal real nao esta disponivel no modo web. Use este painel como Output/Command Log.";
const MOBILE_ARDUINO_MESSAGE = "Arduino CLI nao esta disponivel no mobile. Use este painel para manter configuracao e sketches; compile/upload dependem do desktop.";
const WEB_ARDUINO_MESSAGE = "Arduino CLI nao esta disponivel no modo web. Compile/upload dependem do desktop.";
const SEARCH_IGNORED_DIRECTORIES = new Set(["node_modules", "dist", "dist-electron", "release", ".git", "build", ".cache"]);

class CapacitorSandboxFs implements FsApi {
  async listDir(path: string): Promise<WorkspaceEntry[]> {
    await this.ensureRoot();
    const target = normalizeSandboxPath(path);
    const result = await Filesystem.readdir({ path: target, directory: Directory.Documents });
    return result.files
      .map(file => ({
        path: joinPath(target, file.name),
        name: file.name,
        directory: file.type === "directory",
        size: file.type === "directory" ? 0 : file.size,
        modifiedAt: file.mtime,
        hidden: file.name.startsWith(".")
      }))
      .sort(sortEntries);
  }

  async readFile(path: string): Promise<FileReadResult> {
    await this.ensureRoot();
    const target = normalizeSandboxPath(path);
    const result = await Filesystem.readFile({ path: target, directory: Directory.Documents, encoding: Encoding.UTF8 });
    const content = typeof result.data === "string" ? result.data : await result.data.text();
    return fileReadResult(target, content);
  }

  async writeFile(path: string, content: string): Promise<void> {
    await this.ensureRoot();
    const target = normalizeSandboxPath(path);
    await this.ensureParent(target);
    await Filesystem.writeFile({
      path: target,
      data: content,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true
    });
  }

  async createFile(path: string): Promise<void> {
    const target = normalizeSandboxPath(path);
    if (!target) return;
    if (!await this.exists(target)) {
      await this.writeFile(target, "");
    }
  }

  async createFolder(path: string): Promise<void> {
    const target = normalizeSandboxPath(path);
    if (!target) return;
    try {
      await Filesystem.mkdir({ path: target, directory: Directory.Documents, recursive: true });
    } catch (error) {
      if (!await this.exists(target)) throw error;
    }
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    await this.ensureRoot();
    const from = normalizeSandboxPath(oldPath);
    const to = normalizeSandboxPath(newPath);
    await this.ensureParent(to);
    await Filesystem.rename({ from, to, directory: Directory.Documents });
  }

  async delete(path: string): Promise<void> {
    await this.ensureRoot();
    const target = normalizeSandboxPath(path);
    const stat = await Filesystem.stat({ path: target, directory: Directory.Documents });
    if (stat.type === "directory") {
      await Filesystem.rmdir({ path: target, directory: Directory.Documents, recursive: true });
      return;
    }
    await Filesystem.deleteFile({ path: target, directory: Directory.Documents });
  }

  async reveal(_path: string): Promise<void> {
    return;
  }

  async exists(path: string): Promise<boolean> {
    try {
      await Filesystem.stat({ path: normalizeSandboxPath(path), directory: Directory.Documents });
      return true;
    } catch {
      return false;
    }
  }

  private async ensureRoot(): Promise<void> {
    await this.createFolder(MOBILE_ROOT);
    await this.createFolder(MOBILE_WORKSPACES_ROOT);
    await this.createFolder(DEFAULT_MOBILE_WORKSPACE);
  }

  private async ensureParent(path: string): Promise<void> {
    const parent = dirname(path);
    if (parent) await this.createFolder(parent);
  }
}

interface StoredEntry {
  directory: boolean;
  content?: string;
  modifiedAt: number;
}

class LocalSandboxFs implements FsApi {
  private entries = new Map<string, StoredEntry>();

  constructor() {
    this.load();
    this.ensureFolderSync(MOBILE_ROOT);
    this.ensureFolderSync(MOBILE_WORKSPACES_ROOT);
    this.ensureFolderSync(DEFAULT_MOBILE_WORKSPACE);
    this.persist();
  }

  async listDir(path: string): Promise<WorkspaceEntry[]> {
    const target = normalizeSandboxPath(path);
    const node = this.entries.get(target);
    if (!node?.directory) throw new Error(`Pasta nao encontrada: ${target}`);
    return [...this.entries.entries()]
      .filter(([entryPath]) => dirname(entryPath) === target && entryPath !== target)
      .map(([entryPath, entry]) => ({
        path: entryPath,
        name: basename(entryPath),
        directory: entry.directory,
        size: entry.directory ? 0 : entry.content?.length ?? 0,
        modifiedAt: entry.modifiedAt,
        hidden: basename(entryPath).startsWith(".")
      }))
      .sort(sortEntries);
  }

  async readFile(path: string): Promise<FileReadResult> {
    const target = normalizeSandboxPath(path);
    const node = this.entries.get(target);
    if (!node || node.directory) throw new Error(`Arquivo nao encontrado: ${target}`);
    return fileReadResult(target, node.content ?? "");
  }

  async writeFile(path: string, content: string): Promise<void> {
    const target = normalizeSandboxPath(path);
    this.ensureFolderSync(dirname(target));
    this.entries.set(target, { directory: false, content, modifiedAt: Date.now() });
    this.persist();
  }

  async createFile(path: string): Promise<void> {
    const target = normalizeSandboxPath(path);
    if (!target || this.entries.has(target)) return;
    await this.writeFile(target, "");
  }

  async createFolder(path: string): Promise<void> {
    this.ensureFolderSync(path);
    this.persist();
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const from = normalizeSandboxPath(oldPath);
    const to = normalizeSandboxPath(newPath);
    const source = this.entries.get(from);
    if (!source) throw new Error(`Caminho nao encontrado: ${from}`);
    this.ensureFolderSync(dirname(to));
    const moved = [...this.entries.entries()].filter(([entryPath]) => entryPath === from || entryPath.startsWith(`${from}/`));
    for (const [entryPath] of moved) this.entries.delete(entryPath);
    for (const [entryPath, entry] of moved) {
      this.entries.set(`${to}${entryPath.slice(from.length)}`, { ...entry, modifiedAt: Date.now() });
    }
    this.persist();
  }

  async delete(path: string): Promise<void> {
    const target = normalizeSandboxPath(path);
    for (const entryPath of [...this.entries.keys()]) {
      if (entryPath === target || entryPath.startsWith(`${target}/`)) {
        this.entries.delete(entryPath);
      }
    }
    this.persist();
  }

  async reveal(_path: string): Promise<void> {
    return;
  }

  async exists(path: string): Promise<boolean> {
    return this.entries.has(normalizeSandboxPath(path));
  }

  private ensureFolderSync(path: string): void {
    const target = normalizeSandboxPath(path);
    if (!target) return;
    const segments = target.split("/");
    let current = "";
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      const existing = this.entries.get(current);
      if (existing && !existing.directory) throw new Error(`Arquivo ja existe: ${current}`);
      if (!existing) this.entries.set(current, { directory: true, modifiedAt: Date.now() });
    }
  }

  private load(): void {
    const raw = readStorage("npsharp:webfs");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Record<string, StoredEntry>;
      this.entries = new Map(Object.entries(parsed));
    } catch {
      this.entries.clear();
    }
  }

  private persist(): void {
    writeStorage("npsharp:webfs", JSON.stringify(Object.fromEntries(this.entries)));
  }
}

function createBrowserApi(): NpsharpApi {
  const fs = platform.kind === "capacitor" ? new CapacitorSandboxFs() : new LocalSandboxFs();

  const loadSettings = async (): Promise<AppSettings> => {
    const saved = await readJsonFile<Partial<AppSettings>>(fs, SETTINGS_PATH, {});
    const settings = { ...DEFAULT_SETTINGS, ...saved };
    await writeJsonFile(fs, SETTINGS_PATH, settings);
    return settings;
  };

  const saveSettings = async (settings: AppSettings): Promise<AppSettings> => {
    const merged = { ...DEFAULT_SETTINGS, ...settings };
    await writeJsonFile(fs, SETTINGS_PATH, merged);
    return merged;
  };

  const loadSession = async (): Promise<PersistedSession> => {
    const saved = await readJsonFile<Partial<PersistedSession>>(fs, SESSION_PATH, {});
    return {
      ...DEFAULT_SESSION,
      ...saved,
      openFiles: saved.openFiles ?? [],
      recentWorkspaces: saved.recentWorkspaces ?? []
    };
  };

  const saveSession = async (session: PersistedSession): Promise<void> => {
    await writeJsonFile(fs, SESSION_PATH, { ...DEFAULT_SESSION, ...session });
  };

  return {
    appInfo: async () => browserAppInfo(),
    window: {
      minimize: async () => undefined,
      maximize: async () => undefined,
      close: async () => undefined,
      isMaximized: async () => false
    },
    dialog: {
      openFile: () => openSandboxFile(fs),
      openFolder: () => openSandboxWorkspace(fs),
      saveFile: (request: SaveFileRequest) => saveSandboxFile(fs, request),
      chooseWallpaper: async () => ({ canceled: true, paths: [] })
    },
    settings: {
      load: loadSettings,
      save: saveSettings,
      reset: async () => saveSettings(DEFAULT_SETTINGS),
      loadSession,
      saveSession
    },
    fs,
    search: createSearchApi(fs),
    diagnostics: {
      java: async () => []
    },
    git: createUnavailableGitApi(),
    terminal: {
      run: async (request: TerminalRunRequest) => ({
        cwd: request.cwd,
        output: `${platform.isMobile ? MOBILE_TERMINAL_MESSAGE : WEB_TERMINAL_MESSAGE}\n`,
        code: 1
      }),
      shells: async (): Promise<TerminalShellOption[]> => [],
      create: async (request: TerminalCreateRequest): Promise<TerminalSessionInfo> => ({
        id: crypto.randomUUID(),
        name: "Output",
        cwd: request.cwd,
        shell: request.shell ?? "unavailable",
        backend: "child_process",
        running: false
      }),
      write: async (_id: string, _data: string) => undefined,
      resize: async (_id: string, _cols: number, _rows: number) => undefined,
      kill: async (_id: string) => undefined,
      close: async (_id: string) => undefined,
      onData: (_callback: (event: TerminalDataEvent) => void) => () => undefined,
      onExit: (_callback: (event: TerminalExitEvent) => void) => () => undefined
    },
    runtime: {
      list: async () => [],
      discover: async () => [],
      configure: async () => [],
      runFile: async request => runInBrowserSandbox(request)
    },
    arduino: createArduinoFallbackApi(fs),
    liveServer: {
      open: request => openHtmlPreviewUrl(fs, request),
      stopAll: async () => ({ success: true, output: "Nenhum Live Server Node ativo neste ambiente." })
    },
    templates: {
      apply: request => applyFallbackTemplate(fs, request)
    },
    remote: createRemoteFallbackApi(fs)
  };
}

function createRendererApi(base: NpsharpApi): RendererApi {
  return {
    ...base,
    platform,
    notes: {
      path: workspace => notesPath(workspace),
      read: async workspace => {
        const path = notesPath(workspace);
        await base.fs.createFolder(dirname(path));
        if (!await base.fs.exists(path)) {
          await base.fs.writeFile(path, NOTES_TEMPLATE);
        }
        return base.fs.readFile(path);
      },
      write: async (content, workspace) => {
        const path = notesPath(workspace);
        await base.fs.createFolder(dirname(path));
        await base.fs.writeFile(path, content);
      }
    },
    theme: {
      get: async () => (await base.settings.load()).theme,
      set: async theme => base.settings.save({ ...await base.settings.load(), theme })
    },
    projectHealth: {
      java: (workspace, filePath) => base.diagnostics.java(workspace, filePath),
      summary: async () => platform.canUseNodeBackend
        ? "Diagnosticos Node habilitados no desktop."
        : "Diagnosticos locais completos dependem de backend nativo futuro neste ambiente."
    },
    buildGuard: {
      platform,
      describe: feature => fallbackMessageFor(feature)
    },
    run: {
      file: request => base.runtime.runFile(request),
      canRun: filePath => platform.canUseNodeBackend || /\.(html?)$/i.test(filePath)
    }
  };
}

function createUnavailableGitApi(): NpsharpApi["git"] {
  const message = platform.isMobile ? MOBILE_GIT_MESSAGE : WEB_GIT_MESSAGE;
  const result = (): GitOperationResult => ({ success: false, output: message });
  return {
    status: async () => [],
    run: async () => result(),
    stage: async () => result(),
    unstage: async () => result(),
    discard: async () => result(),
    commit: async () => result(),
    checkout: async () => result(),
    createBranch: async () => result(),
    diff: async () => message,
    history: async () => []
  };
}

function createSearchApi(fs: FsApi): NpsharpApi["search"] {
  return {
    workspace: async query => {
      const files = await collectFiles(fs, query.workspace, query.limit ?? 5000, query.includeHidden ?? false);
      const results: SearchResult[] = [];
      for (const filePath of files) {
        const file = await fs.readFile(filePath);
        results.push(...searchInFile(filePath, query.workspace, file.content, query));
        if (query.limit && results.length >= query.limit) return results.slice(0, query.limit);
      }
      return results;
    },
    replaceAll: async request => {
      const files = await collectFiles(fs, request.workspace, request.limit ?? 5000, request.includeHidden ?? false);
      let changedFiles = 0;
      let replacements = 0;
      for (const filePath of files) {
        const file = await fs.readFile(filePath);
        const replaced = replaceInContent(file.content, request);
        if (replaced.count === 0) continue;
        changedFiles += 1;
        replacements += replaced.count;
        await fs.writeFile(filePath, replaced.content);
      }
      return { changedFiles, replacements };
    }
  };
}

function createRemoteFallbackApi(fs: FsApi): RemoteApi {
  const unavailable = (): GitOperationResult => ({
    success: false,
    output: "Remote Host depende do backend Node/Electron neste ambiente."
  });
  return {
    loadHosts: () => readJsonFile<RemoteHostConfig[]>(fs, REMOTE_HOSTS_PATH, []),
    saveHosts: hosts => writeJsonFile(fs, REMOTE_HOSTS_PATH, hosts),
    test: async () => unavailable(),
    list: async (_request: RemoteListRequest) => [],
    readFile: async (_request: RemoteFileRequest) => {
      throw new Error(unavailable().output);
    },
    writeFile: async (_request: RemoteFileRequest) => undefined,
    mkdir: async (_request: RemoteFileRequest) => undefined,
    touch: async (_request: RemoteFileRequest) => undefined,
    rename: async (_request: RemoteFileRequest & { newPath: string }) => undefined,
    delete: async (_request: RemoteFileRequest) => undefined,
    execute: async (_request: RemoteCommandRequest) => unavailable()
  };
}

function createArduinoFallbackApi(fs: FsApi): NpsharpApi["arduino"] {
  const unavailable = (): ArduinoOperationResult => ({
    success: false,
    output: platform.isMobile ? MOBILE_ARDUINO_MESSAGE : WEB_ARDUINO_MESSAGE,
    code: 1
  });
  const loadConfig = async (_request: ArduinoConfigRequest): Promise<ArduinoConfig> => {
    const saved = await readJsonFile<Partial<ArduinoConfig>>(fs, ARDUINO_CONFIG_PATH, {});
    return {
      cliPath: saved.cliPath,
      selectedBoardFqbn: saved.selectedBoardFqbn,
      selectedPort: saved.selectedPort,
      baudRate: Number(saved.baudRate) || 9600,
      sketchPath: saved.sketchPath
    };
  };
  const saveConfig = async (request: ArduinoSaveConfigRequest): Promise<ArduinoConfig> => {
    const next = { ...await loadConfig(request), ...request.config };
    await writeJsonFile(fs, ARDUINO_CONFIG_PATH, next);
    return next;
  };
  return {
    detect: async (_request?: ArduinoCliRequest) => ({
      available: false,
      message: platform.isMobile ? MOBILE_ARDUINO_MESSAGE : WEB_ARDUINO_MESSAGE
    }),
    loadConfig,
    saveConfig,
    listPorts: async (_request?: ArduinoCliRequest) => [],
    listBoards: async (_request?: ArduinoCliRequest) => [],
    createSketch: async (request: ArduinoCreateSketchRequest) => {
      const name = sanitizeName(request.name || "Blink").replace(/\s+/g, "_");
      const sketchPath = joinPath(DEFAULT_MOBILE_WORKSPACE, name);
      const filePath = joinPath(sketchPath, `${name}.ino`);
      await fs.createFolder(sketchPath);
      if (!await fs.exists(filePath)) {
        await fs.writeFile(filePath, "void setup() {\n}\n\nvoid loop() {\n}\n");
      }
      const config = await saveConfig({ workspace: request.workspace, config: { sketchPath } });
      return { sketchPath, filePath, config };
    },
    compile: async (_request: ArduinoCompileRequest) => unavailable(),
    upload: async (_request: ArduinoUploadRequest) => unavailable(),
    monitor: async (_request: ArduinoMonitorRequest) => unavailable()
  };
}

async function openSandboxWorkspace(fs: FsApi): Promise<DialogFileResult> {
  const label = platform.isMobile ? "Nome do workspace mobile" : "Nome do workspace";
  const name = prompt(label, "Main");
  if (name === null) return { canceled: true, paths: [] };
  const workspace = joinPath(MOBILE_WORKSPACES_ROOT, sanitizeName(name || "Main"));
  await fs.createFolder(workspace);
  return { canceled: false, paths: [workspace] };
}

async function openSandboxFile(fs: FsApi): Promise<DialogFileResult> {
  const target = prompt("Caminho do arquivo no workspace", joinPath(DEFAULT_MOBILE_WORKSPACE, "notes.nps.md"));
  if (!target?.trim()) return { canceled: true, paths: [] };
  const path = normalizeSandboxPath(target);
  return await fs.exists(path) ? { canceled: false, paths: [path] } : { canceled: true, paths: [] };
}

async function saveSandboxFile(fs: FsApi, request: SaveFileRequest): Promise<SaveFileResult> {
  const suggested = request.path ?? request.suggestedName ?? "untitled.txt";
  const target = request.path ?? prompt("Salvar como", joinPath(DEFAULT_MOBILE_WORKSPACE, basename(suggested)));
  if (!target?.trim()) return { canceled: true };
  const path = normalizeSandboxPath(target.includes("/") ? target : joinPath(DEFAULT_MOBILE_WORKSPACE, target));
  await fs.writeFile(path, request.content);
  return { canceled: false, path };
}

async function runInBrowserSandbox(request: RuntimeRunRequest): Promise<RuntimeRunResult> {
  const extension = extname(request.filePath);
  if (extension === ".html" || extension === ".htm") {
    return {
      language: "html",
      output: "Preview HTML disponivel sem iniciar servidor Node.",
      code: 0
    };
  }
  return {
    language: extension.replace(/^\./, "") || "text",
    output: "Execucao local dessa linguagem ainda nao esta disponivel no mobile/web.",
    code: 1
  };
}

async function openHtmlPreviewUrl(fs: FsApi, request: LiveServerRequest): Promise<LiveServerResult> {
  if (!/\.html?$/i.test(request.filePath)) {
    return {
      success: false,
      output: "Live Server Node nao esta disponivel neste ambiente. Preview local existe apenas para HTML."
    };
  }
  const file = await fs.readFile(request.filePath);
  return {
    success: true,
    output: "Preview HTML gerado sem servidor Node.",
    url: `data:text/html;charset=utf-8,${encodeURIComponent(file.content)}`
  };
}

async function applyFallbackTemplate(fs: FsApi, request: TemplateApplyRequest): Promise<string> {
  const declaration = request.template === "interface"
    ? `public interface ${request.name} {\n}\n`
    : request.template === "enum"
      ? `public enum ${request.name} {\n}\n`
      : request.template === "record"
        ? `public record ${request.name}() {\n}\n`
        : `public class ${request.name} {\n}\n`;
  const packageLine = request.packageName ? `package ${request.packageName};\n\n` : "";
  const target = joinPath(DEFAULT_MOBILE_WORKSPACE, `${request.name}.java`);
  await fs.writeFile(target, `${packageLine}${declaration}`);
  return target;
}

function browserAppInfo(): AppInfo {
  return {
    name: "NPSharp",
    version: "1.0.0",
    platform: platform.kind === "capacitor" ? platform.capacitorPlatform : "web",
    userDataPath: platform.kind === "capacitor" ? `Documents/${MOBILE_ROOT}` : `localStorage://${MOBILE_ROOT}`,
    appPath: window.location.origin,
    npsharpHome: MOBILE_ROOT
  };
}

function notesPath(workspace?: string): string {
  if (!platform.isDesktop) return NOTES_PATH;
  const base = workspace ? joinPath(workspace, ".npsharp") : MOBILE_ROOT;
  return joinPath(base, "notes.nps.md");
}

function fallbackMessageFor(feature: "git" | "terminal" | "liveServer" | "run"): string {
  const messages: Record<"git" | "terminal" | "liveServer" | "run", string> = {
    git: platform.canUseGit ? "Git desktop habilitado." : (platform.isMobile ? MOBILE_GIT_MESSAGE : WEB_GIT_MESSAGE),
    terminal: platform.canUseTerminal ? "Terminal desktop habilitado." : (platform.isMobile ? MOBILE_TERMINAL_MESSAGE : WEB_TERMINAL_MESSAGE),
    liveServer: platform.canUseLiveServer ? "Live Server Node habilitado." : "Live Server Node nao esta disponivel; HTML usa preview local.",
    run: platform.canUseNodeBackend ? "Runtimes locais habilitados." : "Runtimes locais dependem de backend nativo futuro."
  };
  return messages[feature];
}

async function collectFiles(fs: FsApi, root: string, limit: number, includeHidden: boolean): Promise<string[]> {
  const files: string[] = [];
  async function walk(dir: string): Promise<void> {
    if (files.length >= limit) return;
    const entries = await fs.listDir(dir);
    for (const entry of entries) {
      const lowerName = entry.name.toLowerCase();
      if ((!includeHidden && entry.hidden) || SEARCH_IGNORED_DIRECTORIES.has(lowerName)) continue;
      if (entry.directory) await walk(entry.path);
      else files.push(entry.path);
      if (files.length >= limit) return;
    }
  }
  await walk(root);
  return files;
}

function searchInFile(filePath: string, workspace: string, content: string, query: SearchQuery): SearchResult[] {
  const results: SearchResult[] = [];
  let lineStart = 0;
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const match of findMatches(line, query)) {
      results.push({
        filePath,
        relativePath: relativePath(workspace, filePath),
        line: index + 1,
        column: match.start + 1,
        start: lineStart + match.start,
        end: lineStart + match.end,
        preview: line.trim(),
        score: 1
      });
    }
    lineStart += line.length + newlineLengthAt(content, lineStart + line.length);
  }
  return results;
}

function findMatches(text: string, query: SearchQuery): Array<{ start: number; end: number }> {
  if (!query.text) return [];
  if (query.useRegex) {
    const flags = query.caseSensitive ? "g" : "gi";
    const regex = new RegExp(query.text, flags);
    const matches: Array<{ start: number; end: number }> = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text))) {
      const start = match.index;
      const end = start + match[0].length;
      if (!query.wholeWord || isWholeWordMatch(text, start, end)) matches.push({ start, end });
      if (match[0].length === 0) regex.lastIndex += 1;
    }
    return matches;
  }

  const haystack = query.caseSensitive ? text : text.toLowerCase();
  const needle = query.caseSensitive ? query.text : query.text.toLowerCase();
  const matches: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  while (cursor <= haystack.length) {
    const start = haystack.indexOf(needle, cursor);
    if (start < 0) break;
    const end = start + needle.length;
    if (!query.wholeWord || isWholeWordMatch(text, start, end)) matches.push({ start, end });
    cursor = Math.max(end, start + 1);
  }
  return matches;
}

function replaceInContent(content: string, request: ReplaceAllRequest): { content: string; count: number } {
  if (!request.text) return { content, count: 0 };
  if (request.useRegex) {
    const flags = request.caseSensitive ? "g" : "gi";
    const regex = new RegExp(request.text, flags);
    let count = 0;
    const replaced = content.replace(regex, (...args) => {
      const match = args[0] as string;
      const offset = typeof args[args.length - 2] === "number"
        ? args[args.length - 2] as number
        : args[args.length - 3] as number;
      if (request.wholeWord && !isWholeWordMatch(content, offset, offset + match.length)) return match;
      count += 1;
      return request.replaceWith;
    });
    return { content: replaced, count };
  }

  let result = "";
  let cursor = 0;
  let count = 0;
  const haystack = request.caseSensitive ? content : content.toLowerCase();
  const needle = request.caseSensitive ? request.text : request.text.toLowerCase();
  while (cursor < content.length) {
    const start = haystack.indexOf(needle, cursor);
    if (start < 0) break;
    const end = start + needle.length;
    if (request.wholeWord && !isWholeWordMatch(content, start, end)) {
      result += content.slice(cursor, end);
      cursor = end;
      continue;
    }
    result += content.slice(cursor, start) + request.replaceWith;
    cursor = end;
    count += 1;
  }
  result += content.slice(cursor);
  return { content: result, count };
}

function isWholeWordMatch(text: string, start: number, end: number): boolean {
  return !isWordChar(text[start - 1]) && !isWordChar(text[end]);
}

function isWordChar(value: string | undefined): boolean {
  return Boolean(value && /[A-Za-z0-9_]/.test(value));
}

function newlineLengthAt(content: string, offset: number): number {
  if (content[offset] === "\r" && content[offset + 1] === "\n") return 2;
  if (content[offset] === "\n") return 1;
  return 0;
}

async function readJsonFile<T>(fs: FsApi, path: string, fallback: T): Promise<T> {
  try {
    if (!await fs.exists(path)) return fallback;
    const file = await fs.readFile(path);
    return JSON.parse(file.content) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(fs: FsApi, path: string, value: unknown): Promise<void> {
  await fs.writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function fileReadResult(path: string, content: string): FileReadResult {
  return {
    path,
    name: basename(path),
    content,
    lineEnding: content.includes("\r\n") ? "\r\n" : "\n",
    encoding: "utf8"
  };
}

function normalizeSandboxPath(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/").trim();
  const parts = normalized.split("/").filter(Boolean);
  if (parts.some(part => part === "..")) throw new Error("Caminho invalido fora do sandbox mobile.");
  return parts.join("/");
}

function sanitizeName(name: string): string {
  return name.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ") || "Main";
}

function sortEntries(left: WorkspaceEntry, right: WorkspaceEntry): number {
  if (left.directory !== right.directory) return left.directory ? -1 : 1;
  return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
}

function readStorage(key: string): string | undefined {
  try {
    return window.localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    return;
  }
}

export const api = createRendererApi(getDesktopApi() ?? createBrowserApi());
