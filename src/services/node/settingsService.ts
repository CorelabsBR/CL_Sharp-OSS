import fs from "node:fs/promises";
import path from "node:path";
import type { AppSettings, PersistedSession } from "../../shared/types";
import { npsharpHome, recentFilesPath, settingsPath } from "./paths";

export const DEFAULT_SETTINGS: AppSettings = {
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

export async function loadSettings(): Promise<AppSettings> {
  const file = settingsPath();
  await fs.mkdir(path.dirname(file), { recursive: true });

  try {
    const raw = await fs.readFile(file, "utf8");
    if (!raw.trim()) {
      await saveSettings(DEFAULT_SETTINGS);
      return { ...DEFAULT_SETTINGS };
    }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as AppSettings;
  } catch {
    await saveSettings(DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  const merged = { ...DEFAULT_SETTINGS, ...settings };
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
      openFiles: parsed.openFiles ?? parsed.recentFiles ?? [],
      activeFile: parsed.activeFile,
      sidePanel: parsed.sidePanel ?? "explorer",
      terminalVisible: parsed.terminalVisible ?? true
    };
  } catch {
    return { openFiles: [], sidePanel: "explorer", terminalVisible: true };
  }
}

export async function saveSession(session: PersistedSession): Promise<void> {
  await fs.mkdir(npsharpHome(), { recursive: true });
  await fs.writeFile(
    recentFilesPath(),
    JSON.stringify({
      ...session,
      recentFiles: session.openFiles,
      lastOpenedWorkspace: session.workspace
    }, null, 2) + "\n",
    "utf8"
  );
}
