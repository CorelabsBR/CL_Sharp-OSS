/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { contextBridge, ipcRenderer } from "electron";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type {
  AIChatRequest,
  AIConversationUpdate,
  AIProviderId,
  AISaveSettingsRequest,
  AIStreamEvent,
  AppUpdateStatus,
  AppSettings,
  ArduinoCliRequest,
  ArduinoCompileRequest,
  ArduinoConfigRequest,
  ArduinoCreateSketchRequest,
  ArduinoMonitorRequest,
  ArduinoSaveConfigRequest,
  ArduinoUploadRequest,
  GitFileStatus,
  LanguageRuntimeConfig,
  LiveServerRequest,
  OpenVsxExtension,
  NpsharpApi,
  PersistedSession,
  RemoteCommandRequest,
  RemoteFileRequest,
  RemoteHostConfig,
  RemoteListRequest,
  ReplaceAllRequest,
  RuntimeRunRequest,
  RuntimeDependencyInstallRequest,
  SaveFileRequest,
  SearchQuery,
  TemplateApplyRequest,
  TerminalDataEvent,
  TerminalExitEvent,
  TerminalCreateRequest,
  TerminalRunRequest,
  WorkspaceChangeEvent,
  WorkspaceCreateFileRequest,
  WorkspacePathRequest,
  WorkspaceRenameRequest
} from "../shared/types";
import type { AppLocale } from "../shared/i18n";
import { UPDATE_IPC } from "../shared/updateIpc";

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  try {
    return await ipcRenderer.invoke(channel, ...args) as T;
  } catch (error) {
    console.error(`[NPSharp IPC] ${channel} failed`, error);
    throw error;
  }
}

function isUpdateStatus(value: unknown): value is AppUpdateStatus {
  if (!value || typeof value !== "object") return false;
  const status = value as Partial<AppUpdateStatus>;
  return ["idle", "checking", "current", "available", "downloading", "downloaded", "error", "unsupported"].includes(status.state ?? "")
    && typeof status.message === "string"
    && (status.version === undefined || typeof status.version === "string")
    && (status.percent === undefined || typeof status.percent === "number");
}

const api: NpsharpApi = {
  appInfo: () => invoke("app:info"),
  startup: {
    mark: stage => invoke("startup:mark", stage),
    ready: () => invoke("startup:ready")
  },
  update: {
    status: () => invoke(UPDATE_IPC.status),
    check: () => invoke(UPDATE_IPC.check),
    download: () => invoke(UPDATE_IPC.download),
    install: () => invoke(UPDATE_IPC.install),
    onStatus: (callback: (status: AppUpdateStatus) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: unknown) => {
        if (isUpdateStatus(status)) callback(status);
      };
      ipcRenderer.on(UPDATE_IPC.status, listener);
      return () => ipcRenderer.removeListener(UPDATE_IPC.status, listener);
    }
  },
  window: {
    minimize: () => invoke("window:minimize"),
    maximize: () => invoke("window:maximize"),
    close: () => invoke("window:close"),
    isMaximized: () => invoke("window:isMaximized")
  },
  dialog: {
    openFile: () => invoke("dialog:openFile"),
    openFolder: () => invoke("dialog:openFolder"),
    openVsix: () => invoke("dialog:openVsix"),
    saveFile: (request: SaveFileRequest) => invoke("dialog:saveFile", request),
    chooseWallpaper: () => invoke("dialog:chooseWallpaper")
  },
  settings: {
    load: () => invoke("settings:load"),
    save: (settings: AppSettings) => invoke("settings:save", settings),
    reset: () => invoke("settings:reset"),
    loadSession: () => invoke("settings:loadSession"),
    saveSession: (session: PersistedSession) => invoke("settings:saveSession", session)
  },
  i18n: {
    getLanguage: () => invoke("i18n:getLanguage"),
    setLanguage: (language: AppLocale) => invoke("i18n:setLanguage", language),
    availableLanguages: () => invoke("i18n:availableLanguages")
  },
  ai: {
    providers: () => invoke("ai:providers"),
    listModels: (provider: AIProviderId) => invoke("ai:listModels", provider),
    loadSettings: () => invoke("ai:settings:load"),
    saveSettings: (settings: AISaveSettingsRequest) => invoke("ai:settings:save", settings),
    listConversations: () => invoke("ai:conversations:list"),
    createConversation: (provider?: AIProviderId, model?: string) => invoke("ai:conversations:create", provider, model),
    updateConversation: (update: AIConversationUpdate) => invoke("ai:conversations:update", update),
    deleteConversation: (id: string) => invoke("ai:conversations:delete", id),
    send: (request: AIChatRequest) => invoke("ai:send", request),
    cancel: (requestId: string) => invoke("ai:cancel", requestId),
    onStream: (callback: (event: AIStreamEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: AIStreamEvent) => callback(payload);
      ipcRenderer.on("ai:stream", listener);
      return () => ipcRenderer.removeListener("ai:stream", listener);
    }
  },
  fs: {
    listDir: (targetPath: string) => invoke("fs:listDir", targetPath),
    readFile: (targetPath: string) => invoke("fs:readFile", targetPath),
    openFile: (targetPath: string, forceText = false) => invoke("fs:openFile", targetPath, forceText),
    writeFile: (targetPath: string, content: string, encoding) => invoke("fs:writeFile", targetPath, content, encoding),
    saveStructuredFile: request => invoke("fs:saveStructuredFile", request),
    createFile: (targetPath: string) => invoke("fs:createFile", targetPath),
    createFolder: (targetPath: string) => invoke("fs:createFolder", targetPath),
    rename: (oldPath: string, newPath: string) => invoke("fs:rename", oldPath, newPath),
    delete: (targetPath: string) => invoke("fs:delete", targetPath),
    reveal: (targetPath: string) => invoke("fs:reveal", targetPath),
    exists: (targetPath: string) => invoke("fs:exists", targetPath),
    createFileInWorkspace: (request: WorkspaceCreateFileRequest) => invoke("fs:workspace:createFile", request),
    createFolderInWorkspace: (request: WorkspacePathRequest) => invoke("fs:workspace:createFolder", request),
    renameInWorkspace: (request: WorkspaceRenameRequest) => invoke("fs:workspace:rename", request),
    deleteInWorkspace: (request: WorkspacePathRequest) => invoke("fs:workspace:delete", request),
    watch: (targetPath: string, callback: (event: WorkspaceChangeEvent) => void) => {
      const watchId = randomUUID();
      let disposed = false;
      const listener = (_event: Electron.IpcRendererEvent, payload: WorkspaceChangeEvent & { watchId: string }) => {
        if (payload.watchId === watchId) callback(payload);
      };
      ipcRenderer.on("fs:watch:event", listener);
      void invoke<void>("fs:watch:start", watchId, targetPath).catch(error => {
        console.error(`[NPSharp IPC] fs:watch:start failed (${targetPath})`, error);
      });
      return () => {
        if (disposed) return;
        disposed = true;
        ipcRenderer.removeListener("fs:watch:event", listener);
        void ipcRenderer.invoke("fs:watch:stop", watchId).catch(() => undefined);
      };
    }
  },
  office: {
    status: () => invoke("office:status"),
    open: (targetPath: string) => invoke("office:open", targetPath)
  },
  search: {
    workspace: (query: SearchQuery) => invoke("search:workspace", query),
    replaceAll: (request: ReplaceAllRequest) => invoke("search:replaceAll", request)
  },
  diagnostics: {
    java: (workspace: string, filePath?: string) => invoke("diagnostics:java", workspace, filePath)
  },
  git: {
    status: (workspace: string) => invoke("git:status", workspace),
    run: (repo: string, args: string[]) => invoke("git:run", repo, args),
    stage: (repo: string, file: GitFileStatus) => invoke("git:stage", repo, file),
    unstage: (repo: string, file: GitFileStatus) => invoke("git:unstage", repo, file),
    discard: (repo: string, file: GitFileStatus) => invoke("git:discard", repo, file),
    commit: (repo: string, message: string, allowEmpty?: boolean) => invoke("git:commit", repo, message, allowEmpty),
    checkout: (repo: string, branch: string) => invoke("git:checkout", repo, branch),
    createBranch: (repo: string, branch: string) => invoke("git:createBranch", repo, branch),
    diff: (repo: string, file: GitFileStatus, staged: boolean) => invoke("git:diff", repo, file, staged),
    history: (repo: string) => invoke("git:history", repo)
  },
  terminal: {
    run: (request: TerminalRunRequest) => invoke("terminal:run", request),
    shells: () => invoke("terminal:shells"),
    create: (request: TerminalCreateRequest) => invoke("terminal:create", request),
    write: (id: string, data: string) => invoke("terminal:write", id, data),
    resize: (id: string, cols: number, rows: number) => invoke("terminal:resize", id, cols, rows),
    kill: (id: string) => invoke("terminal:kill", id),
    close: (id: string) => invoke("terminal:close", id),
    onData: (callback: (event: TerminalDataEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: TerminalDataEvent) => callback(payload);
      ipcRenderer.on("terminal:data", listener);
      return () => ipcRenderer.removeListener("terminal:data", listener);
    },
    onExit: (callback: (event: TerminalExitEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: TerminalExitEvent) => callback(payload);
      ipcRenderer.on("terminal:exit", listener);
      return () => ipcRenderer.removeListener("terminal:exit", listener);
    }
  },
  runtime: {
    list: () => invoke("runtime:list"),
    discover: () => invoke("runtime:discover"),
    configure: (languageId: string, executablePath: string) => invoke("runtime:configure", languageId, executablePath),
    config: () => invoke("runtime:config"),
    updateConfig: (languageId: string, config: LanguageRuntimeConfig) => invoke("runtime:updateConfig", languageId, config),
    autoDetect: (languageId: string) => invoke("runtime:autoDetect", languageId),
    validate: (languageId: string, executablePath?: string) => invoke("runtime:validate", languageId, executablePath),
    runFile: (request: RuntimeRunRequest) => invoke("runtime:runFile", request),
    installDependencies: (request: RuntimeDependencyInstallRequest) => invoke("runtime:installDependencies", request)
  },
  extensions: {
    list: () => invoke("extensions:list"),
    searchOpenVsx: (query: string) => invoke("extensions:searchOpenVsx", query),
    installOpenVsx: (extension: OpenVsxExtension) => invoke("extensions:installOpenVsx", extension),
    installVsix: (vsixPath: string) => invoke("extensions:installVsix", vsixPath),
    enable: (id: string) => invoke("extensions:enable", id),
    disable: (id: string) => invoke("extensions:disable", id),
    uninstall: (id: string) => invoke("extensions:uninstall", id),
    reload: (id?: string) => invoke("extensions:reload", id)
  },
  arduino: {
    detect: (request?: ArduinoCliRequest) => invoke("arduino:detect", request),
    loadConfig: (request: ArduinoConfigRequest) => invoke("arduino:loadConfig", request),
    saveConfig: (request: ArduinoSaveConfigRequest) => invoke("arduino:saveConfig", request),
    listPorts: (request?: ArduinoCliRequest) => invoke("arduino:listPorts", request),
    listBoards: (request?: ArduinoCliRequest) => invoke("arduino:listBoards", request),
    createSketch: (request: ArduinoCreateSketchRequest) => invoke("arduino:createSketch", request),
    compile: (request: ArduinoCompileRequest) => invoke("arduino:compile", request),
    upload: (request: ArduinoUploadRequest) => invoke("arduino:upload", request),
    monitor: (request: ArduinoMonitorRequest) => invoke("arduino:monitor", request)
  },
  liveServer: {
    open: (request: LiveServerRequest) => invoke("liveServer:open", request),
    stopAll: () => invoke("liveServer:stopAll")
  },
  templates: {
    apply: (request: TemplateApplyRequest) => invoke("templates:apply", request)
  },
  remote: {
    loadHosts: () => invoke("remote:loadHosts"),
    saveHosts: (hosts: RemoteHostConfig[]) => invoke("remote:saveHosts", hosts),
    test: (request: RemoteCommandRequest) => invoke("remote:test", request),
    list: (request: RemoteListRequest) => invoke("remote:list", request),
    readFile: (request: RemoteFileRequest) => invoke("remote:readFile", request),
    writeFile: (request: RemoteFileRequest) => invoke("remote:writeFile", request),
    mkdir: (request: RemoteFileRequest) => invoke("remote:mkdir", request),
    touch: (request: RemoteFileRequest) => invoke("remote:touch", request),
    rename: (request: RemoteFileRequest & { newPath: string }) => invoke("remote:rename", request),
    delete: (request: RemoteFileRequest) => invoke("remote:delete", request),
    execute: (request: RemoteCommandRequest) => invoke("remote:execute", request)
  }
};

contextBridge.exposeInMainWorld("npsharp", api);
contextBridge.exposeInMainWorld("npsharpApi", api);
contextBridge.exposeInMainWorld("npsharpPath", {
  sep: path.sep,
  delimiter: path.delimiter,
  basename: (targetPath: string) => path.basename(path.normalize(targetPath)),
  dirname: (targetPath: string) => path.dirname(path.normalize(targetPath)),
  extname: (targetPath: string) => path.extname(path.normalize(targetPath)),
  join: (...parts: string[]) => path.join(...parts),
  normalize: (targetPath: string) => path.normalize(targetPath),
  parse: (targetPath: string) => path.parse(path.normalize(targetPath)),
  relative: (from: string, to: string) => path.relative(path.normalize(from), path.normalize(to)),
  resolve: (...parts: string[]) => path.resolve(...parts),
  isAbsolute: (targetPath: string) => path.isAbsolute(path.normalize(targetPath)),
  isSubPath: (root: string, target: string) => {
    const normalizedRoot = path.resolve(path.normalize(root));
    const normalizedTarget = path.resolve(path.normalize(target));
    const relative = path.relative(normalizedRoot, normalizedTarget);
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  },
  fileUri: (targetPath: string) => pathToFileURL(path.resolve(path.normalize(targetPath))).toString()
});
contextBridge.exposeInMainWorld("npsharpEvents", {
  onCommand(callback: (command: string) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, command: string) => callback(command);
    ipcRenderer.on("command", listener);
    return () => ipcRenderer.removeListener("command", listener);
  },
  onOpenFile(callback: (filePath: string) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, filePath: string) => callback(filePath);
    ipcRenderer.on("open-file", listener);
    return () => ipcRenderer.removeListener("open-file", listener);
  }
});
