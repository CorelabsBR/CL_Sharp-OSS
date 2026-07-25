import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import type { PermissionState } from "@capacitor/core";
import type {
  AIConversation,
  AISettings,
  AIStreamEvent,
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
  FileOpenResult,
  GitCommit,
  GitFileStatus,
  GitOperationResult,
  GitRepositoryStatus,
  InstalledExtension,
  InstalledRuntime,
  LanguageRuntimeConfig,
  LanguageRuntimeState,
  LanguageRuntimeValidation,
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
import { LANGUAGE_RUNTIMES } from "../../core/runtime/languages";
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
const LANGUAGE_RUNTIMES_PATH = `${MOBILE_ROOT}/language-runtimes.json`;
const NOTES_PATH = `${MOBILE_ROOT}/notes.nps.md`;
const AI_SETTINGS_STORAGE_KEY = "npsharp:ai-settings";
const AI_CONVERSATIONS_STORAGE_KEY = "npsharp:ai-conversations";

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
  sideBarVisible: true,
  binaryFileTypesIgnored: []
};

const DEFAULT_SESSION: PersistedSession = {
  openFiles: [],
  sidePanel: "explorer",
  terminalVisible: false
};

const NOTES_TEMPLATE = "# NPSharp Notes\n\n## TODO\n\n- \n\n## Ideias\n\n## Bugs\n\n## Observacoes\n";
const MOBILE_GIT_MESSAGE = "Git nativo ainda nao esta disponivel no mobile.";
const WEB_GIT_MESSAGE = "Git local nao esta disponivel neste modo web.";
const MOBILE_TERMINAL_MESSAGE = "Terminal real Node nao esta disponivel no mobile. Use este painel como Output/Command Log.";
const WEB_TERMINAL_MESSAGE = "Terminal real nao esta disponivel no modo web. Use este painel como Output/Command Log.";
const MOBILE_ARDUINO_MESSAGE = "Arduino CLI nao esta disponivel no mobile. Use este painel para manter configuracao e sketches; compile/upload dependem do desktop.";
const WEB_ARDUINO_MESSAGE = "Arduino CLI nao esta disponivel no modo web. Compile/upload dependem do desktop.";
const MOBILE_STORAGE_DENIED_MESSAGE = "Acesso ao armazenamento negado. Permita o acesso ao armazenamento para usar arquivos em Documents/NPSharp.";
const SEARCH_IGNORED_DIRECTORIES = new Set(["node_modules", "dist", "dist-electron", "release", ".git", "build", ".cache"]);
const CONFIGURABLE_LANGUAGE_IDS = ["c", "cpp", "csharp", "java", "node", "python", "go", "rust", "php", "lua", "kotlin", "dart"];

class CapacitorSandboxFs implements FsApi {
  private rootReady?: Promise<void>;
  private storageAccessReady?: Promise<void>;

  constructor(
    private readonly directory: Directory,
    private readonly requiresPublicStorageAccess: boolean
  ) {}

  async listDir(path: string): Promise<WorkspaceEntry[]> {
    const target = normalizeSandboxPath(path);
    const result = await this.runFsOperation(() => Filesystem.readdir({ path: target, directory: this.directory }));
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
    const target = normalizeSandboxPath(path);
    const result = await this.runFsOperation(() => Filesystem.readFile({ path: target, directory: this.directory, encoding: Encoding.UTF8 }));
    const content = typeof result.data === "string" ? result.data : await result.data.text();
    return fileReadResult(target, content);
  }

  async openFile(path: string, forceText = false): Promise<FileOpenResult> {
    return fallbackOpenFileResult(await this.readFile(path), forceText);
  }

  async writeFile(path: string, content: string): Promise<void> {
    await this.ensureRoot();
    const target = normalizeSandboxPath(path);
    await this.ensureParent(target);
    await this.handleFsError(Filesystem.writeFile({
      path: target,
      data: content,
      directory: this.directory,
      encoding: Encoding.UTF8,
      recursive: true
    }));
  }

  async createFile(path: string): Promise<void> {
    await this.ensureRoot();
    const target = normalizeSandboxPath(path);
    if (!target) return;
    if (!await this.pathExists(target)) {
      await this.writeFile(target, "");
    }
  }

  async createFolder(path: string): Promise<void> {
    await this.ensureRoot();
    const target = normalizeSandboxPath(path);
    if (!target) return;
    await this.mkdirIfMissing(target);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    await this.ensureRoot();
    const from = normalizeSandboxPath(oldPath);
    const to = normalizeSandboxPath(newPath);
    if (!from || !to) throw new Error("Caminho invalido para renomear.");
    await this.ensureParent(to);
    await this.handleFsError(Filesystem.rename({ from, to, directory: this.directory }));
  }

  async delete(path: string): Promise<void> {
    await this.ensureRoot();
    const target = normalizeSandboxPath(path);
    if (!target) throw new Error("Caminho invalido para excluir.");
    const stat = await this.handleFsError(Filesystem.stat({ path: target, directory: this.directory }));
    if (stat.type === "directory") {
      await this.handleFsError(Filesystem.rmdir({ path: target, directory: this.directory, recursive: true }));
      return;
    }
    await this.handleFsError(Filesystem.deleteFile({ path: target, directory: this.directory }));
  }

  async reveal(_path: string): Promise<void> {
    return;
  }

  async exists(path: string): Promise<boolean> {
    await this.ensureRoot();
    return this.pathExists(normalizeSandboxPath(path));
  }

  watch(_path: string, _callback: (event: import("../../shared/types").WorkspaceChangeEvent) => void): () => void {
    return () => undefined;
  }

  private async ensureRoot(): Promise<void> {
    await this.ensureStorageAccess();
    this.rootReady ??= this.createInitialFolders().catch(error => {
      this.rootReady = undefined;
      throw error;
    });
    await this.rootReady;
  }

  private async ensureParent(path: string): Promise<void> {
    const parent = dirname(path);
    if (parent) await this.mkdirIfMissing(parent);
  }

  private async ensureStorageAccess(): Promise<void> {
    if (!this.requiresPublicStorageAccess) return;
    this.storageAccessReady ??= this.requestStorageAccess().catch(error => {
      this.storageAccessReady = undefined;
      throw error;
    });
    await this.storageAccessReady;
  }

  private async requestStorageAccess(): Promise<void> {
    const checked = await this.handleFsError(Filesystem.checkPermissions());
    if (hasStorageAccess(checked.publicStorage)) return;

    const requested = await this.handleFsError(Filesystem.requestPermissions());
    if (!hasStorageAccess(requested.publicStorage)) {
      throw new StorageAccessDeniedError(requested.publicStorage);
    }
  }

  private async createInitialFolders(): Promise<void> {
    await this.mkdirIfMissing(MOBILE_ROOT);
    await this.mkdirIfMissing(MOBILE_WORKSPACES_ROOT);
    await this.mkdirIfMissing(DEFAULT_MOBILE_WORKSPACE);
  }

  private async mkdirIfMissing(path: string): Promise<void> {
    const target = normalizeSandboxPath(path);
    if (!target) return;
    try {
      await this.handleFsError(Filesystem.mkdir({ path: target, directory: this.directory, recursive: true }));
    } catch (error) {
      if (await this.pathExists(target)) return;
      throw error;
    }
  }

  private async pathExists(path: string): Promise<boolean> {
    const target = normalizeSandboxPath(path);
    if (!target) return false;
    try {
      await this.handleFsError(Filesystem.stat({ path: target, directory: this.directory }));
      return true;
    } catch (error) {
      if (isMissingPathError(error)) return false;
      throw error;
    }
  }

  private async runFsOperation<T>(operation: () => Promise<T>): Promise<T> {
    await this.ensureRoot();
    return this.handleFsError(operation());
  }

  private async handleFsError<T>(operation: Promise<T>): Promise<T> {
    try {
      return await operation;
    } catch (error) {
      throw normalizeCapacitorFsError(error);
    }
  }
}

class StorageAccessDeniedError extends Error {
  constructor(state?: PermissionState) {
    super(state ? `${MOBILE_STORAGE_DENIED_MESSAGE} Estado atual: ${state}.` : MOBILE_STORAGE_DENIED_MESSAGE);
    this.name = "StorageAccessDeniedError";
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

  async openFile(path: string, forceText = false): Promise<FileOpenResult> {
    return fallbackOpenFileResult(await this.readFile(path), forceText);
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

  watch(_path: string, _callback: (event: import("../../shared/types").WorkspaceChangeEvent) => void): () => void {
    return () => undefined;
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
    } catch (error) {
      console.warn("[NPSharp browser storage] Failed to parse web filesystem state; clearing invalid state.", error);
      this.entries.clear();
    }
  }

  private persist(): void {
    writeStorage("npsharp:webfs", JSON.stringify(Object.fromEntries(this.entries)));
  }
}

function createBrowserApi(): NpsharpApi {
  const fs = platform.kind === "capacitor" ? new CapacitorSandboxFs(Directory.Documents, true) : new LocalSandboxFs();
  const appDataFs = platform.kind === "capacitor" ? new CapacitorSandboxFs(Directory.Data, false) : fs;

  const loadSettings = async (): Promise<AppSettings> => {
    const saved = await readJsonFile<Partial<AppSettings>>(appDataFs, SETTINGS_PATH, {});
    const settings = { ...DEFAULT_SETTINGS, ...saved };
    await writeJsonFile(appDataFs, SETTINGS_PATH, settings);
    return settings;
  };

  const saveSettings = async (settings: AppSettings): Promise<AppSettings> => {
    const merged = { ...DEFAULT_SETTINGS, ...settings };
    await writeJsonFile(appDataFs, SETTINGS_PATH, merged);
    return merged;
  };

  const loadSession = async (): Promise<PersistedSession> => {
    const saved = await readJsonFile<Partial<PersistedSession>>(appDataFs, SESSION_PATH, {});
    return {
      ...DEFAULT_SESSION,
      ...saved,
      openFiles: saved.openFiles ?? [],
      recentWorkspaces: saved.recentWorkspaces ?? []
    };
  };

  const saveSession = async (session: PersistedSession): Promise<void> => {
    await writeJsonFile(appDataFs, SESSION_PATH, { ...DEFAULT_SESSION, ...session });
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
      openVsix: async () => ({ canceled: true, paths: [] }),
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
    ai: createAIFallbackApi(),
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
      config: () => loadBrowserRuntimeStates(appDataFs),
      updateConfig: (languageId, config) => saveBrowserRuntimeConfig(appDataFs, languageId, config),
      autoDetect: languageId => saveBrowserRuntimeConfig(appDataFs, languageId, { path: "", autoDetect: true }),
      validate: (languageId, executablePath) => validateBrowserRuntime(languageId, executablePath),
      runFile: async request => runInBrowserSandbox(request)
    },
    extensions: createExtensionFallbackApi(),
    arduino: createArduinoFallbackApi(fs),
    liveServer: {
      open: request => openHtmlPreviewUrl(fs, request),
      stopAll: async () => ({ success: true, output: "Nenhum Live Server Node ativo neste ambiente." })
    },
    templates: {
      apply: request => applyFallbackTemplate(fs, request)
    },
    remote: createRemoteFallbackApi(appDataFs)
  };
}

function createAIFallbackApi(): NpsharpApi["ai"] {
  const listeners = new Set<(event: AIStreamEvent) => void>();
  const defaultSettings: AISettings = {
    provider: "ollama",
    model: "qwen2.5-coder:7b",
    temperature: 0.2,
    maxTokens: 8192,
    streaming: true,
    systemPrompt: "You are NPSharp AI, a precise coding assistant.",
    contextSize: 32768,
    ollamaBaseUrl: "http://127.0.0.1:11434",
    apiKeyConfigured: false
  };
  const loadAISettings = (): AISettings => {
    const raw = readStorage(AI_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...defaultSettings };
    try {
      return { ...defaultSettings, ...JSON.parse(raw) as Partial<AISettings>, apiKeyConfigured: false };
    } catch {
      return { ...defaultSettings };
    }
  };
  const loadConversations = (): AIConversation[] => {
    const raw = readStorage(AI_CONVERSATIONS_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as AIConversation[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const saveConversations = (items: AIConversation[]): void => writeStorage(AI_CONVERSATIONS_STORAGE_KEY, JSON.stringify(items));
  return {
    providers: async () => [
      { id: "openai", displayName: "OpenAI", supportsStreaming: true, requiresApiKey: true, defaultModel: "gpt-5.6-terra" },
      { id: "codex", displayName: "Codex", supportsStreaming: true, requiresApiKey: true, defaultModel: "gpt-5.2-codex" },
      { id: "gemini", displayName: "Google Gemini", supportsStreaming: true, requiresApiKey: true, defaultModel: "gemini-2.5-flash" },
      { id: "openrouter", displayName: "OpenRouter", supportsStreaming: true, requiresApiKey: true, defaultModel: "openai/gpt-5.6-terra" },
      { id: "ollama", displayName: "Ollama (Local)", supportsStreaming: true, requiresApiKey: false, defaultModel: "qwen2.5-coder:7b" }
    ],
    listModels: async provider => {
      const defaults: Record<typeof provider, string[]> = {
        openai: ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"],
        codex: ["gpt-5.2-codex"],
        gemini: ["gemini-2.5-pro", "gemini-2.5-flash"],
        openrouter: ["openai/gpt-5.6-terra"],
        ollama: ["qwen2.5-coder:7b"]
      };
      return defaults[provider].map(id => ({ id, displayName: id }));
    },
    loadSettings: async () => loadAISettings(),
    saveSettings: async request => {
      const settings: AISettings = { ...request, apiKeyConfigured: false };
      writeStorage(AI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      return settings;
    },
    listConversations: async () => loadConversations().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    createConversation: async (provider = loadAISettings().provider, model = loadAISettings().model) => {
      const timestamp = new Date().toISOString();
      const conversation: AIConversation = {
        id: crypto.randomUUID(),
        title: "New conversation",
        provider,
        model,
        createdAt: timestamp,
        updatedAt: timestamp,
        messages: []
      };
      saveConversations([conversation, ...loadConversations()]);
      return conversation;
    },
    updateConversation: async update => {
      const items = loadConversations();
      const current = items.find(item => item.id === update.id);
      if (!current) throw new Error("Conversation not found.");
      const next: AIConversation = { ...current, ...update, updatedAt: new Date().toISOString() };
      saveConversations(items.map(item => item.id === next.id ? next : item));
      return next;
    },
    deleteConversation: async id => saveConversations(loadConversations().filter(item => item.id !== id)),
    send: async request => {
      const event: AIStreamEvent = {
        requestId: request.requestId,
        type: "error",
        message: "AI providers require the Electron desktop backend so credentials and provider requests remain outside the web view."
      };
      for (const listener of listeners) listener(event);
    },
    cancel: async () => undefined,
    onStream: callback => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    }
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

function createExtensionFallbackApi(): NpsharpApi["extensions"] {
  const unavailable = "Extension Manager local depende do backend Electron/Node.";
  const list = async (): Promise<InstalledExtension[]> => [];
  return {
    list,
    installVsix: async () => {
      throw new Error(unavailable);
    },
    enable: list,
    disable: list,
    uninstall: list,
    reload: list
  };
}

async function loadBrowserRuntimeStates(fs: FsApi): Promise<LanguageRuntimeState[]> {
  const saved = await readJsonFile<Record<string, Partial<LanguageRuntimeConfig>>>(fs, LANGUAGE_RUNTIMES_PATH, {});
  return configurableRuntimeLanguages().map(language => {
    const config = normalizeBrowserRuntimeConfig(saved[language.id]);
    return {
      language,
      languageId: language.id,
      config,
      path: config.path || undefined,
      status: "missing",
      source: "missing",
      message: platform.isMobile
        ? "Deteccao de executaveis depende do backend nativo futuro no mobile."
        : "Deteccao de executaveis depende do backend Electron/Node."
    };
  });
}

async function saveBrowserRuntimeConfig(fs: FsApi, languageId: string, config: LanguageRuntimeConfig): Promise<LanguageRuntimeState[]> {
  const saved = await readJsonFile<Record<string, Partial<LanguageRuntimeConfig>>>(fs, LANGUAGE_RUNTIMES_PATH, {});
  saved[languageId] = normalizeBrowserRuntimeConfig(config);
  await writeJsonFile(fs, LANGUAGE_RUNTIMES_PATH, saved);
  return loadBrowserRuntimeStates(fs);
}

async function validateBrowserRuntime(languageId: string, executablePath?: string): Promise<LanguageRuntimeValidation> {
  return {
    languageId,
    path: executablePath,
    status: "missing",
    message: platform.isMobile
      ? "Validacao de executaveis depende do backend nativo futuro no mobile."
      : "Validacao de executaveis depende do backend Electron/Node."
  };
}

function configurableRuntimeLanguages(): typeof LANGUAGE_RUNTIMES {
  return CONFIGURABLE_LANGUAGE_IDS
    .map(id => LANGUAGE_RUNTIMES.find(language => language.id === id))
    .filter((language): language is (typeof LANGUAGE_RUNTIMES)[number] => Boolean(language));
}

function normalizeBrowserRuntimeConfig(config?: Partial<LanguageRuntimeConfig>): LanguageRuntimeConfig {
  return {
    path: typeof config?.path === "string" ? config.path : "",
    autoDetect: config?.autoDetect ?? true
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
    version: "26.6.4",
    platform: platform.kind === "capacitor" ? platform.capacitorPlatform : "web",
    userDataPath: platform.kind === "capacitor" ? `AppData/${MOBILE_ROOT}` : `localStorage://${MOBILE_ROOT}`,
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
  } catch (error) {
    if (isStorageAccessDeniedError(error)) throw error;
    if (!isMissingPathError(error) && !(error instanceof SyntaxError)) {
      console.warn(`[NPSharp browser storage] Failed to read ${path}; fallback value will be used.`, error);
    }
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

function fallbackOpenFileResult(file: FileReadResult, forceText: boolean): FileOpenResult {
  const extension = extname(file.path).slice(1);
  const image = /^(png|jpe?g|gif|bmp|webp|svg|ico|tiff?|avif)$/i.test(extension);
  const binary = /^(exe|dll|so|dylib|bin|dat|elf|class|jar|war|ear|apk|ipa|dex|o|obj|a|lib|wasm|pyc|pyd)$/i.test(extension);
  return {
    path: file.path,
    name: file.name,
    editor: !forceText && image ? "image" : !forceText && binary ? "binary" : "text",
    size: new TextEncoder().encode(file.content).byteLength,
    type: extension.toUpperCase() || "Arquivo",
    content: file.content,
    lineEnding: file.lineEnding,
    encoding: "utf8",
    binaryReason: binary ? "A extensao indica um formato binario." : undefined
  };
}

function normalizeSandboxPath(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/").trim();
  const parts = normalized.split("/").filter(Boolean);
  if (parts.some(part => part === "..")) throw new Error("Caminho invalido fora do sandbox mobile.");
  return parts.join("/");
}

function hasStorageAccess(state: PermissionState): boolean {
  return state === "granted";
}

function normalizeCapacitorFsError(error: unknown): Error {
  if (isStorageAccessDeniedError(error)) return error as Error;
  if (isPermissionDeniedError(error)) return new StorageAccessDeniedError();
  return error instanceof Error ? error : new Error(String(error));
}

function isStorageAccessDeniedError(error: unknown): boolean {
  return error instanceof StorageAccessDeniedError || errorName(error) === "StorageAccessDeniedError";
}

function isPermissionDeniedError(error: unknown): boolean {
  const code = errorCode(error);
  if (code === "EACCES" || code === "EPERM") return true;
  return /permission|denied|not allowed|security|unauthori[sz]ed/i.test(errorMessageText(error));
}

function isMissingPathError(error: unknown): boolean {
  const code = errorCode(error);
  if (code === "ENOENT" || code === "NOT_FOUND") return true;
  return /not found|no such file|does not exist|file not found/i.test(errorMessageText(error));
}

function errorCode(error: unknown): string | undefined {
  return typeof (error as { code?: unknown } | undefined)?.code === "string"
    ? (error as { code: string }).code
    : undefined;
}

function errorName(error: unknown): string | undefined {
  return typeof (error as { name?: unknown } | undefined)?.name === "string"
    ? (error as { name: string }).name
    : undefined;
}

function errorMessageText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
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
  } catch (error) {
    console.warn(`[NPSharp browser storage] Failed to read ${key} from localStorage.`, error);
    return undefined;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`[NPSharp browser storage] Failed to write ${key} to localStorage.`, error);
  }
}

export const api = createRendererApi(getDesktopApi() ?? createBrowserApi());
