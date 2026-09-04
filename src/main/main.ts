/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { app, BrowserWindow, dialog, ipcMain, Menu, shell, type MenuItemConstructorOptions, type OpenDialogOptions, type SaveDialogOptions, type WebContents } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
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
  createNewFile,
  createFolder,
  deletePath,
  exists,
  listDir,
  openFile,
  saveStructuredFile,
  readFile,
  renamePath,
  revealPath,
  watchWorkspace,
  writeFile
} from "../services/node/fileSystemService";
import { ExtensionManager } from "../services/node/extensionManager";
import {
  checkout,
  commit,
  createBranch,
  discard,
  gitDiff,
  gitDiffContent,
  gitHistory,
  readGitStatus,
  runGit,
  stage,
  unstage
} from "../services/node/gitService";
import { openLiveServer, stopAllLiveServers } from "../services/node/liveServerService";
import { officeSuiteStatus, openInOfficeSuite } from "../services/node/officeService";
import { configureSharpDataRoot, sharpHome } from "../services/node/paths";
import { BUILD_CONFIG } from "../shared/buildConfig";
import { detectPortableMode } from "../services/node/portableMode";
import { normalizeCwd, runShell } from "../services/node/processService";
import { resourcePath, resourcesRoot } from "../services/node/resourcePaths";
import {
  autoDetectRuntime,
  configureRuntime,
  discoverRuntimes,
  installRuntimeDependencies,
  listRuntimeConfigStates,
  listRuntimes,
  runFile,
  updateRuntimeConfig,
  validateRuntime
} from "../services/node/runtimeService";
import { cancelSearch, indexWorkspaceFiles, replaceAll, searchWorkspace } from "../services/node/searchService";
import { loadSession, loadSettings, resetSettings, saveSession, saveSettings } from "../services/node/settingsService";
import { applyTemplate } from "../services/node/templateService";
import { runJavaDiagnostics } from "../services/node/diagnosticsService";
import { createElectronUpdateService, type UpdateService } from "../services/node/updateService";
import { StartupProfiler, type StartupStage } from "../services/node/startupProfiler";
import { UPDATE_IPC } from "../shared/updateIpc";
import { DEFAULT_LOCALE, LOCALE_LABELS, normalizeLocale, SUPPORTED_LOCALES, t, type AppLocale } from "../shared/i18n";
import { AIService } from "../services/node/ai/AIService";
import { AISettingsService } from "../services/node/ai/AISettingsService";
import { ConversationManager } from "../services/node/ai/ConversationManager";
import { ProviderManager } from "../services/node/ai/ProviderManager";
import { StreamingController } from "../services/node/ai/StreamingController";
import {
  closeAllTerminals,
  closeTerminal,
  createTerminalSession,
  killTerminal,
  listTerminalShells,
  resizeTerminal,
  writeTerminal
} from "../services/node/terminalService";
import { RemoteHostConnectionManager } from "../services/node/remote/RemoteHostConnectionManager";
import { DiscordRichPresenceManager } from "./discord/DiscordRichPresenceManager";
import type {
  AIChatRequest,
  AIConversationUpdate,
  AIProviderId,
  AISaveSettingsRequest,
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
  ReplaceAllRequest,
  AppUpdateStatus,
  DiscordPresenceContext,
  RuntimeRunRequest,
  RuntimeDependencyInstallRequest,
  SaveFileRequest,
  SearchQuery,
  SearchResult,
  TemplateApplyRequest,
  TerminalCreateRequest,
  TerminalRunRequest,
  WorkspaceCreateFileRequest,
  WorkspacePathRequest,
  WorkspaceRenameRequest
} from "../shared/types";

let mainWindow: BrowserWindow | undefined;
let shuttingDown = false;
let runtimeResourcesClosed = false;
let aiStreamingController: StreamingController | undefined;
let updateService: UpdateService | undefined;
let remoteHostManager: RemoteHostConnectionManager | undefined;
let discordPresenceManager: DiscordRichPresenceManager | undefined;
const startupProfiler = new StartupProfiler();
let startupReady = false;
let rendererReady = false;
const portableMode = detectPortableMode();

if (portableMode.enabled && portableMode.directory) {
  const portableData = path.join(portableMode.directory, "data");
  configureSharpDataRoot(portableData);
  app.setPath("userData", portableData);
  app.setPath("sessionData", path.join(portableData, "chromium"));
}

interface WorkspaceWatcherRegistration {
  readonly dispose: () => void;
  readonly sender: WebContents;
  readonly onSenderDestroyed: () => void;
}

interface TerminalRegistration {
  readonly ids: Set<string>;
  readonly onSenderDestroyed: () => void;
}

const workspaceWatchers = new Map<string, WorkspaceWatcherRegistration>();
const terminalRegistrations = new Map<WebContents, TerminalRegistration>();
let applicationLocale: AppLocale = DEFAULT_LOCALE;
const shouldOpenDevTools = !app.isPackaged
  && Boolean(process.env.VITE_DEV_SERVER_URL)
  && process.env.SHARP_OPEN_DEVTOOLS === "1";

installProcessLifecycleHandlers();

const gotLock = process.env.VITE_DEV_SERVER_URL ? true : app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

if (!process.env.VITE_DEV_SERVER_URL) {
  app.on("second-instance", (_event, argv) => {
    if (shuttingDown) return;
    const window = currentMainWindow();
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
    void openFilesFromArguments(argv);
  });
}

app.whenReady().then(async () => {
  startupProfiler.mark("T1-electron-ready");
  discordPresenceManager = new DiscordRichPresenceManager();
  registerIpcHandlers();
  createApplicationMenu();
  await createMainWindow();
  void openFilesFromArguments(process.argv);

  // A preferência de idioma não deve atrasar a primeira janela. A tela de
  // configurações continua sendo a fonte de verdade e atualiza o menu depois.
  void loadSettings().then(async settings => { applyApplicationLocale(settings.language); await discordPresenceManager?.configure(settings.discordRichPresence); }).catch(error => {
    console.warn("[Sharp-OSS startup] Não foi possível carregar o idioma inicial.", error);
  });

  app.on("activate", async () => {
    if (!shuttingDown && BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
}).catch(error => {
  dialog.showErrorBox(`${BUILD_CONFIG.displayName} failed to start`, error instanceof Error ? error.message : String(error));
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  shuttingDown = true;
  cleanupRuntimeResources();
});

app.on("will-quit", () => {
  shuttingDown = true;
  cleanupRuntimeResources();
});

async function createMainWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1280,
    height: 760,
    minWidth: 800,
    minHeight: 520,
    frame: false,
    title: BUILD_CONFIG.displayName,
    icon: resolveWindowIcon(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: shouldOpenDevTools
    }
  });
  if (shouldOpenDevTools) {
    window.webContents.openDevTools({ mode: "detach" });
  }
  const webContents = window.webContents;
  mainWindow = window;
  startupProfiler.mark("T2-window-created");

  window.once("ready-to-show", () => {
    if (!window.isDestroyed()) {
      startupProfiler.mark("T3-window-visible");
      window.show();
    }
  });
  webContents.once("destroyed", () => {
    closeWorkspaceWatchersForSender(webContents, false);
    closeTerminalsForSender(webContents, false);
  });
  window.once("closed", () => {
    closeWorkspaceWatchersForSender(webContents, false);
    closeTerminalsForSender(webContents, false);
    rendererReady = false;
    if (mainWindow === window) mainWindow = undefined;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await loadDevServer(window, process.env.VITE_DEV_SERVER_URL);
  } else if (!window.isDestroyed()) {
    try {
      await window.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
    } catch (error) {
      if (!window.isDestroyed()) throw error;
    }
  }
}

function resolveWindowIcon(): string {
  const iconFile = process.platform === "win32"
    ? "icon.ico"
    : process.platform === "darwin"
      ? "icon.icns"
      : "icon.png";
  return resourcePath(app.getAppPath(), app.isPackaged, iconFile);
}

async function loadDevServer(window: BrowserWindow, url: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (window.isDestroyed()) return;
    try {
      await window.loadURL(url);
      return;
    } catch (error) {
      if (window.isDestroyed()) return;
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function createApplicationMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: "Arquivo",
      submenu: [
        { label: "Novo", accelerator: "CmdOrCtrl+N", click: () => sendCommand("file:new") },
        { label: "Nova janela", accelerator: "CmdOrCtrl+Shift+N", click: () => void createMainWindow() },
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
        { label: "Abrir Pasta...", click: () => sendCommand("workspace:openFolder") },
        { type: "separator" },
        { role: "quit", label: "Sair" }
      ]
    },
    {
      label: "Editar",
      submenu: [
        { role: "undo", label: "Desfazer" },
        { role: "redo", label: "Refazer" },
        { type: "separator" },
        { role: "cut", label: "Recortar" },
        { role: "copy", label: "Copiar" },
        { role: "paste", label: "Colar" },
        { type: "separator" },
        { label: "Localizar", accelerator: "CmdOrCtrl+F", click: () => sendCommand("editor:find") },
        { label: "Substituir", accelerator: "CmdOrCtrl+H", click: () => sendCommand("editor:replace") },
        { label: "Localizar nos arquivos", accelerator: "CmdOrCtrl+Shift+F", click: () => sendCommand("view:search") },
        { label: "Substituir nos arquivos", accelerator: "CmdOrCtrl+Shift+H", click: () => sendCommand("view:replaceInFiles") },
        { type: "separator" },
        { label: "Comentar linha", accelerator: "CmdOrCtrl+/", click: () => sendCommand("editor:commentLine") },
        { label: "Descomentar linha", accelerator: "CmdOrCtrl+Shift+/", click: () => sendCommand("editor:uncommentLine") },
        { label: "Comentar bloco", accelerator: "CmdOrCtrl+Shift+/", click: () => sendCommand("editor:commentBlock") },
        { type: "separator" },
        { label: "Ir para a linha", accelerator: "CmdOrCtrl+G", click: () => sendCommand("editor:goToLine") },
        { label: "Ir para o início", accelerator: "CmdOrCtrl+Home", click: () => sendCommand("editor:start") },
        { label: "Ir para o fim", accelerator: "CmdOrCtrl+End", click: () => sendCommand("editor:end") },
        { label: "Formatar documento", accelerator: "Shift+Alt+F", click: () => sendCommand("editor:format") }
      ]
    },
    {
      label: "Exibir",
      submenu: [
        { label: "Explorador", accelerator: "CmdOrCtrl+Shift+E", click: () => sendCommand("view:explorer") },
        { label: "Pesquisar", accelerator: "CmdOrCtrl+Shift+F", click: () => sendCommand("view:search") },
        { label: "Controle de código-fonte", accelerator: "CmdOrCtrl+Shift+G", click: () => sendCommand("view:source") },
        { label: "Executar e depurar", accelerator: "CmdOrCtrl+Shift+D", click: () => sendCommand("view:run") },
        { label: "Arduino", click: () => sendCommand("view:arduino") },
        { label: "Terminal", accelerator: "CmdOrCtrl+`", click: () => sendCommand("view:terminal") },
        { label: "Alternar painel", accelerator: "CmdOrCtrl+J", click: () => sendCommand("view:terminal") },
        { label: "Problemas", accelerator: "CmdOrCtrl+Shift+M", click: () => sendCommand("view:problems") },
        { label: "Saída", accelerator: "CmdOrCtrl+Shift+U", click: () => sendCommand("view:output") },
        { label: "Atalhos de Teclado", click: () => sendCommand("view:keyboardShortcuts") },
        { label: "Extensões", accelerator: "CmdOrCtrl+Shift+X", click: () => sendCommand("view:extensions") },
        { type: "separator" },
        { role: "zoomIn", label: "Ampliar" },
        { role: "zoomOut", label: "Reduzir" },
        { role: "resetZoom", label: "Redefinir zoom" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Tela cheia" }
      ]
    },
    {
      label: "Ferramentas",
      submenu: [
        { label: "Compilar projeto", accelerator: "CmdOrCtrl+Shift+B", click: () => sendCommand("tools:build") },
        { label: "Executar arquivo atual", accelerator: "CmdOrCtrl+Alt+R", click: () => sendCommand("tools:run") },
        { label: "Executar sem depuração", accelerator: "CmdOrCtrl+F5", click: () => sendCommand("tools:runWithoutDebug") },
        { label: "Depurar programa", accelerator: "F5", click: () => sendCommand("tools:run") },
        { label: "Arduino", click: () => sendCommand("view:arduino") },
        { label: "Configurar runtimes de linguagem", click: () => sendCommand("sharp:configureLanguageRuntimes") },
        { type: "separator" },
        { label: "Novo terminal", accelerator: "CmdOrCtrl+Shift+`", click: () => sendCommand("terminal:new") },
        { label: "Saída", click: () => sendCommand("terminal:output") },
        { label: "Problemas", click: () => sendCommand("terminal:problems") },
        { label: "Console de depuração", click: () => sendCommand("terminal:debug") },
        { label: "Portas", click: () => sendCommand("terminal:ports") },
        { label: "Git", click: () => sendCommand("terminal:git") },
        { label: "Limpar terminal", click: () => sendCommand("terminal:clear") },
        { label: "Encerrar processo", click: () => sendCommand("terminal:kill") },
        { label: "Fechar terminal", click: () => sendCommand("terminal:close") },
        { type: "separator" },
        { label: "Git: Pull", click: () => sendCommand("git:pull") },
        { label: "Git: Push", click: () => sendCommand("git:push") },
        { label: "Git: Fetch", click: () => sendCommand("git:fetch") }
      ]
    },
    {
      label: "Mais",
      submenu: [
        { label: "Paleta de comandos", accelerator: "CmdOrCtrl+Shift+P", click: () => sendCommand("view:commandPalette") },
        { label: "Central de comandos", accelerator: "CmdOrCtrl+Alt+C", click: () => sendCommand("sharp:commandCenter") },
        { label: "Verificar atualizações", click: () => sendCommand("update:check") },
        { label: "Instalar extensão de VSIX", click: () => sendCommand("extensions:installVsix") },
        { label: "Sobre o Sharp-OSS", click: () => sendCommand("help:about") }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(localizeApplicationMenu(template)));
}

function localizeApplicationMenu(items: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
  return items.map(item => ({
    ...item,
    ...(item.label ? { label: t(applicationLocale, item.label) } : {}),
    ...(Array.isArray(item.submenu) ? { submenu: localizeApplicationMenu(item.submenu) } : {})
  }));
}

function sendCommand(command: string): void {
  if (shuttingDown) return;
  const contents = currentMainWindow()?.webContents;
  if (isUsableWebContents(contents)) contents.send("command", command);
}

function initializeAutoUpdater(): void {
  if (updateService) return;
  updateService = createElectronUpdateService({
    currentVersion: app.getVersion(),
    isPackaged: app.isPackaged,
    platform: process.platform,
    appImagePath: process.env.APPIMAGE,
    isPortable: portableMode.enabled,
    logger: console
  });
  updateService.onStatus(status => sendUpdateStatus(status));
  if (!shuttingDown) void updateService.checkForUpdates();
}

function sendUpdateStatus(status: AppUpdateStatus): void {
  const contents = currentMainWindow()?.webContents;
  if (isUsableWebContents(contents)) contents.send(UPDATE_IPC.status, status);
}

const pendingOpenFiles = new Set<string>();

async function openFilesFromArguments(argv: readonly string[]): Promise<void> {
  for (const argument of argv) {
    if (!isCandidateOpenFile(argument)) continue;
    try {
      const target = path.resolve(argument);
      const stats = await fs.stat(target);
      if (stats.isFile()) pendingOpenFiles.add(target);
    } catch {
      // Argumentos não existentes nunca são encaminhados ao renderer.
    }
  }
  const contents = currentMainWindow()?.webContents;
  if (rendererReady && isUsableWebContents(contents)) await flushPendingOpenFiles(contents);
}

function isCandidateOpenFile(argument: string): boolean {
  return typeof argument === "string"
    && argument.length > 0
    && !argument.startsWith("-")
    && path.isAbsolute(argument)
    && path.resolve(argument) !== path.resolve(process.execPath);
}

async function flushPendingOpenFiles(contents: WebContents | undefined): Promise<void> {
  if (!isUsableWebContents(contents) || pendingOpenFiles.size === 0) return;
  const files = [...pendingOpenFiles];
  pendingOpenFiles.clear();
  for (const file of files) sendToWebContents(contents, "open-file", file);
}

function registerIpcHandlers(): void {
  const extensionManager = new ExtensionManager(app.getPath("userData"));
  const aiSettings = new AISettingsService(app.getPath("userData"));
  const conversations = new ConversationManager(app.getPath("userData"));
  const providerManager = new ProviderManager(aiSettings, path.join(app.getPath("userData"), "extensions"));
  aiStreamingController = new StreamingController();
  const aiService = new AIService(providerManager, aiSettings, aiStreamingController);
  const serverDist = app.isPackaged ? path.join(process.resourcesPath, "sharp-server", "dist") : path.join(app.getAppPath(), "sharp-server", "dist");
  remoteHostManager = new RemoteHostConnectionManager(serverDist, (channel, value) => {
    for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send(channel, value);
  });
  const remoteEtags = new Map<string, string>();

  ipcMain.handle("app:info", () => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    userDataPath: app.getPath("userData"),
    appPath: app.getAppPath(),
    sharpHome: sharpHome(),
    architecture: process.arch,
    isPackaged: app.isPackaged,
    runtime: {
      electron: process.versions.electron,
      chromium: process.versions.chrome,
      node: process.versions.node,
      v8: process.versions.v8
    }
  }));
  ipcMain.handle("startup:mark", (_event, stage: "renderer-rendered" | "editor-interactive") => {
    startupProfiler.mark(stage === "renderer-rendered" ? "T4-renderer-rendered" : "T5-editor-interactive");
  });
  ipcMain.handle("startup:ready", () => {
    if (startupReady) {
      rendererReady = true;
      return flushPendingOpenFiles(currentMainWindow()?.webContents);
    }
    startupReady = true;
    rendererReady = true;
    startupProfiler.mark("T6-secondary-scheduled");
    initializeAutoUpdater();
    void flushPendingOpenFiles(currentMainWindow()?.webContents).catch(error => {
      console.warn("[Sharp-OSS startup] Não foi possível abrir os arquivos solicitados.", error);
    });
    void startupProfiler.writeReport(app.getPath("userData")).catch(error => {
      console.warn("[Sharp-OSS startup] Não foi possível gravar o perfil de inicialização.", error);
    });
  });

  ipcMain.handle(UPDATE_IPC.status, () => updateService?.getStatus() ?? { state: "idle", message: "Atualizador iniciando…" });
  ipcMain.handle(UPDATE_IPC.check, () => updateService?.checkForUpdates() ?? Promise.resolve({ state: "idle", message: "Atualizador iniciando…" }));
  ipcMain.handle(UPDATE_IPC.download, () => updateService?.downloadUpdate() ?? Promise.resolve({ state: "idle", message: "Atualizador iniciando…" }));
  ipcMain.handle(UPDATE_IPC.install, () => updateService?.installUpdate());

  ipcMain.handle("window:new", () => createMainWindow());
  ipcMain.handle("window:minimize", event => BrowserWindow.fromWebContents(event.sender)?.minimize());
  ipcMain.handle("window:maximize", event => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  });
  ipcMain.handle("window:close", event => BrowserWindow.fromWebContents(event.sender)?.close());
  ipcMain.handle("window:isMaximized", event => BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false);

  ipcMain.handle("dialog:openFile", async () => {
    const result = await showOpenDialog({ properties: ["openFile"] });
    return { canceled: result.canceled, paths: normalizeDialogPaths(result.filePaths) };
  });
  ipcMain.handle("dialog:openFolder", async () => {
    const result = await showOpenDialog({ properties: ["openDirectory"] });
    return { canceled: result.canceled, paths: normalizeDialogPaths(result.filePaths) };
  });
  ipcMain.handle("dialog:openVsix", async () => {
    const result = await showOpenDialog({
      properties: ["openFile"],
      filters: [
        { name: "VSIX Extensions", extensions: ["vsix"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    return { canceled: result.canceled, paths: normalizeDialogPaths(result.filePaths) };
  });
  ipcMain.handle("dialog:chooseWallpaper", async () => {
    const result = await showOpenDialog({
      properties: ["openFile"],
      filters: [
        { name: "Imagens (PNG, JPEG, JFIF, WebP, GIF e BMP)", extensions: ["png", "jpg", "jpeg", "jfif", "webp", "gif", "bmp"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    return { canceled: result.canceled, paths: normalizeDialogPaths(result.filePaths) };
  });
  ipcMain.handle("dialog:saveFile", async (_event, request: SaveFileRequest) => {
    let targetPath = request.path;
    if (!targetPath) {
      const result = await showSaveDialog({ defaultPath: request.suggestedName || "untitled.txt" });
      if (result.canceled || !result.filePath) return { canceled: true };
      targetPath = normalizeDialogPath(result.filePath);
    }
    await writeFile(targetPath, request.content, request.encoding);
    return { canceled: false, path: targetPath };
  });

  ipcMain.handle("settings:load", () => loadSettings());
  ipcMain.handle("settings:save", async (_event, settings) => {
    const saved = await saveSettings(settings);
    applyApplicationLocale(saved.language);
    await discordPresenceManager?.configure(saved.discordRichPresence);
    return saved;
  });
  ipcMain.handle("settings:reset", async () => {
    const settings = await resetSettings();
    applyApplicationLocale(settings.language);
    await discordPresenceManager?.configure(settings.discordRichPresence);
    return settings;
  });
  ipcMain.handle("discord-presence:update-context", (_event, context: DiscordPresenceContext) => discordPresenceManager?.updateContext(normalizeDiscordContext(context)));
  ipcMain.handle("discord-presence:reconnect", () => discordPresenceManager?.reconnect());
  ipcMain.handle("discord-presence:clear", () => discordPresenceManager?.clear());
  ipcMain.handle("discord-presence:status", () => discordPresenceManager?.getState() ?? { status: "disabled", message: "Discord Rich Presence indisponível." });
  ipcMain.handle("settings:loadSession", () => loadSession());
  ipcMain.handle("settings:saveSession", (_event, session) => saveSession(session));
  ipcMain.handle("i18n:getLanguage", () => applicationLocale);
  ipcMain.handle("i18n:setLanguage", async (_event, language: unknown) => {
    const settings = await saveSettings({ ...(await loadSettings()), language: normalizeLocale(language) });
    applyApplicationLocale(settings.language);
    return settings.language;
  });
  ipcMain.handle("i18n:availableLanguages", () => SUPPORTED_LOCALES.map(code => ({ code, label: LOCALE_LABELS[code] })));

  ipcMain.handle("ai:providers", () => providerManager.descriptors());
  ipcMain.handle("ai:listModels", async (_event, provider: AIProviderId) => {
    const settings = await aiSettings.load();
    return providerManager.listModels(provider, { ...settings, provider });
  });
  ipcMain.handle("ai:settings:load", () => aiSettings.load());
  ipcMain.handle("ai:settings:save", (_event, settings: AISaveSettingsRequest) => aiSettings.save(settings));
  ipcMain.handle("ai:codex:account", () => providerManager.codexAccount());
  ipcMain.handle("ai:loginWithChatGpt", async () => {
    const login = await providerManager.startCodexChatGptLogin();
    await shell.openExternal(login.authUrl);
    return login.completed;
  });
  ipcMain.handle("ai:codex:logout", () => providerManager.logoutCodex());
  ipcMain.handle("ai:conversations:list", () => conversations.list());
  ipcMain.handle("ai:conversations:create", (_event, provider?: AIProviderId, model?: string) => conversations.create(provider, model));
  ipcMain.handle("ai:conversations:update", (_event, update: AIConversationUpdate) => conversations.update(update));
  ipcMain.handle("ai:conversations:delete", (_event, id: string) => conversations.delete(id));
  ipcMain.handle("ai:send", async (event, request: AIChatRequest) => {
    const sender = event.sender;
    await aiService.ask(request, payload => sendToWebContents(sender, "ai:stream", payload));
  });
  ipcMain.handle("ai:cancel", (_event, requestId: string) => {
    aiStreamingController?.cancel(requestId);
  });

  ipcMain.handle("fs:listDir", async (_event, targetPath: string) => {
    const remote = remoteHostManager!.resolveUri(targetPath); if (!remote) return listDir(targetPath);
    const entries = await remoteHostManager!.request<Array<{ path: string; name: string; type: string; size: number; mtimeMs: number }>>(remote.sessionId, "fs.readDir", { path: remote.path });
    const prefix = targetPath.slice(0, targetPath.length - remote.path.length);
    return entries.map(entry => ({ path: `${prefix}${entry.path}`, name: entry.name, directory: entry.type === "directory", size: entry.size, modifiedAt: entry.mtimeMs, hidden: entry.name.startsWith(".") }));
  });
  ipcMain.handle("fs:readFile", async (_event, targetPath: string) => {
    const remote = remoteHostManager!.resolveUri(targetPath); if (!remote) return readFile(targetPath);
    const file = await remoteHostManager!.request<{ content: string; etag: string; size: number }>(remote.sessionId, "fs.readFile", { path: remote.path }); remoteEtags.set(targetPath, file.etag);
    return { path: targetPath, name: path.posix.basename(remote.path), content: file.content, lineEnding: file.content.includes("\r\n") ? "\r\n" : "\n", encoding: "utf8", remoteMetadata: { mtimeMs: 0, size: file.size, etag: file.etag } };
  });
  ipcMain.handle("fs:openFile", async (_event, targetPath: string, forceText = false) => {
    const remote = remoteHostManager!.resolveUri(targetPath); if (!remote) return openFile(targetPath, forceText);
    const file = await remoteHostManager!.request<{ content: string; etag: string; size: number }>(remote.sessionId, "fs.readFile", { path: remote.path }); remoteEtags.set(targetPath, file.etag);
    return { path: targetPath, name: path.posix.basename(remote.path), editor: "text", size: file.size, type: path.posix.extname(remote.path).slice(1).toUpperCase() || "Arquivo", content: file.content, lineEnding: file.content.includes("\r\n") ? "\r\n" : "\n", encoding: "utf8" };
  });
  ipcMain.handle("fs:writeFile", async (_event, targetPath: string, content: string, encoding) => { const remote = remoteHostManager!.resolveUri(targetPath); if (!remote) return writeFile(targetPath, content, encoding); await remoteHostManager!.request(remote.sessionId, "fs.writeFile", { path: remote.path, content, etag: remoteEtags.get(targetPath) }); const refreshed = await remoteHostManager!.request<{ etag: string }>(remote.sessionId, "fs.readFile", { path: remote.path }); remoteEtags.set(targetPath, refreshed.etag); });
  ipcMain.handle("fs:saveStructuredFile", (_event, request) => saveStructuredFile(request));
  ipcMain.handle("office:status", () => officeSuiteStatus());
  ipcMain.handle("office:open", (_event, targetPath: string) => openInOfficeSuite(targetPath));
  ipcMain.handle("fs:createFile", (_event, targetPath: string) => { const remote = remoteHostManager!.resolveUri(targetPath); return remote ? remoteHostManager!.request(remote.sessionId, "fs.createFile", { path: remote.path }) : createFile(targetPath); });
  ipcMain.handle("fs:createFolder", (_event, targetPath: string) => { const remote = remoteHostManager!.resolveUri(targetPath); return remote ? remoteHostManager!.request(remote.sessionId, "fs.createDirectory", { path: remote.path }) : createFolder(targetPath); });
  ipcMain.handle("fs:rename", (_event, oldPath: string, newPath: string) => { const oldRemote = remoteHostManager!.resolveUri(oldPath); const nextRemote = remoteHostManager!.resolveUri(newPath); return oldRemote && nextRemote ? remoteHostManager!.request(oldRemote.sessionId, "fs.rename", { oldPath: oldRemote.path, newPath: nextRemote.path }) : renamePath(oldPath, newPath); });
  ipcMain.handle("fs:delete", (_event, targetPath: string) => { const remote = remoteHostManager!.resolveUri(targetPath); return remote ? remoteHostManager!.request(remote.sessionId, "fs.delete", { path: remote.path, recursive: true }) : deletePath(targetPath); });
  ipcMain.handle("fs:reveal", (_event, targetPath: string) => revealPath(targetPath));
  ipcMain.handle("fs:exists", (_event, targetPath: string) => { const remote = remoteHostManager!.resolveUri(targetPath); return remote ? remoteHostManager!.request(remote.sessionId, "fs.exists", { path: remote.path }) : exists(targetPath); });
  ipcMain.handle("fs:workspace:createFile", async (_event, request: WorkspaceCreateFileRequest) => {
    const remote = remoteHostManager!.resolveUri(request.path); if (remote) { await remoteHostManager!.request(remote.sessionId, "fs.createFile", { path: remote.path }); if (request.initialContent) await remoteHostManager!.request(remote.sessionId, "fs.writeFile", { path: remote.path, content: request.initialContent }); return; }
    const targetPath = await resolveWorkspaceTarget(request.workspace, request.path);
    if (await exists(targetPath)) throw new Error("Já existe um item com esse nome nesta pasta.");
    try {
      await createNewFile(targetPath, request.initialContent ?? "");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("Já existe um item com esse nome nesta pasta.");
      throw error;
    }
  });
  ipcMain.handle("fs:workspace:createFolder", async (_event, request: WorkspacePathRequest) => {
    const remote = remoteHostManager!.resolveUri(request.path); if (remote) { await remoteHostManager!.request(remote.sessionId, "fs.createDirectory", { path: remote.path }); return; }
    const targetPath = await resolveWorkspaceTarget(request.workspace, request.path);
    if (await exists(targetPath)) throw new Error("Já existe um item com esse nome nesta pasta.");
    await createFolder(targetPath);
  });
  ipcMain.handle("fs:workspace:rename", async (_event, request: WorkspaceRenameRequest) => {
    const remote = remoteHostManager!.resolveUri(request.path); const nextRemote = remoteHostManager!.resolveUri(request.newPath); if (remote && nextRemote) { await remoteHostManager!.request(remote.sessionId, "fs.rename", { oldPath: remote.path, newPath: nextRemote.path }); return; }
    const sourcePath = await resolveWorkspaceTarget(request.workspace, request.path, false);
    const targetPath = await resolveWorkspaceTarget(request.workspace, request.newPath);
    if (sameResolvedPath(sourcePath, targetPath)) return;
    if (await exists(targetPath)) throw new Error("Já existe um item com esse nome nesta pasta.");
    await renamePath(sourcePath, targetPath);
  });
  ipcMain.handle("fs:workspace:delete", async (_event, request: WorkspacePathRequest) => {
    const remote = remoteHostManager!.resolveUri(request.path); if (remote) { const root = remoteHostManager!.resolveUri(request.workspace); if (root?.path === remote.path) throw new Error("A pasta raiz do workspace não pode ser excluída."); await remoteHostManager!.request(remote.sessionId, "fs.delete", { path: remote.path, recursive: true }); return; }
    const workspace = await resolveWorkspaceRoot(request.workspace);
    const targetPath = await resolveWorkspaceTarget(workspace, request.path, false);
    if (sameResolvedPath(workspace, targetPath)) throw new Error("A pasta raiz do workspace não pode ser excluída.");
    await deletePath(targetPath);
  });
  ipcMain.handle("fs:watch:start", (event, watchId: string, targetPath: string) => {
    disposeWorkspaceWatcher(watchId);
    if (remoteHostManager!.resolveUri(targetPath)) return;
    const sender = event.sender;
    if (shuttingDown || !isUsableWebContents(sender)) return;
    const dispose = watchWorkspace(
      targetPath,
      payload => {
        sendToWebContents(sender, "fs:watch:event", { watchId, ...payload });
      },
      error => {
        console.warn(`[Sharp-OSS fs] Workspace watcher issue (${targetPath})`, error);
      }
    );
    if (shuttingDown || !isUsableWebContents(sender)) {
      dispose();
      return;
    }
    const onSenderDestroyed = () => disposeWorkspaceWatcher(watchId, false);
    sender.once("destroyed", onSenderDestroyed);
    workspaceWatchers.set(watchId, { dispose, sender, onSenderDestroyed });
  });
  ipcMain.handle("fs:watch:stop", (_event, watchId: string) => {
    disposeWorkspaceWatcher(watchId);
  });

  ipcMain.handle("search:files", (_event, workspace: string) => indexWorkspaceFiles(workspace));
  ipcMain.handle("search:workspace", async (_event, query: SearchQuery) => { const remote = remoteHostManager!.resolveUri(query.workspace); if (!remote) return searchWorkspace(query); const results = await remoteHostManager!.request<SearchResult[]>(remote.sessionId, "search.workspace", { ...query, workspace: remote.path }); const prefix = query.workspace.slice(0, query.workspace.length - remote.path.length); return results.map(result => ({ ...result, filePath: `${prefix}${result.filePath}` })); });
  ipcMain.handle("search:replaceAll", (_event, request: ReplaceAllRequest) => { const remote = remoteHostManager!.resolveUri(request.workspace); return remote ? remoteHostManager!.request(remote.sessionId, "search.replaceAll", { ...request, workspace: remote.path }) : replaceAll(request); });
  ipcMain.handle("search:cancel", (_event, requestId: string) => cancelSearch(requestId));
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
  ipcMain.handle("git:diffContent", (_event, repo: string, file: GitFileStatus, staged: boolean) => gitDiffContent(repo, file, staged));
  ipcMain.handle("git:history", (_event, repo: string) => gitHistory(repo));

  ipcMain.handle("terminal:run", async (_event, request: TerminalRunRequest) => {
    const cwd = normalizeCwd(request.cwd);
    const result = await runShell(request.command, cwd, request.shell);
    return { cwd, output: result.output, code: result.code };
  });
  ipcMain.handle("terminal:shells", () => listTerminalShells());
  ipcMain.handle("terminal:create", (event, request: TerminalCreateRequest) => {
    const sender = event.sender;
    if (shuttingDown || !isUsableWebContents(sender)) {
      throw new Error("Terminal renderer is no longer available.");
    }
    const info = createTerminalSession(request, {
      onData: data => sendToWebContents(sender, "terminal:data", data),
      onExit: exit => sendToWebContents(sender, "terminal:exit", exit)
    });
    if (shuttingDown || !isUsableWebContents(sender)) {
      closeTerminal(info.id);
      throw new Error("Terminal renderer closed before the terminal could be registered.");
    }
    trackTerminalForSender(sender, info.id);
    return info;
  });
  ipcMain.handle("terminal:write", (_event, id: string, data: string) => writeTerminal(id, data));
  ipcMain.handle("terminal:resize", (_event, id: string, cols: number, rows: number) => resizeTerminal(id, cols, rows));
  ipcMain.handle("terminal:kill", (_event, id: string) => killTerminal(id));
  ipcMain.handle("terminal:close", (_event, id: string) => {
    closeTerminal(id);
    untrackTerminal(id);
  });

  ipcMain.handle("runtime:list", () => listRuntimes());
  ipcMain.handle("runtime:discover", () => discoverRuntimes(true));
  ipcMain.handle("runtime:configure", (_event, languageId: string, executablePath: string) => configureRuntime(languageId, executablePath));
  ipcMain.handle("runtime:config", () => listRuntimeConfigStates());
  ipcMain.handle("runtime:updateConfig", (_event, languageId: string, config: LanguageRuntimeConfig) => updateRuntimeConfig(languageId, config));
  ipcMain.handle("runtime:autoDetect", (_event, languageId: string) => autoDetectRuntime(languageId));
  ipcMain.handle("runtime:validate", (_event, languageId: string, executablePath?: string) => validateRuntime(languageId, executablePath));
  ipcMain.handle("runtime:runFile", (_event, request: RuntimeRunRequest) => runFile(request));
  ipcMain.handle("runtime:installDependencies", (_event, request: RuntimeDependencyInstallRequest) => installRuntimeDependencies(request));

  const remoteExtensionRequest = <T>(method: string, params: unknown): Promise<T> | undefined => { const sessionId = remoteHostManager!.activeSessionId(); return sessionId ? remoteHostManager!.request<T>(sessionId, method, params) : undefined; };
  ipcMain.handle("extensions:list", () => remoteExtensionRequest("extensions.list", {}) ?? extensionManager.listInstalled());
  ipcMain.handle("extensions:searchOpenVsx", (_event, query: string) => remoteExtensionRequest("extensions.searchOpenVsx", { query }) ?? extensionManager.searchOpenVsx(query));
  ipcMain.handle("extensions:installOpenVsx", (_event, extension: OpenVsxExtension) => remoteExtensionRequest("extensions.installOpenVsx", { extension }) ?? extensionManager.installOpenVsx(extension));
  ipcMain.handle("extensions:installVsix", (_event, vsixPath: string) => remoteExtensionRequest("extensions.installVsix", { path: vsixPath }) ?? extensionManager.installVsix(vsixPath));
  ipcMain.handle("extensions:enable", (_event, id: string) => remoteExtensionRequest("extensions.enable", { id }) ?? extensionManager.enable(id));
  ipcMain.handle("extensions:disable", (_event, id: string) => remoteExtensionRequest("extensions.disable", { id }) ?? extensionManager.disable(id));
  ipcMain.handle("extensions:uninstall", (_event, id: string) => remoteExtensionRequest("extensions.uninstall", { id }) ?? extensionManager.uninstall(id));
  ipcMain.handle("extensions:reload", (_event, id?: string) => remoteExtensionRequest("extensions.reload", { id }) ?? extensionManager.reload(id));
  ipcMain.handle("extensions:readFile", (_event, id: string, relativePath: string) => extensionManager.readContributionFile(id, relativePath));

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
  ipcMain.handle("templates:apply", (_event, request: TemplateApplyRequest) => applyTemplate(resourcesRoot(app.getAppPath(), app.isPackaged), request));

  ipcMain.handle("remote:connect", (_event, hostId: string, password?: string) => remoteHostManager!.connect(hostId, password));
  ipcMain.handle("remote:disconnect", (_event, sessionId: string) => remoteHostManager!.disconnect(sessionId));
  ipcMain.handle("remote:reconnect", (_event, sessionId: string) => remoteHostManager!.reconnect(sessionId));
  ipcMain.handle("remote:getStatus", () => remoteHostManager!.getStatus());
  ipcMain.handle("remote:listSessions", () => remoteHostManager!.listSessions());
  ipcMain.handle("remote:openFolder", (_event, sessionId: string, remotePath: string) => remoteHostManager!.openFolder(sessionId, remotePath));
  ipcMain.handle("remote:sendRpc", (_event, sessionId: string, method: string, params: unknown) => remoteHostManager!.request(sessionId, method, params));
  ipcMain.handle("remote:getLogs", () => remoteHostManager!.getLogs());
  ipcMain.handle("remote:cancel", () => remoteHostManager!.cancel());
  ipcMain.handle("remote:uninstallServer", (_event, sessionId: string) => remoteHostManager!.uninstall(sessionId));
}

function applyApplicationLocale(locale: AppLocale): void {
  applicationLocale = normalizeLocale(locale);
  createApplicationMenu();
}

async function resolveWorkspaceRoot(workspace: string): Promise<string> {
  if (typeof workspace !== "string" || !workspace.trim()) throw new Error("Workspace inválido.");
  try {
    const stat = await fs.stat(workspace);
    if (!stat.isDirectory()) throw new Error("O workspace informado não é uma pasta.");
    return await fs.realpath(workspace);
  } catch (error) {
    throw error instanceof Error ? error : new Error("Não foi possível acessar o workspace.");
  }
}

async function resolveWorkspaceTarget(workspace: string, candidate: string, allowNew = true): Promise<string> {
  if (typeof candidate !== "string" || !candidate.trim()) throw new Error("Caminho inválido.");
  const root = await resolveWorkspaceRoot(workspace);
  const target = path.resolve(candidate);
  if (!isPathInside(root, target)) throw new Error("A operação deve permanecer dentro do workspace aberto.");

  const existingPath = await nearestExistingAncestor(target);
  const resolvedExistingPath = await fs.realpath(existingPath);
  if (!isPathInside(root, resolvedExistingPath)) {
    throw new Error("A operação não pode seguir links para fora do workspace aberto.");
  }
  if (!allowNew) {
    try {
      const resolvedTarget = await fs.realpath(target);
      if (!isPathInside(root, resolvedTarget)) throw new Error("A operação não pode seguir links para fora do workspace aberto.");
      return resolvedTarget;
    } catch (error) {
      if (error instanceof Error && error.message.includes("workspace")) throw error;
      throw new Error("O item selecionado não existe mais.");
    }
  }
  return target;
}

async function nearestExistingAncestor(target: string): Promise<string> {
  let current = target;
  while (true) {
    try {
      await fs.lstat(current);
      return current;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = path.dirname(current);
      if (parent === current) throw new Error("Caminho inválido.");
      current = parent;
    }
  }
}

function isPathInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function sameResolvedPath(left: string, right: string): boolean {
  return process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right;
}

function installProcessLifecycleHandlers(): void {
  process.once("SIGTERM", () => requestApplicationShutdown("SIGTERM"));
  process.once("SIGINT", () => requestApplicationShutdown("SIGINT"));
}

function requestApplicationShutdown(_reason: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  cleanupRuntimeResources();
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.close();
  }
  if (app.isReady()) {
    app.quit();
  } else {
    app.exit(0);
  }
}

function cleanupRuntimeResources(): void {
  if (runtimeResourcesClosed) return;
  runtimeResourcesClosed = true;
  aiStreamingController?.cancelAll();
  closeRegisteredTerminals();
  closeWorkspaceWatchers();
  void remoteHostManager?.disconnectAll().catch(error => console.warn("[Sharp-OSS remote] Failed to close remote sessions.", error));
  void discordPresenceManager?.destroy().catch(error => console.warn("[Sharp-OSS Discord] Failed to close Rich Presence.", error));
  void stopAllLiveServers().catch(error => {
    console.warn("[Sharp-OSS lifecycle] Failed to stop live servers during shutdown.", error);
  });
}

function normalizeDiscordContext(value: DiscordPresenceContext): DiscordPresenceContext {
  if (!value || typeof value !== "object") return {};
  const text = (candidate: unknown) => typeof candidate === "string" ? candidate.slice(0, 2_048) : undefined;
  return { filePath: text(value.filePath), language: text(value.language), workspacePath: text(value.workspacePath), workspaceName: text(value.workspaceName), remoteHost: text(value.remoteHost), remoteStatus: text(value.remoteStatus), running: typeof value.running === "boolean" ? value.running : undefined, terminalActive: typeof value.terminalActive === "boolean" ? value.terminalActive : undefined };
}

function closeWorkspaceWatchers(): void {
  for (const watchId of [...workspaceWatchers.keys()]) {
    disposeWorkspaceWatcher(watchId);
  }
}

function disposeWorkspaceWatcher(watchId: string, removeDestroyedListener = true): void {
  const registration = workspaceWatchers.get(watchId);
  if (!registration) return;
  workspaceWatchers.delete(watchId);
  if (removeDestroyedListener && isUsableWebContents(registration.sender)) {
    registration.sender.removeListener("destroyed", registration.onSenderDestroyed);
  }
  try {
    registration.dispose();
  } catch (error) {
    console.warn(`[Sharp-OSS fs] Failed to dispose workspace watcher ${watchId}.`, error);
  }
}

function closeWorkspaceWatchersForSender(sender: WebContents, removeDestroyedListener = true): void {
  for (const [watchId, registration] of [...workspaceWatchers.entries()]) {
    if (registration.sender === sender) {
      disposeWorkspaceWatcher(watchId, removeDestroyedListener);
    }
  }
}

function trackTerminalForSender(sender: WebContents, id: string): void {
  let registration = terminalRegistrations.get(sender);
  if (!registration) {
    const onSenderDestroyed = () => closeTerminalsForSender(sender, false);
    registration = { ids: new Set(), onSenderDestroyed };
    terminalRegistrations.set(sender, registration);
    sender.once("destroyed", onSenderDestroyed);
  }
  registration.ids.add(id);
}

function untrackTerminal(id: string): void {
  for (const [sender, registration] of [...terminalRegistrations.entries()]) {
    if (!registration.ids.delete(id)) continue;
    if (registration.ids.size === 0) {
      terminalRegistrations.delete(sender);
      if (isUsableWebContents(sender)) {
        sender.removeListener("destroyed", registration.onSenderDestroyed);
      }
    }
    return;
  }
}

function closeTerminalsForSender(sender: WebContents, removeDestroyedListener = true): void {
  const registration = terminalRegistrations.get(sender);
  if (!registration) return;
  terminalRegistrations.delete(sender);
  if (removeDestroyedListener && isUsableWebContents(sender)) {
    sender.removeListener("destroyed", registration.onSenderDestroyed);
  }
  for (const id of registration.ids) {
    closeTerminal(id);
  }
}

function closeRegisteredTerminals(): void {
  for (const [sender, registration] of terminalRegistrations.entries()) {
    if (isUsableWebContents(sender)) {
      sender.removeListener("destroyed", registration.onSenderDestroyed);
    }
  }
  terminalRegistrations.clear();
  closeAllTerminals();
}

function currentMainWindow(): BrowserWindow | undefined {
  if (shuttingDown) return undefined;
  const focused = BrowserWindow.getFocusedWindow();
  if (isUsableWindow(focused ?? undefined)) return focused ?? undefined;
  if (isUsableWindow(mainWindow)) return mainWindow;
  return BrowserWindow.getAllWindows().find(isUsableWindow);
}

function isUsableWindow(window: BrowserWindow | undefined): window is BrowserWindow {
  return Boolean(window && !window.isDestroyed());
}

function isUsableWebContents(contents: WebContents | undefined): contents is WebContents {
  return Boolean(contents && !contents.isDestroyed());
}

function sendToWebContents(contents: WebContents, channel: string, payload: unknown): void {
  if (!shuttingDown && isUsableWebContents(contents)) contents.send(channel, payload);
}

async function showOpenDialog(options: OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> {
  if (shuttingDown) return { canceled: true, filePaths: [] };
  const window = currentMainWindow();
  if (!window) return dialog.showOpenDialog(options);
  try {
    return await dialog.showOpenDialog(window, options);
  } catch (error) {
    if (shuttingDown || window.isDestroyed()) return { canceled: true, filePaths: [] };
    throw error;
  }
}

async function showSaveDialog(options: SaveDialogOptions): Promise<Electron.SaveDialogReturnValue> {
  if (shuttingDown) return { canceled: true, filePath: "" };
  const window = currentMainWindow();
  if (!window) return dialog.showSaveDialog(options);
  try {
    return await dialog.showSaveDialog(window, options);
  } catch (error) {
    if (shuttingDown || window.isDestroyed()) return { canceled: true, filePath: "" };
    throw error;
  }
}

function normalizeDialogPaths(paths: string[]): string[] {
  return paths.map(normalizeDialogPath);
}

function normalizeDialogPath(targetPath: string): string {
  return path.resolve(path.normalize(targetPath));
}
