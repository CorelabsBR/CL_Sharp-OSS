"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_crypto_1 = require("node:crypto");
async function invoke(channel, ...args) {
    try {
        return await electron_1.ipcRenderer.invoke(channel, ...args);
    }
    catch (error) {
        console.error(`[NPSharp IPC] ${channel} failed`, error);
        throw error;
    }
}
const api = {
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
        saveFile: (request) => invoke("dialog:saveFile", request),
        chooseWallpaper: () => invoke("dialog:chooseWallpaper")
    },
    settings: {
        load: () => invoke("settings:load"),
        save: (settings) => invoke("settings:save", settings),
        reset: () => invoke("settings:reset"),
        loadSession: () => invoke("settings:loadSession"),
        saveSession: (session) => invoke("settings:saveSession", session)
    },
    fs: {
        listDir: (targetPath) => invoke("fs:listDir", targetPath),
        readFile: (targetPath) => invoke("fs:readFile", targetPath),
        writeFile: (targetPath, content) => invoke("fs:writeFile", targetPath, content),
        createFile: (targetPath) => invoke("fs:createFile", targetPath),
        createFolder: (targetPath) => invoke("fs:createFolder", targetPath),
        rename: (oldPath, newPath) => invoke("fs:rename", oldPath, newPath),
        delete: (targetPath) => invoke("fs:delete", targetPath),
        reveal: (targetPath) => invoke("fs:reveal", targetPath),
        exists: (targetPath) => invoke("fs:exists", targetPath),
        watch: (targetPath, callback) => {
            const watchId = (0, node_crypto_1.randomUUID)();
            const listener = (_event, payload) => {
                if (payload.watchId === watchId)
                    callback(payload);
            };
            electron_1.ipcRenderer.on("fs:watch:event", listener);
            void invoke("fs:watch:start", watchId, targetPath).catch(error => {
                console.error(`[NPSharp IPC] fs:watch:start failed (${targetPath})`, error);
            });
            return () => {
                electron_1.ipcRenderer.removeListener("fs:watch:event", listener);
                void invoke("fs:watch:stop", watchId).catch(error => {
                    console.error(`[NPSharp IPC] fs:watch:stop failed (${targetPath})`, error);
                });
            };
        }
    },
    search: {
        workspace: (query) => invoke("search:workspace", query),
        replaceAll: (request) => invoke("search:replaceAll", request)
    },
    diagnostics: {
        java: (workspace, filePath) => invoke("diagnostics:java", workspace, filePath)
    },
    git: {
        status: (workspace) => invoke("git:status", workspace),
        run: (repo, args) => invoke("git:run", repo, args),
        stage: (repo, file) => invoke("git:stage", repo, file),
        unstage: (repo, file) => invoke("git:unstage", repo, file),
        discard: (repo, file) => invoke("git:discard", repo, file),
        commit: (repo, message, allowEmpty) => invoke("git:commit", repo, message, allowEmpty),
        checkout: (repo, branch) => invoke("git:checkout", repo, branch),
        createBranch: (repo, branch) => invoke("git:createBranch", repo, branch),
        diff: (repo, file, staged) => invoke("git:diff", repo, file, staged),
        history: (repo) => invoke("git:history", repo)
    },
    terminal: {
        run: (request) => invoke("terminal:run", request),
        shells: () => invoke("terminal:shells"),
        create: (request) => invoke("terminal:create", request),
        write: (id, data) => invoke("terminal:write", id, data),
        resize: (id, cols, rows) => invoke("terminal:resize", id, cols, rows),
        kill: (id) => invoke("terminal:kill", id),
        close: (id) => invoke("terminal:close", id),
        onData: (callback) => {
            const listener = (_event, payload) => callback(payload);
            electron_1.ipcRenderer.on("terminal:data", listener);
            return () => electron_1.ipcRenderer.removeListener("terminal:data", listener);
        },
        onExit: (callback) => {
            const listener = (_event, payload) => callback(payload);
            electron_1.ipcRenderer.on("terminal:exit", listener);
            return () => electron_1.ipcRenderer.removeListener("terminal:exit", listener);
        }
    },
    runtime: {
        list: () => invoke("runtime:list"),
        discover: () => invoke("runtime:discover"),
        configure: (languageId, executablePath) => invoke("runtime:configure", languageId, executablePath),
        runFile: (request) => invoke("runtime:runFile", request)
    },
    arduino: {
        detect: (request) => invoke("arduino:detect", request),
        loadConfig: (request) => invoke("arduino:loadConfig", request),
        saveConfig: (request) => invoke("arduino:saveConfig", request),
        listPorts: (request) => invoke("arduino:listPorts", request),
        listBoards: (request) => invoke("arduino:listBoards", request),
        createSketch: (request) => invoke("arduino:createSketch", request),
        compile: (request) => invoke("arduino:compile", request),
        upload: (request) => invoke("arduino:upload", request),
        monitor: (request) => invoke("arduino:monitor", request)
    },
    liveServer: {
        open: (request) => invoke("liveServer:open", request),
        stopAll: () => invoke("liveServer:stopAll")
    },
    templates: {
        apply: (request) => invoke("templates:apply", request)
    },
    remote: {
        loadHosts: () => invoke("remote:loadHosts"),
        saveHosts: (hosts) => invoke("remote:saveHosts", hosts),
        test: (request) => invoke("remote:test", request),
        list: (request) => invoke("remote:list", request),
        readFile: (request) => invoke("remote:readFile", request),
        writeFile: (request) => invoke("remote:writeFile", request),
        mkdir: (request) => invoke("remote:mkdir", request),
        touch: (request) => invoke("remote:touch", request),
        rename: (request) => invoke("remote:rename", request),
        delete: (request) => invoke("remote:delete", request),
        execute: (request) => invoke("remote:execute", request)
    }
};
electron_1.contextBridge.exposeInMainWorld("npsharp", api);
electron_1.contextBridge.exposeInMainWorld("npsharpApi", api);
electron_1.contextBridge.exposeInMainWorld("npsharpEvents", {
    onCommand(callback) {
        const listener = (_event, command) => callback(command);
        electron_1.ipcRenderer.on("command", listener);
        return () => electron_1.ipcRenderer.removeListener("command", listener);
    }
});
//# sourceMappingURL=preload.js.map