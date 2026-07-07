"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const fileSystemService_1 = require("../services/node/fileSystemService");
const gitService_1 = require("../services/node/gitService");
const liveServerService_1 = require("../services/node/liveServerService");
const paths_1 = require("../services/node/paths");
const processService_1 = require("../services/node/processService");
const runtimeService_1 = require("../services/node/runtimeService");
const searchService_1 = require("../services/node/searchService");
const settingsService_1 = require("../services/node/settingsService");
const templateService_1 = require("../services/node/templateService");
const diagnosticsService_1 = require("../services/node/diagnosticsService");
const remoteService_1 = require("../services/node/remoteService");
let mainWindow;
const gotLock = process.env.VITE_DEV_SERVER_URL ? true : electron_1.app.requestSingleInstanceLock();
if (!gotLock) {
    electron_1.app.quit();
}
if (!process.env.VITE_DEV_SERVER_URL) {
    electron_1.app.on("second-instance", () => {
        if (!mainWindow)
            return;
        if (mainWindow.isMinimized())
            mainWindow.restore();
        mainWindow.focus();
    });
}
electron_1.app.whenReady().then(async () => {
    registerIpcHandlers();
    createApplicationMenu();
    await createMainWindow();
    electron_1.app.on("activate", async () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            await createMainWindow();
        }
    });
}).catch(error => {
    electron_1.dialog.showErrorBox("NPSharp failed to start", error instanceof Error ? error.message : String(error));
    electron_1.app.quit();
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
electron_1.app.on("before-quit", () => {
    void (0, liveServerService_1.stopAllLiveServers)();
});
async function createMainWindow() {
    const iconPath = node_path_1.default.join(electron_1.app.getAppPath(), "build", "icon.png");
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 760,
        minWidth: 800,
        minHeight: 520,
        frame: false,
        title: "NPSharp",
        icon: iconPath,
        show: false,
        webPreferences: {
            preload: node_path_1.default.join(__dirname, "..", "preload", "preload.js"),
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
    }
    else {
        await mainWindow.loadFile(node_path_1.default.join(electron_1.app.getAppPath(), "dist", "index.html"));
    }
}
async function loadDevServer(window, url) {
    let lastError;
    for (let attempt = 0; attempt < 40; attempt++) {
        try {
            await window.loadURL(url);
            return;
        }
        catch (error) {
            lastError = error;
            await new Promise(resolve => setTimeout(resolve, 250));
        }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
function createApplicationMenu() {
    const template = [
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
                { type: "separator" },
                { label: "Comment Line", accelerator: "CmdOrCtrl+/", click: () => sendCommand("editor:commentLine") },
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
                { label: "Terminal", accelerator: "CmdOrCtrl+`", click: () => sendCommand("view:terminal") },
                { label: "Problems", accelerator: "F8", click: () => sendCommand("view:problems") },
                { label: "Debug Console", click: () => sendCommand("view:debugConsole") },
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
                { label: "Run", accelerator: "CmdOrCtrl+Alt+N", click: () => sendCommand("tools:run") },
                { label: "Debug Program", accelerator: "F5", click: () => sendCommand("tools:run") },
                { type: "separator" },
                { label: "New Terminal", accelerator: "CmdOrCtrl+Shift+`", click: () => sendCommand("terminal:new") },
                { label: "Output", click: () => sendCommand("terminal:output") },
                { label: "Problems", click: () => sendCommand("terminal:problems") },
                { label: "Debug Console", click: () => sendCommand("terminal:debug") },
                { label: "Ports", click: () => sendCommand("terminal:ports") },
                { label: "Git", click: () => sendCommand("terminal:git") },
                { label: "Clear Terminal", click: () => sendCommand("terminal:clear") },
                { type: "separator" },
                { label: "Git Pull", click: () => sendCommand("git:pull") },
                { label: "Git Push", click: () => sendCommand("git:push") },
                { label: "Git Fetch", click: () => sendCommand("git:fetch") }
            ]
        },
        {
            label: "Preferences",
            submenu: [
                { label: "Command Palette", accelerator: "CmdOrCtrl+Shift+P", click: () => sendCommand("view:commandPalette") },
                { label: "Settings", accelerator: "CmdOrCtrl+,", click: () => sendCommand("view:settings") },
                { label: "Color Theme", click: () => sendCommand("preferences:theme") },
                { label: "Wallpaper...", click: () => sendCommand("preferences:wallpaper") },
                { label: "Clear Wallpaper", click: () => sendCommand("preferences:clearWallpaper") },
                { type: "separator" },
                { label: "Toggle ErrorLens", click: () => sendCommand("preferences:errorLensToggle") },
                { type: "separator" },
                { label: "About NPSharp", click: () => sendCommand("help:about") }
            ]
        }
    ];
    electron_1.Menu.setApplicationMenu(electron_1.Menu.buildFromTemplate(template));
}
function sendCommand(command) {
    mainWindow?.webContents.send("command", command);
}
function registerIpcHandlers() {
    electron_1.ipcMain.handle("app:info", () => ({
        name: electron_1.app.getName(),
        version: electron_1.app.getVersion(),
        platform: process.platform,
        userDataPath: electron_1.app.getPath("userData"),
        appPath: electron_1.app.getAppPath(),
        npsharpHome: (0, paths_1.npsharpHome)()
    }));
    electron_1.ipcMain.handle("window:minimize", () => mainWindow?.minimize());
    electron_1.ipcMain.handle("window:maximize", () => {
        if (!mainWindow)
            return;
        if (mainWindow.isMaximized())
            mainWindow.unmaximize();
        else
            mainWindow.maximize();
    });
    electron_1.ipcMain.handle("window:close", () => mainWindow?.close());
    electron_1.ipcMain.handle("window:isMaximized", () => mainWindow?.isMaximized() ?? false);
    electron_1.ipcMain.handle("dialog:openFile", async () => {
        const result = await electron_1.dialog.showOpenDialog(mainWindow, { properties: ["openFile"] });
        return { canceled: result.canceled, paths: result.filePaths };
    });
    electron_1.ipcMain.handle("dialog:openFolder", async () => {
        const result = await electron_1.dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"] });
        return { canceled: result.canceled, paths: result.filePaths };
    });
    electron_1.ipcMain.handle("dialog:chooseWallpaper", async () => {
        const result = await electron_1.dialog.showOpenDialog(mainWindow, {
            properties: ["openFile"],
            filters: [
                { name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] },
                { name: "All Files", extensions: ["*"] }
            ]
        });
        return { canceled: result.canceled, paths: result.filePaths };
    });
    electron_1.ipcMain.handle("dialog:saveFile", async (_event, request) => {
        let targetPath = request.path;
        if (!targetPath) {
            const result = await electron_1.dialog.showSaveDialog(mainWindow, { defaultPath: request.suggestedName || "untitled.txt" });
            if (result.canceled || !result.filePath)
                return { canceled: true };
            targetPath = result.filePath;
        }
        await (0, fileSystemService_1.writeFile)(targetPath, request.content);
        return { canceled: false, path: targetPath };
    });
    electron_1.ipcMain.handle("settings:load", () => (0, settingsService_1.loadSettings)());
    electron_1.ipcMain.handle("settings:save", (_event, settings) => (0, settingsService_1.saveSettings)(settings));
    electron_1.ipcMain.handle("settings:reset", () => (0, settingsService_1.resetSettings)());
    electron_1.ipcMain.handle("settings:loadSession", () => (0, settingsService_1.loadSession)());
    electron_1.ipcMain.handle("settings:saveSession", (_event, session) => (0, settingsService_1.saveSession)(session));
    electron_1.ipcMain.handle("fs:listDir", (_event, targetPath) => (0, fileSystemService_1.listDir)(targetPath));
    electron_1.ipcMain.handle("fs:readFile", (_event, targetPath) => (0, fileSystemService_1.readFile)(targetPath));
    electron_1.ipcMain.handle("fs:writeFile", (_event, targetPath, content) => (0, fileSystemService_1.writeFile)(targetPath, content));
    electron_1.ipcMain.handle("fs:createFile", (_event, targetPath) => (0, fileSystemService_1.createFile)(targetPath));
    electron_1.ipcMain.handle("fs:createFolder", (_event, targetPath) => (0, fileSystemService_1.createFolder)(targetPath));
    electron_1.ipcMain.handle("fs:rename", (_event, oldPath, newPath) => (0, fileSystemService_1.renamePath)(oldPath, newPath));
    electron_1.ipcMain.handle("fs:delete", (_event, targetPath) => (0, fileSystemService_1.deletePath)(targetPath));
    electron_1.ipcMain.handle("fs:reveal", (_event, targetPath) => (0, fileSystemService_1.revealPath)(targetPath));
    electron_1.ipcMain.handle("fs:exists", (_event, targetPath) => (0, fileSystemService_1.exists)(targetPath));
    electron_1.ipcMain.handle("search:workspace", (_event, query) => (0, searchService_1.searchWorkspace)(query));
    electron_1.ipcMain.handle("search:replaceAll", (_event, request) => (0, searchService_1.replaceAll)(request));
    electron_1.ipcMain.handle("diagnostics:java", (_event, workspace, filePath) => (0, diagnosticsService_1.runJavaDiagnostics)(workspace, filePath));
    electron_1.ipcMain.handle("git:status", (_event, workspace) => (0, gitService_1.readGitStatus)(workspace));
    electron_1.ipcMain.handle("git:run", (_event, repo, args) => (0, gitService_1.runGit)(repo, args));
    electron_1.ipcMain.handle("git:stage", (_event, repo, file) => (0, gitService_1.stage)(repo, file));
    electron_1.ipcMain.handle("git:unstage", (_event, repo, file) => (0, gitService_1.unstage)(repo, file));
    electron_1.ipcMain.handle("git:discard", (_event, repo, file) => (0, gitService_1.discard)(repo, file));
    electron_1.ipcMain.handle("git:commit", (_event, repo, message, allowEmpty) => (0, gitService_1.commit)(repo, message, allowEmpty));
    electron_1.ipcMain.handle("git:checkout", (_event, repo, branch) => (0, gitService_1.checkout)(repo, branch));
    electron_1.ipcMain.handle("git:createBranch", (_event, repo, branch) => (0, gitService_1.createBranch)(repo, branch));
    electron_1.ipcMain.handle("git:diff", (_event, repo, file, staged) => (0, gitService_1.gitDiff)(repo, file, staged));
    electron_1.ipcMain.handle("git:history", (_event, repo) => (0, gitService_1.gitHistory)(repo));
    electron_1.ipcMain.handle("terminal:run", async (_event, request) => {
        const cwd = (0, processService_1.normalizeCwd)(request.cwd);
        const result = await (0, processService_1.runShell)(request.command, cwd, request.shell);
        return { cwd, output: result.output, code: result.code };
    });
    electron_1.ipcMain.handle("runtime:list", () => (0, runtimeService_1.listRuntimes)());
    electron_1.ipcMain.handle("runtime:discover", () => (0, runtimeService_1.discoverRuntimes)(true));
    electron_1.ipcMain.handle("runtime:configure", (_event, languageId, executablePath) => (0, runtimeService_1.configureRuntime)(languageId, executablePath));
    electron_1.ipcMain.handle("runtime:runFile", (_event, request) => (0, runtimeService_1.runFile)(request));
    electron_1.ipcMain.handle("liveServer:open", (_event, request) => (0, liveServerService_1.openLiveServer)(request));
    electron_1.ipcMain.handle("liveServer:stopAll", () => (0, liveServerService_1.stopAllLiveServers)());
    electron_1.ipcMain.handle("templates:apply", (_event, request) => (0, templateService_1.applyTemplate)(electron_1.app.getAppPath(), request));
    electron_1.ipcMain.handle("remote:loadHosts", () => (0, remoteService_1.loadHosts)());
    electron_1.ipcMain.handle("remote:saveHosts", (_event, hosts) => (0, remoteService_1.saveHosts)(hosts));
    electron_1.ipcMain.handle("remote:test", (_event, request) => (0, remoteService_1.testRemote)(request));
    electron_1.ipcMain.handle("remote:list", (_event, request) => (0, remoteService_1.listRemote)(request));
    electron_1.ipcMain.handle("remote:readFile", (_event, request) => (0, remoteService_1.readRemoteFile)(request));
    electron_1.ipcMain.handle("remote:writeFile", (_event, request) => (0, remoteService_1.writeRemoteFile)(request));
    electron_1.ipcMain.handle("remote:mkdir", (_event, request) => (0, remoteService_1.mkdirRemote)(request));
    electron_1.ipcMain.handle("remote:touch", (_event, request) => (0, remoteService_1.touchRemote)(request));
    electron_1.ipcMain.handle("remote:rename", (_event, request) => (0, remoteService_1.renameRemote)(request));
    electron_1.ipcMain.handle("remote:delete", (_event, request) => (0, remoteService_1.deleteRemote)(request));
    electron_1.ipcMain.handle("remote:execute", (_event, request) => (0, remoteService_1.executeRemote)(request));
}
//# sourceMappingURL=main.js.map