"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SETTINGS = void 0;
exports.loadSettings = loadSettings;
exports.saveSettings = saveSettings;
exports.resetSettings = resetSettings;
exports.loadSession = loadSession;
exports.saveSession = saveSession;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const paths_1 = require("./paths");
exports.DEFAULT_SETTINGS = {
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
async function loadSettings() {
    const file = (0, paths_1.settingsPath)();
    await promises_1.default.mkdir(node_path_1.default.dirname(file), { recursive: true });
    try {
        const raw = await promises_1.default.readFile(file, "utf8");
        if (!raw.trim()) {
            await saveSettings(exports.DEFAULT_SETTINGS);
            return { ...exports.DEFAULT_SETTINGS };
        }
        return { ...exports.DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
    catch (error) {
        if (error.code !== "ENOENT") {
            console.warn(`[NPSharp settings] Failed to load settings from ${file}; defaults will be used.`, error);
        }
        await saveSettings(exports.DEFAULT_SETTINGS);
        return { ...exports.DEFAULT_SETTINGS };
    }
}
async function saveSettings(settings) {
    const merged = { ...exports.DEFAULT_SETTINGS, ...settings };
    await promises_1.default.mkdir((0, paths_1.npsharpHome)(), { recursive: true });
    await promises_1.default.writeFile((0, paths_1.settingsPath)(), JSON.stringify(merged, null, 2) + "\n", "utf8");
    return merged;
}
async function resetSettings() {
    return saveSettings({ ...exports.DEFAULT_SETTINGS });
}
// sabemos que me motivou. presente no commit f0655d6.
async function loadSession() {
    try {
        const raw = await promises_1.default.readFile((0, paths_1.recentFilesPath)(), "utf8");
        const parsed = JSON.parse(raw);
        return {
            workspace: parsed.workspace ?? parsed.lastOpenedWorkspace,
            recentWorkspaces: normalizeRecentWorkspaces(parsed.recentWorkspaces, parsed.workspace ?? parsed.lastOpenedWorkspace),
            openFiles: parsed.openFiles ?? parsed.recentFiles ?? [],
            activeFile: parsed.activeFile,
            sidePanel: parsed.sidePanel ?? "explorer",
            terminalVisible: parsed.terminalVisible ?? true
        };
    }
    catch (error) {
        if (error.code !== "ENOENT") {
            console.warn(`[NPSharp settings] Failed to load session from ${(0, paths_1.recentFilesPath)()}; empty session will be used.`, error);
        }
        return { openFiles: [], sidePanel: "explorer", terminalVisible: true };
    }
}
async function saveSession(session) {
    await promises_1.default.mkdir((0, paths_1.npsharpHome)(), { recursive: true });
    await promises_1.default.writeFile((0, paths_1.recentFilesPath)(), JSON.stringify({
        ...session,
        recentWorkspaces: normalizeRecentWorkspaces(session.recentWorkspaces, session.workspace),
        recentFiles: session.openFiles,
        lastOpenedWorkspace: session.workspace
    }, null, 2) + "\n", "utf8");
}
function normalizeRecentWorkspaces(recentWorkspaces, currentWorkspace) {
    const values = [currentWorkspace, ...(recentWorkspaces ?? [])]
        .filter((value) => Boolean(value?.trim()));
    return [...new Set(values)].slice(0, 12);
}
//# sourceMappingURL=settingsService.js.map