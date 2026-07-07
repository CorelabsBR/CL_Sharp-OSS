"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
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
        exists: (targetPath) => invoke("fs:exists", targetPath)
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
        run: (request) => invoke("terminal:run", request)
    },
    runtime: {
        list: () => invoke("runtime:list"),
        discover: () => invoke("runtime:discover"),
        configure: (languageId, executablePath) => invoke("runtime:configure", languageId, executablePath),
        runFile: (request) => invoke("runtime:runFile", request)
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
electron_1.contextBridge.exposeInMainWorld("npsharpEvents", {
    onCommand(callback) {
        const listener = (_event, command) => callback(command);
        electron_1.ipcRenderer.on("command", listener);
        return () => electron_1.ipcRenderer.removeListener("command", listener);
    }
});
//# sourceMappingURL=preload.js.map