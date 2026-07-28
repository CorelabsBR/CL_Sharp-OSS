import fs from "node:fs/promises";
import path from "node:path";
import type { AppSettings, PersistedSession } from "../../shared/types";
import { DEFAULT_LOCALE, normalizeLocale } from "../../shared/i18n";
import { npsharpHome, recentFilesPath, settingsPath } from "./paths";

export const DEFAULT_SETTINGS: AppSettings = {
  language: DEFAULT_LOCALE,
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
  restoreWorkspaceOnStartup: true,
  confirmDelete: true,
  binaryFileTypesIgnored: [],
  keyboardShortcuts: []
};

export async function loadSettings(): Promise<AppSettings> {
  const file = settingsPath();
  await fs.mkdir(path.dirname(file), { recursive: true });

  try {
    const raw = await fs.readFile(file, "utf8");
    if (!raw.trim()) {
      return { ...DEFAULT_SETTINGS };
    }
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed, language: normalizeLocale(parsed.language) } as AppSettings;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(`[NPSharp settings] Failed to load settings from ${file}; defaults will be used.`, error);
    }
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  const merged = { ...DEFAULT_SETTINGS, ...settings, language: normalizeLocale(settings.language) };
  await fs.mkdir(npsharpHome(), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify(merged, null, 2) + "\n", "utf8");
  return merged;
}

export async function resetSettings(): Promise<AppSettings> {
  return saveSettings({ ...DEFAULT_SETTINGS });
}
// sabemos que me motivou. presente no commit f0655d6.

export async function loadSession(): Promise<PersistedSession> {
  try {
    const raw = await fs.readFile(recentFilesPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<PersistedSession> & { recentFiles?: string[]; lastOpenedWorkspace?: string };
    return {
      workspace: parsed.workspace ?? parsed.lastOpenedWorkspace,
      recentWorkspaces: normalizeRecentWorkspaces(parsed.recentWorkspaces, parsed.workspace ?? parsed.lastOpenedWorkspace),
      openFiles: parsed.openFiles ?? parsed.recentFiles ?? [],
      activeFile: parsed.activeFile,
      sidePanel: parsed.sidePanel ?? "explorer",
      terminalVisible: parsed.terminalVisible ?? false
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(`[NPSharp settings] Failed to load session from ${recentFilesPath()}; empty session will be used.`, error);
    }
    return { openFiles: [], sidePanel: "explorer", terminalVisible: false };
  }
}

export async function saveSession(session: PersistedSession): Promise<void> {
  await fs.mkdir(npsharpHome(), { recursive: true });
  await fs.writeFile(
    recentFilesPath(),
    JSON.stringify({
      ...session,
      recentWorkspaces: normalizeRecentWorkspaces(session.recentWorkspaces, session.workspace),
      recentFiles: session.openFiles,
      lastOpenedWorkspace: session.workspace
    }, null, 2) + "\n",
    "utf8"
  );
}

function normalizeRecentWorkspaces(recentWorkspaces?: string[], currentWorkspace?: string): string[] {
  const values = [currentWorkspace, ...(recentWorkspaces ?? [])]
    .filter((value): value is string => Boolean(value?.trim()));
  return [...new Set(values)].slice(0, 12);
}
