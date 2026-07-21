import { contextBridge, ipcRenderer } from "electron";
import { randomUUID } from "node:crypto";
import type {
  AppSettings,
  ArduinoCliRequest,
  ArduinoCompileRequest,
  ArduinoConfigRequest,
  ArduinoCreateSketchRequest,
  ArduinoMonitorRequest,
  ArduinoSaveConfigRequest,
  ArduinoUploadRequest,
  GitFileStatus,
  LiveServerRequest,
  NpsharpApi,
  PersistedSession,
  RemoteCommandRequest,
  RemoteFileRequest,
  RemoteHostConfig,
  RemoteListRequest,
  ReplaceAllRequest,
  RuntimeRunRequest,
  SaveFileRequest,
  SearchQuery,
  TemplateApplyRequest,
  TerminalDataEvent,
  TerminalExitEvent,
  TerminalCreateRequest,
  TerminalRunRequest,
  WorkspaceChangeEvent
} from "../shared/types";

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  try {
    return await ipcRenderer.invoke(channel, ...args) as T;
  } catch (error) {
    console.error(`[NPSharp IPC] ${channel} failed`, error);
    throw error;
  }
}

const api: NpsharpApi = {
  appInfo: () => invoke("app:info"),
  window: {
    minimize: () => invoke("window:minimize"),
    maximize: () => invoke("window:maximize"),
    close: () => invoke("window:close"),
    isMaximized: () => invoke("window:isMaximized")
  },
  dialog: {
    openFile: () => invoke("dialog:openFile"),
    openFolder: () => invoke("dialog:openFolder"),
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
  fs: {
    listDir: (targetPath: string) => invoke("fs:listDir", targetPath),
    readFile: (targetPath: string) => invoke("fs:readFile", targetPath),
    writeFile: (targetPath: string, content: string) => invoke("fs:writeFile", targetPath, content),
    createFile: (targetPath: string) => invoke("fs:createFile", targetPath),
    createFolder: (targetPath: string) => invoke("fs:createFolder", targetPath),
    rename: (oldPath: string, newPath: string) => invoke("fs:rename", oldPath, newPath),
    delete: (targetPath: string) => invoke("fs:delete", targetPath),
    reveal: (targetPath: string) => invoke("fs:reveal", targetPath),
    exists: (targetPath: string) => invoke("fs:exists", targetPath),
    watch: (targetPath: string, callback: (event: WorkspaceChangeEvent) => void) => {
      const watchId = randomUUID();
      const listener = (_event: Electron.IpcRendererEvent, payload: WorkspaceChangeEvent & { watchId: string }) => {
        if (payload.watchId === watchId) callback(payload);
      };
      ipcRenderer.on("fs:watch:event", listener);
      void invoke<void>("fs:watch:start", watchId, targetPath).catch(error => {
        console.error(`[NPSharp IPC] fs:watch:start failed (${targetPath})`, error);
      });
      return () => {
        ipcRenderer.removeListener("fs:watch:event", listener);
        void invoke<void>("fs:watch:stop", watchId).catch(error => {
          console.error(`[NPSharp IPC] fs:watch:stop failed (${targetPath})`, error);
        });
      };
    }
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
    runFile: (request: RuntimeRunRequest) => invoke("runtime:runFile", request)
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
contextBridge.exposeInMainWorld("npsharpEvents", {
  onCommand(callback: (command: string) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, command: string) => callback(command);
    ipcRenderer.on("command", listener);
    return () => ipcRenderer.removeListener("command", listener);
  }
});
