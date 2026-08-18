/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { monaco } from "../../editor/monacoSetup";
import type { AppSettings } from "../../shared/types";
import { cssUrl, DEFAULT_LOGO_URL, resourceUrl } from "../utils/assets";

type ThemeColors = Record<string, string>;

interface ThemeManifestEntry {
  id?: string;
  label: string;
  path: string;
  uiTheme?: string;
  welcomeLogo?: string;
  categories?: string[];
  preview?: string;
}

interface ThemePackage {
  contributes?: {
    themes?: ThemeManifestEntry[];
    specialThemes?: ThemeManifestEntry[];
  };
}

interface TokenColor {
  scope?: string | string[];
  settings?: {
    foreground?: string;
    background?: string;
    fontStyle?: string;
  };
}

interface VSCodeThemeFile {
  name?: string;
  type?: "dark" | "light" | string;
  colors?: ThemeColors;
  tokenColors?: TokenColor[];
}

const BUNDLED_THEME_ASSETS = import.meta.glob("../../../resources/themes/*.json", {
  eager: true,
  query: "?raw",
  import: "default"
}) as Record<string, string>;

const themeFileCache = new Map<string, Promise<VSCodeThemeFile | undefined>>();
const extensionThemes = new Map<string, ThemeSummary>();

export interface ThemeSummary {
  id: string;
  name: string;
  path?: string;
  uiTheme?: string;
  welcomeLogo?: string;
  special?: boolean;
  colors: ThemeColors;
  tokenColors?: TokenColor[];
}

const DEFAULT_WELCOME_LOGO = DEFAULT_LOGO_URL;

const BUILT_IN_FALLBACKS: ThemeSummary[] = [
  {
    id: "np-dark",
    name: "NPSharp Dark",
    uiTheme: "vs-dark",
    colors: {
      "--bg": "#1e1e1e",
      "--bg-2": "#252526",
      "--bg-3": "#2d2d30",
      "--fg": "#d4d4d4",
      "--muted": "#8a8f98",
      "--border": "#3c3c3c",
      "--accent": "#007acc",
      "--status": "#007acc",
      "--danger": "#f14c4c",
      "--warning": "#cca700",
      "--active-fg": "#ffffff",
      "--status-fg": "#ffffff",
      "--input-bg": "#1e1e1e",
      "--button-bg": "#0e639c",
      "--button-fg": "#ffffff",
      "--selection-bg": "#264f78",
      "--hover-bg": "#2a2d2e",
      "--shadow": "#00000052",
      "--overlay-bg": "#00000038"
    }
  },
  {
    id: "np-light",
    name: "NPSharp Light",
    uiTheme: "vs",
    colors: {
      "--bg": "#f7f7f7",
      "--bg-2": "#ffffff",
      "--bg-3": "#e8e8e8",
      "--fg": "#1f2328",
      "--muted": "#5f6b7a",
      "--border": "#d0d7de",
      "--accent": "#0969da",
      "--status": "#0969da",
      "--danger": "#d1242f",
      "--warning": "#9a6700",
      "--active-fg": "#ffffff",
      "--status-fg": "#ffffff",
      "--input-bg": "#ffffff",
      "--button-bg": "#0969da",
      "--button-fg": "#ffffff",
      "--selection-bg": "#b6d7ff",
      "--hover-bg": "#eaeef2",
      "--shadow": "#1f232833",
      "--overlay-bg": "#1f23282e"
    }
  }
];

export async function listThemes(): Promise<ThemeSummary[]> {
  const bundledManifest = bundledThemeAsset("package.json");
  if (bundledManifest) return [...await themesFromManifest(bundledManifest, "bundle"), ...extensionThemes.values()];

  const manifestUrl = resourceUrl("themes/package.json");
  const response = await fetch(manifestUrl).catch(error => {
    console.warn(`[NPSharp assets] Failed to load theme manifest: ${manifestUrl}`, error);
    return undefined;
  });
  if (!response?.ok) {
    if (response) console.warn(`[NPSharp assets] Theme manifest returned ${response.status}: ${manifestUrl}`);
    return [...BUILT_IN_FALLBACKS, ...extensionThemes.values()];
  }

  return [...await themesFromManifest(await response.text(), manifestUrl), ...extensionThemes.values()];
}

export function registerExtensionTheme(id: string, name: string, source: string, uiTheme = "vs-dark"): () => void {
  const parsed = parseThemeFile(source, id);
  if (!parsed) throw new Error(`Tema inválido: ${name}`);
  const theme: ThemeSummary = {
    id,
    name,
    uiTheme,
    colors: { ...baseColors(uiTheme), ...mapVSCodeColors(parsed.colors ?? {}, uiTheme) },
    tokenColors: parsed.tokenColors
  };
  extensionThemes.set(id, theme);
  return () => extensionThemes.delete(id);
}

export async function applyTheme(settings: AppSettings): Promise<ThemeSummary> {
  const themes = await listThemes();
  const selected = findTheme(themes, settings.theme) ?? themes[0];
  const loadedTheme = selected.path ? await loadVSCodeTheme(selected.path) : undefined;
  const colors = {
    ...selected.colors,
    ...(loadedTheme ? mapVSCodeColors(loadedTheme.colors ?? {}, selected.uiTheme) : {})
  };
  const tokenColors = loadedTheme?.tokenColors ?? selected.tokenColors ?? [];
  const welcomeLogo = selected.welcomeLogo ?? DEFAULT_WELCOME_LOGO;
  const appliedTheme: ThemeSummary = {
    ...selected,
    colors,
    tokenColors,
    welcomeLogo
  };

  for (const [key, value] of Object.entries(colors)) {
    document.documentElement.style.setProperty(key, value);
  }
  document.documentElement.style.setProperty("--editor-font-family", settings.editorFontFamily);
  document.documentElement.style.setProperty("--editor-font-size", `${settings.editorFontSize}px`);
  document.documentElement.style.setProperty("--welcome-logo-url", cssUrl(welcomeLogo));
  document.documentElement.style.colorScheme = monacoBase(selected, loadedTheme) === "vs" ? "light" : "dark";

  applyMonacoTheme(appliedTheme, loadedTheme);
  return appliedTheme;
}

function manifestEntriesToThemes(entries: ThemeManifestEntry[], special: boolean): ThemeSummary[] {
  return entries.map(entry => ({
    id: entry.id ?? entry.path.replace(/^\.\/|\.json$/g, "").replace(/\//g, "-"),
    name: entry.label,
    path: toResourcePath(entry.path),
    uiTheme: entry.uiTheme,
    welcomeLogo: entry.welcomeLogo ? toResourcePath(entry.welcomeLogo) : undefined,
    special,
    colors: special ? BUILT_IN_FALLBACKS[0].colors : baseColors(entry.uiTheme)
  }));
}

async function hydrateThemeSwatches(themes: ThemeSummary[]): Promise<ThemeSummary[]> {
  return Promise.all(themes.map(async theme => {
    if (!theme.path) return theme;
    const loadedTheme = await loadVSCodeTheme(theme.path);
    if (!loadedTheme) return theme;
    return {
      ...theme,
      colors: {
        ...theme.colors,
        ...mapVSCodeColors(loadedTheme.colors ?? {}, theme.uiTheme)
      },
      tokenColors: loadedTheme.tokenColors
    };
  }));
}

function findTheme(themes: ThemeSummary[], configuredTheme: string): ThemeSummary | undefined {
  return themes.find(theme =>
    theme.id === configuredTheme ||
    theme.name === configuredTheme ||
    theme.path?.endsWith(`/${configuredTheme}.json`) ||
    theme.path?.endsWith(`/${configuredTheme}`)
  );
}

async function loadVSCodeTheme(url: string): Promise<VSCodeThemeFile | undefined> {
  const cached = themeFileCache.get(url);
  if (cached) return cached;
  const loaded = loadThemeFile(url);
  themeFileCache.set(url, loaded);
  return loaded;
}

async function loadThemeFile(url: string): Promise<VSCodeThemeFile | undefined> {
  const bundled = bundledThemeAssetFromUrl(url);
  if (bundled) return parseThemeFile(bundled, url);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[NPSharp assets] Theme file returned ${response.status}: ${url}`);
      return undefined;
    }
    return parseThemeFile(await response.text(), url);
  } catch (error) {
    console.warn(`[NPSharp assets] Failed to load theme file: ${url}`, error);
    return undefined;
  }
}

async function themesFromManifest(source: string, sourceName: string): Promise<ThemeSummary[]> {
  try {
    const pack = JSON.parse(stripJsonc(source)) as ThemePackage;
    const themes: ThemeSummary[] = [...BUILT_IN_FALLBACKS];
    themes.push(...manifestEntriesToThemes(pack.contributes?.themes ?? [], false));
    themes.push(...manifestEntriesToThemes(pack.contributes?.specialThemes ?? [], true));
    return hydrateThemeSwatches(themes);
  } catch (error) {
    console.warn(`[NPSharp assets] Failed to parse theme manifest: ${sourceName}`, error);
    return BUILT_IN_FALLBACKS;
  }
}

function parseThemeFile(source: string, sourceName: string): VSCodeThemeFile | undefined {
  try {
    return JSON.parse(stripJsonc(source)) as VSCodeThemeFile;
  } catch (error) {
    console.warn(`[NPSharp assets] Failed to parse theme file: ${sourceName}`, error);
    return undefined;
  }
}

function bundledThemeAsset(fileName: string): string | undefined {
  const suffix = `/themes/${fileName.replace(/^\.\//, "")}`;
  return Object.entries(BUNDLED_THEME_ASSETS).find(([path]) => path.replace(/\\/g, "/").endsWith(suffix))?.[1];
}

function bundledThemeAssetFromUrl(url: string): string | undefined {
  try {
    const path = new URL(url).pathname;
    const marker = "/themes/";
    const index = path.lastIndexOf(marker);
    return index < 0 ? undefined : bundledThemeAsset(decodeURIComponent(path.slice(index + marker.length)));
  } catch {
    return undefined;
  }
}

function applyMonacoTheme(theme: ThemeSummary, loadedTheme?: VSCodeThemeFile): void {
  const base = monacoBase(theme, loadedTheme);
  monaco.editor.defineTheme("npsharp-active", {
    base,
    inherit: true,
    rules: tokenColorsToMonacoRules(theme.tokenColors ?? []),
    colors: loadedTheme?.colors ?? cssVariablesToMonacoColors(theme.colors)
  });
  monaco.editor.setTheme("npsharp-active");
}

function tokenColorsToMonacoRules(tokenColors: TokenColor[]): monaco.editor.ITokenThemeRule[] {
  const rules: monaco.editor.ITokenThemeRule[] = [];
  for (const tokenColor of tokenColors) {
    const foreground = cleanColor(tokenColor.settings?.foreground);
    const background = cleanColor(tokenColor.settings?.background);
    const fontStyle = tokenColor.settings?.fontStyle;
    for (const scope of normalizeScopes(tokenColor.scope)) {
      rules.push({
        token: scope,
        foreground,
        background,
        fontStyle
      });
    }
  }
  return rules;
}

function normalizeScopes(scope?: string | string[]): string[] {
  if (!scope) return [];
  const scopes = Array.isArray(scope) ? scope : scope.split(",");
  return scopes.map(item => item.trim()).filter(Boolean);
}

function cleanColor(color?: string): string | undefined {
  if (!color) return undefined;
  return color.startsWith("#") ? color.slice(1) : color;
}

function monacoBase(theme: ThemeSummary, loadedTheme?: VSCodeThemeFile): "vs" | "vs-dark" {
  if (theme.uiTheme === "vs") return "vs";
  if (theme.uiTheme === "vs-dark") return "vs-dark";
  return loadedTheme?.type === "light" ? "vs" : "vs-dark";
}

function mapVSCodeColors(c: ThemeColors, uiTheme = "vs-dark"): ThemeColors {
  const light = uiTheme === "vs";
  return {
    "--bg": c["editor.background"] ?? c["window.background"] ?? (light ? "#f7f7f7" : "#1e1e1e"),
    "--bg-2": c["sideBar.background"] ?? c["activityBar.background"] ?? c["editorGroupHeader.tabsBackground"] ?? (light ? "#ffffff" : "#252526"),
    "--bg-3": c["tab.inactiveBackground"] ?? c["panel.background"] ?? c["editorWidget.background"] ?? (light ? "#e8e8e8" : "#2d2d30"),
    "--fg": c["editor.foreground"] ?? c.foreground ?? (light ? "#1f2328" : "#d4d4d4"),
    "--muted": c["descriptionForeground"] ?? c["editorLineNumber.foreground"] ?? c["tab.inactiveForeground"] ?? (light ? "#5f6b7a" : "#8a8f98"),
    "--border": c["panel.border"] ?? c["sideBar.border"] ?? c["contrastBorder"] ?? (light ? "#d0d7de" : "#3c3c3c"),
    "--accent": c["focusBorder"] ?? c["button.background"] ?? c["activityBarBadge.background"] ?? (light ? "#0969da" : "#007acc"),
    "--status": c["statusBar.background"] ?? c["button.background"] ?? (light ? "#0969da" : "#007acc"),
    "--danger": c.errorForeground ?? c["inputValidation.errorBorder"] ?? (light ? "#d1242f" : "#f14c4c"),
    "--warning": c["editorWarning.foreground"] ?? c["problemsWarningIcon.foreground"] ?? c["inputValidation.warningBorder"] ?? (light ? "#9a6700" : "#cca700"),
    "--active-fg": c["list.activeSelectionForeground"] ?? c["activityBar.activeForeground"] ?? c["tab.activeForeground"] ?? c.foreground ?? (light ? "#ffffff" : "#ffffff"),
    "--status-fg": c["statusBar.foreground"] ?? c["button.foreground"] ?? (light ? "#ffffff" : "#ffffff"),
    "--input-bg": c["input.background"] ?? c["editor.background"] ?? (light ? "#ffffff" : "#1e1e1e"),
    "--button-bg": c["button.background"] ?? c["activityBarBadge.background"] ?? (light ? "#0969da" : "#0e639c"),
    "--button-fg": c["button.foreground"] ?? (light ? "#ffffff" : "#ffffff"),
    "--selection-bg": c["editor.selectionBackground"] ?? (light ? "#b6d7ff" : "#264f78"),
    "--hover-bg": c["list.hoverBackground"] ?? c["toolbar.hoverBackground"] ?? c["tab.hoverBackground"] ?? (light ? "#eaeef2" : "#2a2d2e"),
    "--shadow": c["widget.shadow"] ?? c["scrollbar.shadow"] ?? (light ? "#1f232833" : "#00000052"),
    "--overlay-bg": c["widget.shadow"] ?? c["scrollbar.shadow"] ?? (light ? "#1f23282e" : "#00000038")
  };
}

function cssVariablesToMonacoColors(colors: ThemeColors): ThemeColors {
  return {
    "editor.background": colors["--bg"],
    "editor.foreground": colors["--fg"],
    "editor.lineHighlightBackground": colors["--bg-3"],
    "editor.selectionBackground": colors["--selection-bg"],
    "editorCursor.foreground": colors["--accent"],
    "editorLineNumber.foreground": colors["--muted"],
    "focusBorder": colors["--accent"]
  };
}

function baseColors(uiTheme = "vs-dark"): ThemeColors {
  return uiTheme === "vs" ? BUILT_IN_FALLBACKS[1].colors : BUILT_IN_FALLBACKS[0].colors;
}

function toResourcePath(path: string): string {
  return resourceUrl(`themes/${path.replace(/^\.\//, "")}`);
}

function stripJsonc(input: string): string {
  return removeTrailingCommas(stripJsonComments(input));
}

function stripJsonComments(input: string): string {
  let output = "";
  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (inLineComment) {
      if (char === "\n" || char === "\r") {
        inLineComment = false;
        output += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "\n" || char === "\r") output += char;
      if (char === "*" && next === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      output += char;
      continue;
    }

    if (char === "/" && next === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }

    output += char;
  }

  return output;
}

function removeTrailingCommas(input: string): string {
  let output = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      output += char;
      continue;
    }

    if (char === ",") {
      let lookahead = index + 1;
      while (/\s/.test(input[lookahead] ?? "")) lookahead += 1;
      if (input[lookahead] === "}" || input[lookahead] === "]") continue;
    }

    output += char;
  }

  return output;
}
