import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";
import path from "node:path";
import {
  compileArduinoSketch,
  createArduinoSketch,
  detectArduinoCli,
  listArduinoBoards,
  listArduinoPorts,
  loadArduinoConfig,
  monitorArduinoSerial,
  saveArduinoConfig,
  uploadArduinoSketch
} from "../services/node/arduinoService";
import {
  createFile,
  createFolder,
  deletePath,
  exists,
  listDir,
  readFile,
  renamePath,
  revealPath,
  writeFile
} from "../services/node/fileSystemService";
import {
  checkout,
  commit,
  createBranch,
  discard,
  gitDiff,
  gitHistory,
  readGitStatus,
  runGit,
  stage,
  unstage
} from "../services/node/gitService";
import { openLiveServer, stopAllLiveServers } from "../services/node/liveServerService";
import { npsharpHome } from "../services/node/paths";
import { normalizeCwd, runShell } from "../services/node/processService";
import { configureRuntime, discoverRuntimes, listRuntimes, runFile } from "../services/node/runtimeService";
import { replaceAll, searchWorkspace } from "../services/node/searchService";
import { loadSession, loadSettings, resetSettings, saveSession, saveSettings } from "../services/node/settingsService";
import { applyTemplate } from "../services/node/templateService";
import { runJavaDiagnostics } from "../services/node/diagnosticsService";
import {
  closeAllTerminals,
  closeTerminal,
  createTerminalSession,
  killTerminal,
  listTerminalShells,
  resizeTerminal,
  writeTerminal
} from "../services/node/terminalService";
import {
  deleteRemote,
  executeRemote,
  listRemote,
  loadHosts,
  mkdirRemote,
  readRemoteFile,
  renameRemote,
  saveHosts,
  testRemote,
  touchRemote,
  writeRemoteFile
} from "../services/node/remoteService";
import type {
  ArduinoCliRequest,
  ArduinoCompileRequest,
  ArduinoConfigRequest,
  ArduinoCreateSketchRequest,
  ArduinoMonitorRequest,
  ArduinoSaveConfigRequest,
  ArduinoUploadRequest,
  GitFileStatus,
  LiveServerRequest,
  RemoteCommandRequest,
  RemoteFileRequest,
  RemoteHostConfig,
  RemoteListRequest,
  ReplaceAllRequest,
  RuntimeRunRequest,
  SaveFileRequest,
  SearchQuery,
  TemplateApplyRequest,
  TerminalCreateRequest,
  TerminalRunRequest
} from "../shared/types";

let mainWindow: BrowserWindow | undefined;

const gotLock = process.env.VITE_DEV_SERVER_URL ? true : app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

if (!process.env.VITE_DEV_SERVER_URL) {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
}

app.whenReady().then(async () => {
  registerIpcHandlers();
  createApplicationMenu();
  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
}).catch(error => {
  dialog.showErrorBox("NPSharp failed to start", error instanceof Error ? error.message : String(error));
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  void stopAllLiveServers();
  closeAllTerminals();
});

async function createMainWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 760,
    minWidth: 800,
    minHeight: 520,
    frame: false,
    title: "NPSharp",
    icon: resolveWindowIcon(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: true
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await loadDevServer(mainWindow, process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  }
}

function resolveWindowIcon(): string {
  const iconFile = process.platform === "win32"
    ? "icon.ico"
    : process.platform === "darwin"
      ? "icon.icns"
      : "icon.png";
  return path.join(app.getAppPath(), "resources", iconFile);
}

async function loadDevServer(window: BrowserWindow, url: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      await window.loadURL(url);
      return;
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function createApplicationMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        { label: "Novo", accelerator: "CmdOrCtrl+N", click: () => sendCommand("file:new") },
        { label: "Abrir...", accelerator: "CmdOrCtrl+O", click: () => sendCommand("file:open") },
        { type: "separator" },
        { label: "Salvar", accelerator: "CmdOrCtrl+S", click: () => sendCommand("file:save") },
        { label: "Salvar Como...", accelerator: "CmdOrCtrl+Shift+S", click: () => sendCommand("file:saveAs") },
        { label: "Salvar Tudo", click: () => sendCommand("file:saveAll") },
        { type: "separator" },
        { label: "Fechar Editor", accelerator: "CmdOrCtrl+W", click: () => sendCommand("file:close") },
        { label: "Reabrir Editor Fechado", accelerator: "CmdOrCtrl+Shift+T", click: () => sendCommand("file:reopenClosed") },
        { label: "Fechar Todos os Editores", accelerator: "CmdOrCtrl+Shift+W", click: () => sendCommand("file:closeAll") },
        { type: "separator" },
        { label: "Abrir pasta...", accelerator: "CmdOrCtrl+K CmdOrCtrl+O", click: () => sendCommand("workspace:openFolder") },
        { type: "separator" },
        { role: "quit", label: "Exit" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo", label: "Undo" },
        { role: "redo", label: "Redo" },
        { type: "separator" },
        { role: "cut", label: "Cut" },
        { role: "copy", label: "Copy" },
        { role: "paste", label: "Paste" },
        { type: "separator" },
        { label: "Find", accelerator: "CmdOrCtrl+F", click: () => sendCommand("editor:find") },
        { label: "Replace", accelerator: "CmdOrCtrl+H", click: () => sendCommand("editor:replace") },
        { label: "Find in Files", accelerator: "CmdOrCtrl+Shift+F", click: () => sendCommand("view:search") },
        { label: "Replace in Files", accelerator: "CmdOrCtrl+Shift+H", click: () => sendCommand("view:replaceInFiles") },
        { type: "separator" },
        { label: "Comment Line", accelerator: "CmdOrCtrl+/", click: () => sendCommand("editor:commentLine") },
        { label: "Uncomment Line", accelerator: "CmdOrCtrl+Shift+/", click: () => sendCommand("editor:uncommentLine") },
        { label: "Comment Block", accelerator: "CmdOrCtrl+Shift+/", click: () => sendCommand("editor:commentBlock") },
        { type: "separator" },
        { label: "Go to Line", accelerator: "CmdOrCtrl+G", click: () => sendCommand("editor:goToLine") },
        { label: "Go to Start", accelerator: "CmdOrCtrl+Home", click: () => sendCommand("editor:start") },
        { label: "Go to End", accelerator: "CmdOrCtrl+End", click: () => sendCommand("editor:end") },
        { label: "Format Document", accelerator: "Shift+Alt+F", click: () => sendCommand("editor:format") }
      ]
    },
    {
      label: "View",
      submenu: [
        { label: "Explorer", accelerator: "CmdOrCtrl+Shift+E", click: () => sendCommand("view:explorer") },
        { label: "Search", accelerator: "CmdOrCtrl+Shift+F", click: () => sendCommand("view:search") },
        { label: "Source Control", accelerator: "CmdOrCtrl+Shift+G", click: () => sendCommand("view:source") },
        { label: "Run and Debug", accelerator: "CmdOrCtrl+Shift+D", click: () => sendCommand("view:run") },
        { label: "Arduino", click: () => sendCommand("view:arduino") },
        { label: "Terminal", accelerator: "CmdOrCtrl+`", click: () => sendCommand("view:terminal") },
        { label: "Toggle Panel", accelerator: "CmdOrCtrl+J", click: () => sendCommand("view:terminal") },
        { label: "Problems", accelerator: "CmdOrCtrl+Shift+M", click: () => sendCommand("view:problems") },
        { label: "Output", accelerator: "CmdOrCtrl+Shift+U", click: () => sendCommand("view:output") },
        { label: "Keyboard Shortcuts", accelerator: "CmdOrCtrl+K CmdOrCtrl+S", click: () => sendCommand("view:keyboardShortcuts") },
        { label: "Extensions", accelerator: "CmdOrCtrl+Shift+X", click: () => sendCommand("view:extensions") },
        { type: "separator" },
        { role: "zoomIn", label: "Zoom In" },
        { role: "zoomOut", label: "Zoom Out" },
        { role: "resetZoom", label: "Reset Zoom" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Full Screen" }
      ]
    },
    {
      label: "Tools",
      submenu: [
        { label: "Build Project", accelerator: "CmdOrCtrl+Shift+B", click: () => sendCommand("tools:build") },
        { label: "Run Current File", accelerator: "CmdOrCtrl+Alt+R", click: () => sendCommand("tools:run") },
        { label: "Run Without Debugging", accelerator: "CmdOrCtrl+F5", click: () => sendCommand("tools:runWithoutDebug") },
        { label: "Debug Program", accelerator: "F5", click: () => sendCommand("tools:run") },
        { label: "Arduino", click: () => sendCommand("view:arduino") },
        { type: "separator" },
        { label: "New Terminal", accelerator: "CmdOrCtrl+Shift+`", click: () => sendCommand("terminal:new") },
        { label: "Output", click: () => sendCommand("terminal:output") },
        { label: "Problems", click: () => sendCommand("terminal:problems") },
        { label: "Debug Console", click: () => sendCommand("terminal:debug") },
        { label: "Ports", click: () => sendCommand("terminal:ports") },
        { label: "Git", click: () => sendCommand("terminal:git") },
        { label: "Clear Terminal", click: () => sendCommand("terminal:clear") },
        { label: "Kill Process", click: () => sendCommand("terminal:kill") },
        { label: "Close Terminal", click: () => sendCommand("terminal:close") },
        { type: "separator" },
        { label: "Git Pull", click: () => sendCommand("git:pull") },
        { label: "Git Push", click: () => sendCommand("git:push") },
        { label: "Git Fetch", click: () => sendCommand("git:fetch") }
      ]
    },
    {
      label: "more",
      submenu: [
        { label: "Command Palette", accelerator: "CmdOrCtrl+Shift+P", click: () => sendCommand("view:commandPalette") },
        { label: "Command Center", accelerator: "CmdOrCtrl+Alt+C", click: () => sendCommand("npsharp:commandCenter") },
        { label: "About NPSharp", click: () => sendCommand("help:about") }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function sendCommand(command: string): void {
  mainWindow?.webContents.send("command", command);
}

function registerIpcHandlers(): void {
  ipcMain.handle("app:info", () => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    userDataPath: app.getPath("userData"),
    appPath: app.getAppPath(),
    npsharpHome: npsharpHome()
  }));

  ipcMain.handle("window:minimize", () => mainWindow?.minimize());
  ipcMain.handle("window:maximize", () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.handle("window:close", () => mainWindow?.close());
  ipcMain.handle("window:isMaximized", () => mainWindow?.isMaximized() ?? false);

  ipcMain.handle("dialog:openFile", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, { properties: ["openFile"] });
    return { canceled: result.canceled, paths: result.filePaths };
  });
  ipcMain.handle("dialog:openFolder", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, { properties: ["openDirectory"] });
    return { canceled: result.canceled, paths: result.filePaths };
  });
  ipcMain.handle("dialog:chooseWallpaper", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openFile"],
      filters: [
        { name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    return { canceled: result.canceled, paths: result.filePaths };
  });
  ipcMain.handle("dialog:saveFile", async (_event, request: SaveFileRequest) => {
    let targetPath = request.path;
    if (!targetPath) {
      const result = await dialog.showSaveDialog(mainWindow!, { defaultPath: request.suggestedName || "untitled.txt" });
      if (result.canceled || !result.filePath) return { canceled: true };
      targetPath = result.filePath;
    }
    await writeFile(targetPath, request.content);
    return { canceled: false, path: targetPath };
  });

  ipcMain.handle("settings:load", () => loadSettings());
  ipcMain.handle("settings:save", (_event, settings) => saveSettings(settings));
  ipcMain.handle("settings:reset", () => resetSettings());
  ipcMain.handle("settings:loadSession", () => loadSession());
  ipcMain.handle("settings:saveSession", (_event, session) => saveSession(session));

  ipcMain.handle("fs:listDir", (_event, targetPath: string) => listDir(targetPath));
  ipcMain.handle("fs:readFile", (_event, targetPath: string) => readFile(targetPath));
  ipcMain.handle("fs:writeFile", (_event, targetPath: string, content: string) => writeFile(targetPath, content));
  ipcMain.handle("fs:createFile", (_event, targetPath: string) => createFile(targetPath));
  ipcMain.handle("fs:createFolder", (_event, targetPath: string) => createFolder(targetPath));
  ipcMain.handle("fs:rename", (_event, oldPath: string, newPath: string) => renamePath(oldPath, newPath));
  ipcMain.handle("fs:delete", (_event, targetPath: string) => deletePath(targetPath));
  ipcMain.handle("fs:reveal", (_event, targetPath: string) => revealPath(targetPath));
  ipcMain.handle("fs:exists", (_event, targetPath: string) => exists(targetPath));

  ipcMain.handle("search:workspace", (_event, query: SearchQuery) => searchWorkspace(query));
  ipcMain.handle("search:replaceAll", (_event, request: ReplaceAllRequest) => replaceAll(request));
  ipcMain.handle("diagnostics:java", (_event, workspace: string, filePath?: string) => runJavaDiagnostics(workspace, filePath));

  ipcMain.handle("git:status", (_event, workspace: string) => readGitStatus(workspace));
  ipcMain.handle("git:run", (_event, repo: string, args: string[]) => runGit(repo, args));
  ipcMain.handle("git:stage", (_event, repo: string, file: GitFileStatus) => stage(repo, file));
  ipcMain.handle("git:unstage", (_event, repo: string, file: GitFileStatus) => unstage(repo, file));
  ipcMain.handle("git:discard", (_event, repo: string, file: GitFileStatus) => discard(repo, file));
  ipcMain.handle("git:commit", (_event, repo: string, message: string, allowEmpty?: boolean) => commit(repo, message, allowEmpty));
  ipcMain.handle("git:checkout", (_event, repo: string, branch: string) => checkout(repo, branch));
  ipcMain.handle("git:createBranch", (_event, repo: string, branch: string) => createBranch(repo, branch));
  ipcMain.handle("git:diff", (_event, repo: string, file: GitFileStatus, staged: boolean) => gitDiff(repo, file, staged));
  ipcMain.handle("git:history", (_event, repo: string) => gitHistory(repo));

  ipcMain.handle("terminal:run", async (_event, request: TerminalRunRequest) => {
    const cwd = normalizeCwd(request.cwd);
    const result = await runShell(request.command, cwd, request.shell);
    return { cwd, output: result.output, code: result.code };
  });
  ipcMain.handle("terminal:shells", () => listTerminalShells());
  ipcMain.handle("terminal:create", (event, request: TerminalCreateRequest) => createTerminalSession(request, {
    onData: data => event.sender.send("terminal:data", data),
    onExit: exit => event.sender.send("terminal:exit", exit)
  }));
  ipcMain.handle("terminal:write", (_event, id: string, data: string) => writeTerminal(id, data));
  ipcMain.handle("terminal:resize", (_event, id: string, cols: number, rows: number) => resizeTerminal(id, cols, rows));
  ipcMain.handle("terminal:kill", (_event, id: string) => killTerminal(id));
  ipcMain.handle("terminal:close", (_event, id: string) => closeTerminal(id));

  ipcMain.handle("runtime:list", () => listRuntimes());
  ipcMain.handle("runtime:discover", () => discoverRuntimes(true));
  ipcMain.handle("runtime:configure", (_event, languageId: string, executablePath: string) => configureRuntime(languageId, executablePath));
  ipcMain.handle("runtime:runFile", (_event, request: RuntimeRunRequest) => runFile(request));

  ipcMain.handle("arduino:detect", (_event, request?: ArduinoCliRequest) => detectArduinoCli(request));
  ipcMain.handle("arduino:loadConfig", (_event, request: ArduinoConfigRequest) => loadArduinoConfig(request));
  ipcMain.handle("arduino:saveConfig", (_event, request: ArduinoSaveConfigRequest) => saveArduinoConfig(request));
  ipcMain.handle("arduino:listPorts", (_event, request?: ArduinoCliRequest) => listArduinoPorts(request));
  ipcMain.handle("arduino:listBoards", (_event, request?: ArduinoCliRequest) => listArduinoBoards(request));
  ipcMain.handle("arduino:createSketch", (_event, request: ArduinoCreateSketchRequest) => createArduinoSketch(request));
  ipcMain.handle("arduino:compile", (_event, request: ArduinoCompileRequest) => compileArduinoSketch(request));
  ipcMain.handle("arduino:upload", (_event, request: ArduinoUploadRequest) => uploadArduinoSketch(request));
  ipcMain.handle("arduino:monitor", (_event, request: ArduinoMonitorRequest) => monitorArduinoSerial(request));

  ipcMain.handle("liveServer:open", (_event, request: LiveServerRequest) => openLiveServer(request));
  ipcMain.handle("liveServer:stopAll", () => stopAllLiveServers());
  ipcMain.handle("templates:apply", (_event, request: TemplateApplyRequest) => applyTemplate(app.getAppPath(), request));

  ipcMain.handle("remote:loadHosts", () => loadHosts());
  ipcMain.handle("remote:saveHosts", (_event, hosts: RemoteHostConfig[]) => saveHosts(hosts));
  ipcMain.handle("remote:test", (_event, request: RemoteCommandRequest) => testRemote(request));
  ipcMain.handle("remote:list", (_event, request: RemoteListRequest) => listRemote(request));
  ipcMain.handle("remote:readFile", (_event, request: RemoteFileRequest) => readRemoteFile(request));
  ipcMain.handle("remote:writeFile", (_event, request: RemoteFileRequest) => writeRemoteFile(request));
  ipcMain.handle("remote:mkdir", (_event, request: RemoteFileRequest) => mkdirRemote(request));
  ipcMain.handle("remote:touch", (_event, request: RemoteFileRequest) => touchRemote(request));
  ipcMain.handle("remote:rename", (_event, request: RemoteFileRequest & { newPath: string }) => renameRemote(request));
  ipcMain.handle("remote:delete", (_event, request: RemoteFileRequest) => deleteRemote(request));
  ipcMain.handle("remote:execute", (_event, request: RemoteCommandRequest) => executeRemote(request));
}
