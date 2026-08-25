/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { AIContextItem, AIContextSource, EditorDiagnostic, WorkspaceEntry } from "../../shared/types";
import { api } from "../services/api";
import { basename, extname, relativePath } from "../utils/path";

export interface ContextCollectorHost {
  workspace(): string | undefined;
  currentFile(): string | undefined;
  currentText(): string;
  selection(): string;
  openEditors(): Array<{ path: string; content: string }>;
  terminalOutput(): string;
  gitDiff(): Promise<string>;
  diagnostics(): readonly EditorDiagnostic[];
}

const IGNORED_DIRECTORIES = new Set([".git", "node_modules", "dist", "dist-electron", "build", "target", "bin", "obj", "release"]);
const MAX_FILE_BYTES = 160_000;
const MAX_WORKSPACE_FILES = 24;
const MAX_SCAN_FILES = 400;

export class ContextCollector {
  private droppedFiles: AIContextItem[] = [];

  constructor(private readonly host: ContextCollectorHost) {}

  addDroppedFile(name: string, content: string, path?: string): void {
    this.droppedFiles.push({
      id: crypto.randomUUID(),
      source: "files",
      label: name,
      path,
      language: languageFromPath(name),
      content: content.slice(0, MAX_FILE_BYTES),
      truncated: content.length > MAX_FILE_BYTES
    });
  }

  clearDroppedFiles(): void {
    this.droppedFiles = [];
  }

  droppedFileLabels(): string[] {
    return this.droppedFiles.map(item => item.label);
  }

  workspace(): string | undefined {
    return this.host.workspace();
  }

  async collect(sources: ReadonlySet<AIContextSource>, prompt: string): Promise<AIContextItem[]> {
    const items: AIContextItem[] = [];
    const currentFile = this.host.currentFile();
    if (sources.has("currentFile") && currentFile) {
      items.push(item("currentFile", basename(currentFile), this.host.currentText(), currentFile));
    }
    if (sources.has("selection")) {
      const selection = this.host.selection();
      if (selection) items.push(item("selection", currentFile ? `Seleção de ${basename(currentFile)}` : "Seleção do editor", selection, currentFile));
    }
    if (sources.has("openEditors")) {
      for (const editor of this.host.openEditors()) {
        items.push(item("openEditors", `Open editor: ${basename(editor.path)}`, editor.content, editor.path));
      }
    }
    const workspace = this.host.workspace();
    if (sources.has("workspaceTree") && workspace) {
      items.push(item("workspaceTree", "Árvore do workspace", await this.workspaceTree(workspace), workspace));
    }
    if (sources.has("workspaceFiles") && workspace) {
      items.push(...await this.relevantWorkspaceFiles(workspace, prompt));
    }
    if (sources.has("terminal") || sources.has("buildOutput")) {
      const output = this.host.terminalOutput();
      if (output) items.push(item(sources.has("buildOutput") ? "buildOutput" : "terminal", "Saída do terminal / compilação", output));
    }
    if (sources.has("gitDiff")) {
      const diff = await this.host.gitDiff();
      if (diff) items.push(item("gitDiff", "Git diff", diff));
    }
    if (sources.has("diagnostics") || sources.has("problems")) {
      const diagnostics = this.host.diagnostics();
      if (diagnostics.length) {
        items.push(item("diagnostics", "Diagnósticos e problemas", diagnostics.map(diagnostic =>
          `${diagnostic.severity} ${diagnostic.filePath}:${diagnostic.line}:${diagnostic.column} ${diagnostic.message} (${diagnostic.source})`
        ).join("\n")));
      }
    }
    if (sources.has("clipboard")) {
      try {
        const clipboard = await navigator.clipboard.readText();
        if (clipboard) items.push(item("clipboard", "Clipboard", clipboard));
      } catch (error) {
        console.warn("[Sharp-OSS AI] Clipboard context could not be read.", error);
      }
    }
    if (sources.has("files")) items.push(...this.droppedFiles);
    return items.map(limitItem);
  }

  private async workspaceTree(workspace: string): Promise<string> {
    const lines: string[] = [];
    const ignorePatterns = await this.ignorePatterns(workspace);
    const walk = async (directory: string, depth: number): Promise<void> => {
      if (depth > 8 || lines.length >= 2000) return;
      const entries = await safeList(directory);
      for (const entry of entries) {
        const relative = relativePath(workspace, entry.path);
        if (isIgnored(entry, relative, ignorePatterns)) continue;
        lines.push(`${"  ".repeat(depth)}${entry.directory ? "📁 " : "📄 "}${entry.name}`);
        if (entry.directory) await walk(entry.path, depth + 1);
        if (lines.length >= 2000) break;
      }
    };
    await walk(workspace, 0);
    return lines.join("\n");
  }

  private async relevantWorkspaceFiles(workspace: string, prompt: string): Promise<AIContextItem[]> {
    const candidates: Array<{ path: string; score: number; content: string }> = [];
    const ignorePatterns = await this.ignorePatterns(workspace);
    const terms = prompt.toLocaleLowerCase().split(/[^\p{L}\p{N}_.-]+/u).filter(term => term.length >= 3);
    const walk = async (directory: string): Promise<void> => {
      if (candidates.length >= MAX_SCAN_FILES) return;
      for (const entry of await safeList(directory)) {
        const relative = relativePath(workspace, entry.path);
        if (isIgnored(entry, relative, ignorePatterns)) continue;
        if (entry.directory) {
          await walk(entry.path);
        } else if (entry.size <= MAX_FILE_BYTES && isTextFile(entry.name)) {
          try {
            const content = (await api.fs.readFile(entry.path)).content;
            const haystack = `${relative}\n${content.slice(0, 30_000)}`.toLocaleLowerCase();
            const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0)
              + (entry.path === this.host.currentFile() ? 100 : 0);
            candidates.push({ path: entry.path, score, content });
          } catch (error) {
            console.warn(`[Sharp-OSS AI] Skipping unreadable context file ${entry.path}.`, error);
          }
        }
        if (candidates.length >= MAX_SCAN_FILES) return;
      }
    };
    await walk(workspace);
    return candidates
      .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
      .slice(0, MAX_WORKSPACE_FILES)
      .map(candidate => item("workspaceFiles", `Workspace file: ${relativePath(workspace, candidate.path)}`, candidate.content, candidate.path));
  }

  private async ignorePatterns(workspace: string): Promise<string[]> {
    const ignorePath = `${workspace.replace(/[\\/]$/u, "")}/.gitignore`;
    try {
      const file = await api.fs.readFile(ignorePath);
      return file.content.split(/\r?\n/u).map(line => line.trim()).filter(line => line && !line.startsWith("#") && !line.startsWith("!"));
    } catch {
      return [];
    }
  }
}

function item(source: AIContextSource, label: string, content: string, path?: string): AIContextItem {
  return { id: crypto.randomUUID(), source, label, content, path, language: path ? languageFromPath(path) : undefined };
}

function limitItem(context: AIContextItem): AIContextItem {
  return context.content.length <= MAX_FILE_BYTES
    ? context
    : { ...context, content: `${context.content.slice(0, MAX_FILE_BYTES)}\n…[truncated]`, truncated: true };
}

async function safeList(directory: string): Promise<WorkspaceEntry[]> {
  try {
    return await api.fs.listDir(directory);
  } catch (error) {
    console.warn(`[Sharp-OSS AI] Could not inspect ${directory}.`, error);
    return [];
  }
}

function isIgnored(entry: WorkspaceEntry, relative: string, patterns: readonly string[]): boolean {
  if (entry.hidden && entry.name !== ".gitignore") return true;
  if (entry.directory && IGNORED_DIRECTORIES.has(entry.name.toLocaleLowerCase())) return true;
  const normalized = relative.replace(/\\/gu, "/");
  return patterns.some(pattern => simpleGlobMatch(normalized, pattern.replace(/^\//u, "")));
}

function simpleGlobMatch(path: string, pattern: string): boolean {
  const directoryPattern = pattern.endsWith("/");
  const clean = pattern.replace(/\/$/u, "");
  const escaped = clean.replace(/[.+^${}()|[\]\\]/gu, "\\$&").replace(/\*\*/gu, "§§").replace(/\*/gu, "[^/]*").replace(/§§/gu, ".*");
  const regex = new RegExp(`(^|/)${escaped}${directoryPattern ? "(/|$)" : "$"}`, "u");
  return regex.test(path);
}

function languageFromPath(path: string): string {
  return extname(path).replace(/^\./u, "").toLocaleLowerCase() || "text";
}

function isTextFile(name: string): boolean {
  return !/\.(?:png|jpe?g|gif|webp|ico|pdf|zip|gz|tar|7z|exe|dll|so|dylib|woff2?|ttf|mp[34]|mov|avi|class|jar)$/iu.test(name);
}
