/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import fs from "node:fs/promises";
import path from "node:path";
import type { AppSettings, PersistedSession } from "../../shared/types";
import { DEFAULT_LOCALE, normalizeLocale } from "../../shared/i18n";
import { sharpHome, recentFilesPath, settingsPath } from "./paths";

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
  terminalShellLinux: "",
  terminalShellWindows: "",
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
  keyboardShortcuts: [],
  discordRichPresence: {
    enabled: true, applicationId: "", showFileName: true, showProjectName: true, showLanguage: true,
    showRemoteHost: true, showElapsedTime: true, showWorkspaceType: true, largeImageKey: "sharp",
    largeImageText: "Sharp-OSS", localSmallImageKey: "local", remoteSmallImageKey: "remote",
    localSmallImageText: "Workspace local", remoteSmallImageText: "Remote Host", buttons: []
  }
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
    return mergeSettings(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(`[Sharp-OSS settings] Failed to load settings from ${file}; defaults will be used.`, error);
    }
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  const merged = mergeSettings(settings);
  await fs.mkdir(sharpHome(), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify(merged, null, 2) + "\n", "utf8");
  return merged;
}

export async function resetSettings(): Promise<AppSettings> {
  return saveSettings({ ...DEFAULT_SETTINGS });
}

function mergeSettings(settings: Partial<AppSettings>): AppSettings {
  return { ...DEFAULT_SETTINGS, ...settings, language: normalizeLocale(settings.language), discordRichPresence: { ...DEFAULT_SETTINGS.discordRichPresence, ...settings.discordRichPresence } };
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
      console.warn(`[Sharp-OSS settings] Failed to load session from ${recentFilesPath()}; empty session will be used.`, error);
    }
    return { openFiles: [], sidePanel: "explorer", terminalVisible: false };
  }
}

export async function saveSession(session: PersistedSession): Promise<void> {
  await fs.mkdir(sharpHome(), { recursive: true });
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
