import type { EditorDiagnostic, SearchResult } from "../../shared/types";
import { configureMonaco, languageForPath, monaco } from "../../editor/monacoSetup";
import { api } from "../services/api";
import { el, fileIcon, icon } from "../utils/dom";
import { reportError } from "../utils/errors";
import { basename, extname } from "../utils/path";

interface BrandHighlightRule {
  readonly terms: string[];
  readonly className: string;
}

const FIXED_BRAND_HIGHLIGHTS: BrandHighlightRule[] = [
  { terms: ["girellidev", "girelli"], className: "brand-highlight-red" },
  { terms: ["arcaridev", "arcari"], className: "brand-highlight-yellow" },
  { terms: ["corelabs","Npsharp","NPSharp"], className: "brand-highlight-red" },
  // { terms: ["andrieli","andy"], className: "brand-highlight-special" }
];

const MAX_BRAND_HIGHLIGHTS = 2000;

export interface EditorTab {
  id: string;
  title: string;
  path?: string;
  initialContent: string;
  dirty: boolean;
  lineEnding: "\n" | "\r\n";
  virtualUri?: string;
  saveHandler?: (content: string) => Promise<void>;
  model: monaco.editor.ITextModel;
}

export class EditorTabs {
  readonly element = el("section", { className: "editor-shell" });
  private readonly tabsBar = el("div", { className: "tabs-bar" });
  private readonly editorHost = el("div", { className: "editor-host" });
  private readonly welcome = el("div", { className: "welcome-pane" });
  private readonly welcomeLogo = el("img", { className: "welcome-logo", attrs: { src: "/logos/app.png", alt: "NPSharp" } });
  private editor: monaco.editor.IStandaloneCodeEditor;
  private tabs: EditorTab[] = [];
  private activeId: string | undefined;
  private untitledCounter = 1;
  private recentFiles: string[] = [];
  private diagnostics: EditorDiagnostic[] = [];
  private errorLensEnabled = true;
  private errorLensDecorations?: monaco.editor.IEditorDecorationsCollection;
  private brandHighlightName = "";
  private brandDecorations?: monaco.editor.IEditorDecorationsCollection;

  onTabsChanged: () => void = () => undefined;
  onFileActivated: (filePath?: string) => void = () => undefined;
  onFileSaved: (filePath?: string) => void = () => undefined;
  onStatus: (text: string) => void;

  constructor(updateStatus: (text: string) => void) {
    this.onStatus = updateStatus;
    configureMonaco();
    this.buildWelcome();
    this.editorHost.append(this.welcome);
    this.element.append(this.tabsBar, this.editorHost);
    this.editor = monaco.editor.create(this.editorHost, {
      automaticLayout: true,
      theme: "npsharp-dark",
      language: "plaintext",
      fontFamily: "var(--editor-font-family)",
      fontSize: 14,
      tabSize: 4,
      insertSpaces: true,
      minimap: { enabled: true },
      glyphMargin: true,
      renderLineHighlight: "all",
      lineNumbers: "on",
      wordWrap: "off",
      scrollBeyondLastLine: false,
      bracketPairColorization: { enabled: true }
    });
    this.editor.onDidChangeModelContent(() => this.markDirtyFromEditor());
    this.editor.onDidChangeCursorPosition(() => this.updateCaretStatus());
    this.editor.addAction({
      id: "npsharp-save",
      label: "NPSharp Save",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => this.saveCurrentFile()
    });
    this.editor.addAction({
      id: "npsharp-toggle-line-comment",
      label: "Toggle Line Comment",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash],
      run: () => this.toggleLineComment()
    });
    this.render();
  }

  get activeTab(): EditorTab | undefined {
    return this.tabs.find(tab => tab.id === this.activeId);
  }

  getOpenFiles(): string[] {
    return this.tabs.map(tab => tab.path).filter((value): value is string => Boolean(value));
  }

  getCurrentText(): string {
    return this.activeTab?.model.getValue() ?? "";
  }

  getCurrentFile(): string | undefined {
    return this.activeTab?.path;
  }

  getRecentFiles(): string[] {
    return [...this.recentFiles];
  }

  applySettings(settings: { editorFontFamily: string; editorFontSize: number; editorTabSize: number; editorWordWrap: boolean; editorLineNumbers: boolean; errorLensEnabled?: boolean; brandSpecialName?: string }): void {
    this.errorLensEnabled = settings.errorLensEnabled ?? true;
    this.brandHighlightName = settings.brandSpecialName?.trim() ?? "";
    this.editor.updateOptions({
      fontFamily: settings.editorFontFamily,
      fontSize: settings.editorFontSize,
      tabSize: settings.editorTabSize,
      wordWrap: settings.editorWordWrap ? "on" : "off",
      lineNumbers: settings.editorLineNumbers ? "on" : "off"
    });
    this.renderErrorLens();
    this.renderBrandHighlights();
  }

  applyTheme(theme: { welcomeLogo?: string }): void {
    this.welcomeLogo.src = theme.welcomeLogo ?? "/logos/app.png";
  }

  async restoreFiles(files: string[], activeFile?: string): Promise<void> {
    for (const file of files) {
      await this.openFile(file, { silent: true, context: `Restore file failed (${file})` });
    }
    if (activeFile) this.selectTabByPath(activeFile);
    this.render();
  }

  newTab(content = "", suggestedExtension = ".txt"): void {
    const title = `Untitled-${this.untitledCounter++}${suggestedExtension}`;
    const model = monaco.editor.createModel(content, languageForPath(title), monaco.Uri.parse(`untitled:${title}-${crypto.randomUUID()}`));
    const tab: EditorTab = {
      id: crypto.randomUUID(),
      title,
      content,
      initialContent: content,
      dirty: content.length > 0,
      lineEnding: "\n",
      model
    } as EditorTab;
    this.tabs.push(tab);
    this.selectTab(tab.id);
    this.onStatus(`Novo arquivo ${title}`);
  }

  async openFileFromDialog(): Promise<void> {
    try {
      const result = await api.dialog.openFile();
      if (!result.canceled && result.paths[0]) await this.openFile(result.paths[0]);
    } catch (error) {
      reportError(error, this.onStatus, "Open file dialog failed");
    }
  }

  async openFile(filePath: string, options: { silent?: boolean; context?: string } = {}): Promise<void> {
    const existing = this.tabs.find(tab => tab.path === filePath);
    if (existing) {
      this.selectTab(existing.id);
      return;
    }

    try {
      const file = await api.fs.readFile(filePath);
      const model = monaco.editor.createModel(file.content, languageForPath(filePath), monaco.Uri.file(filePath));
      const tab: EditorTab = {
        id: filePath,
        title: basename(filePath),
        path: filePath,
        initialContent: file.content,
        dirty: false,
        lineEnding: file.lineEnding,
        model
      };
      this.tabs.push(tab);
      this.addRecent(filePath);
      this.applyDiagnosticsToTab(tab);
      this.selectTab(tab.id);
      if (!options.silent) this.onStatus(`Aberto ${filePath}`);
    } catch (error) {
      reportError(error, this.onStatus, options.context ?? `Open file failed (${filePath})`);
    }
  }

  openVirtualFile(title: string, uri: string, content: string, saveHandler?: (content: string) => Promise<void>): void {
    const existing = this.tabs.find(tab => tab.virtualUri === uri);
    if (existing) {
      this.selectTab(existing.id);
      return;
    }
    const model = monaco.editor.createModel(content, languageForPath(title), monaco.Uri.parse(`npsharp:${encodeURIComponent(uri)}`));
    const tab: EditorTab = {
      id: uri,
      title,
      initialContent: content,
      dirty: false,
      lineEnding: content.includes("\r\n") ? "\r\n" : "\n",
      virtualUri: uri,
      saveHandler,
      model
    };
    this.tabs.push(tab);
    this.applyDiagnosticsToTab(tab);
    this.selectTab(tab.id);
  }

  async saveCurrentFile(): Promise<void> {
    const tab = this.activeTab;
    if (!tab) return;
    try {
      await this.saveTab(tab, false);
    } catch (error) {
      reportError(error, this.onStatus, `Save failed (${tab.title})`);
    }
  }

  async saveCurrentFileAs(): Promise<void> {
    const tab = this.activeTab;
    if (!tab) return;
    try {
      await this.saveTab(tab, true);
    } catch (error) {
      reportError(error, this.onStatus, `Save As failed (${tab.title})`);
    }
  }

  async saveAll(): Promise<void> {
    for (const tab of this.tabs) {
      if (tab.dirty) await this.saveTab(tab, false);
    }
  }

  async revertCurrentFile(): Promise<void> {
    const tab = this.activeTab;
    if (!tab?.path) return;
    try {
      const file = await api.fs.readFile(tab.path);
      tab.model.setValue(file.content);
      tab.initialContent = file.content;
      tab.lineEnding = file.lineEnding;
      tab.dirty = false;
      this.renderTabs();
      this.onStatus(`Revertido ${tab.title}`);
    } catch (error) {
      reportError(error, this.onStatus, `Revert failed (${tab.path})`);
    }
  }

  closeCurrentTab(): void {
    const tab = this.activeTab;
    if (tab) this.closeTab(tab.id);
  }

  closeAllTabs(): void {
    for (const tab of [...this.tabs]) {
      if (!this.closeTab(tab.id)) break;
    }
  }

  undo(): void {
    this.editor.trigger("keyboard", "undo", null);
  }

  redo(): void {
    this.editor.trigger("keyboard", "redo", null);
  }

  cut(): void {
    this.editor.trigger("keyboard", "editor.action.clipboardCutAction", null);
  }

  copy(): void {
    this.editor.trigger("keyboard", "editor.action.clipboardCopyAction", null);
  }

  paste(): void {
    this.editor.trigger("keyboard", "editor.action.clipboardPasteAction", null);
  }

  selectAll(): void {
    this.editor.setSelection(this.editor.getModel()?.getFullModelRange() ?? new monaco.Range(1, 1, 1, 1));
  }

  duplicateCurrentLine(): void {
    this.editor.trigger("keyboard", "editor.action.copyLinesDownAction", null);
  }

  deleteCurrentLine(): void {
    this.editor.trigger("keyboard", "editor.action.deleteLines", null);
  }

  moveLineUp(): void {
    this.editor.trigger("keyboard", "editor.action.moveLinesUpAction", null);
  }

  moveLineDown(): void {
    this.editor.trigger("keyboard", "editor.action.moveLinesDownAction", null);
  }

  toggleLineComment(): void {
    this.editor.trigger("keyboard", "editor.action.commentLine", null);
  }

  toggleBlockComment(): void {
    this.editor.trigger("keyboard", "editor.action.blockComment", null);
  }

  formatDocument(): void {
    this.editor.trigger("keyboard", "editor.action.formatDocument", null);
  }

  find(): void {
    this.editor.getAction("actions.find")?.run();
  }

  replace(): void {
    this.editor.getAction("editor.action.startFindReplaceAction")?.run();
  }

  goToLine(): void {
    this.editor.getAction("editor.action.gotoLine")?.run();
  }

  goToStartOfFile(): void {
    this.editor.setPosition({ lineNumber: 1, column: 1 });
    this.editor.revealPositionInCenter({ lineNumber: 1, column: 1 });
    this.editor.focus();
  }

  goToEndOfFile(): void {
    const model = this.editor.getModel();
    if (!model) return;
    const line = model.getLineCount();
    const column = model.getLineMaxColumn(line);
    this.editor.setPosition({ lineNumber: line, column });
    this.editor.revealPositionInCenter({ lineNumber: line, column });
    this.editor.focus();
  }

  async openSearchResult(result: SearchResult): Promise<void> {
    await this.openFile(result.filePath);
    this.goToOffset(result.start, result.end);
  }

  goToDiagnostic(diagnostic: EditorDiagnostic): void {
    if (diagnostic.filePath) {
      void this.openFile(diagnostic.filePath).then(() => {
        this.goToPosition(diagnostic.line, diagnostic.column);
      });
    }
  }

  goToPosition(line: number, column: number): void {
    this.editor.setPosition({ lineNumber: line, column });
    this.editor.revealPositionInCenter({ lineNumber: line, column });
    this.editor.focus();
  }

  setDiagnostics(diagnostics: EditorDiagnostic[]): void {
    this.diagnostics = diagnostics;
    for (const tab of this.tabs) {
      this.applyDiagnosticsToTab(tab);
    }
    this.renderErrorLens();
  }

  focus(): void {
    this.editor.focus();
  }

  private async saveTab(tab: EditorTab, forceSaveAs: boolean): Promise<void> {
    const content = tab.model.getValue();
    if (tab.saveHandler && !forceSaveAs) {
      await tab.saveHandler(content);
      tab.initialContent = content;
      tab.dirty = false;
      this.renderTabs();
      this.onStatus(`Salvo ${tab.title}`);
      this.onFileSaved(tab.path);
      return;
    }

    if (tab.path && !forceSaveAs) {
      await api.fs.writeFile(tab.path, this.applyLineEnding(content, tab.lineEnding));
      tab.initialContent = content;
      tab.dirty = false;
      this.addRecent(tab.path);
      this.renderTabs();
      this.onStatus(`Salvo ${tab.path}`);
      this.onFileSaved(tab.path);
      return;
    }

    const result = await api.dialog.saveFile({
      suggestedName: tab.path ? basename(tab.path) : this.suggestedFileName(tab),
      content: this.applyLineEnding(content, tab.lineEnding)
    });
    if (result.canceled || !result.path) {
      this.onStatus("Salvar cancelado");
      return;
    }

    tab.path = result.path;
    tab.id = result.path;
    tab.title = basename(result.path);
    tab.initialContent = content;
    tab.dirty = false;
    delete tab.virtualUri;
    delete tab.saveHandler;
    this.activeId = tab.id;
    monaco.editor.setModelLanguage(tab.model, languageForPath(result.path));
    this.applyDiagnosticsToTab(tab);
    this.addRecent(result.path);
    this.render();
    this.onStatus(`Salvo ${result.path}`);
    this.onFileSaved(result.path);
  }

  private closeTab(id: string): boolean {
    const tab = this.tabs.find(item => item.id === id);
    if (!tab) return true;
    if (tab.dirty && !confirm(`Descartar alteracoes em ${tab.title}?`)) {
      return false;
    }
    const index = this.tabs.indexOf(tab);
    this.tabs.splice(index, 1);
    tab.model.dispose();
    if (this.activeId === id) {
      const next = this.tabs[Math.max(0, index - 1)] ?? this.tabs[0];
      this.activeId = next?.id;
    // depois de analizar, sobre a linha 423 do editormanager.java, do editor legado, sim, vou tentar. nova materia no keep
    }
    this.render();
    return true;
  }

  private selectTab(id: string): void {
    this.activeId = id;
    const tab = this.activeTab;
    this.editor.setModel(tab?.model ?? null);
    this.welcome.hidden = Boolean(tab);
    this.render();
    this.onFileActivated(tab?.path);
    this.renderErrorLens();
    this.renderBrandHighlights();
    this.updateCaretStatus();
    this.editor.focus();
  }

  private selectTabByPath(filePath: string): void {
    const tab = this.tabs.find(item => item.path === filePath);
    if (tab) this.selectTab(tab.id);
  }

  private markDirtyFromEditor(): void {
    const tab = this.activeTab;
    if (!tab) return;
    const content = tab.model.getValue();
    tab.dirty = content !== tab.initialContent;
    this.renderTabs();
    this.updateCaretStatus();
    this.onTabsChanged();
    this.renderBrandHighlights();
  }

  private render(): void {
    this.renderTabs();
    this.welcome.hidden = Boolean(this.activeTab);
    this.onTabsChanged();
  }

  private renderTabs(): void {
    this.tabsBar.replaceChildren();
    for (const tab of this.tabs) {
      const button = el("button", {
        className: `tab ${tab.id === this.activeId ? "active" : ""}`,
        title: tab.path ?? tab.virtualUri ?? tab.title
      });
      button.append(fileIcon(tab.title, false), el("span", { text: `${tab.dirty ? "● " : ""}${tab.title}` }));
      const close = el("span", { className: "tab-close", text: "x", title: "Close" });
      close.addEventListener("click", event => {
        event.stopPropagation();
        this.closeTab(tab.id);
      });
      button.append(close);
      button.addEventListener("click", () => this.selectTab(tab.id));
      this.tabsBar.append(button);
    }

    const add = el("button", { className: "tab-action", title: "New File", children: [icon("add", "New File")] });
    add.addEventListener("click", () => this.newTab());
    this.tabsBar.append(add);
  }

  private buildWelcome(): void {
    const title = el("h1", { text: "NPSharp" });
    const subtitle = el("p", { text: "Código, Controle, Dominio" });
    const actions = el("div", { className: "welcome-actions" });
    this.welcome.append(this.welcomeLogo, title, subtitle, actions);
  }

  private updateCaretStatus(): void {
    const tab = this.activeTab;
    const position = this.editor.getPosition();
    if (!tab || !position) {
      this.onStatus("Ready");
      return;
    }
    this.onStatus(`${tab.path ?? tab.virtualUri ?? tab.title} | Ln ${position.lineNumber}, Col ${position.column} | ${this.languageLabel(tab.title)}`);
  }

  private renderErrorLens(): void {
    this.errorLensDecorations ??= this.editor.createDecorationsCollection();
    const tab = this.activeTab;
    if (!tab?.path || !this.errorLensEnabled) {
      this.errorLensDecorations.clear();
      return;
    }

    const decorations = this.diagnostics
      .filter(item => sameFilePath(item.filePath, tab.path))
      .map(item => ({
        range: new monaco.Range(
          boundedLine(tab.model, item.line),
          tab.model.getLineMaxColumn(boundedLine(tab.model, item.line)),
          boundedLine(tab.model, item.line),
          tab.model.getLineMaxColumn(boundedLine(tab.model, item.line))
        ),
        options: {
          isWholeLine: true,
          className: `error-lens-line error-lens-line-${severityClass(item.severity)}`,
          linesDecorationsClassName: `error-lens-lines error-lens-lines-${severityClass(item.severity)}`,
          glyphMarginClassName: `error-lens-glyph error-lens-glyph-${severityClass(item.severity)}`,
          glyphMarginHoverMessage: { value: errorLensMarkdown(item) },
          after: {
            content: `  ${errorLensText(item)}`,
            inlineClassName: `error-lens error-lens-${severityClass(item.severity)}`,
            cursorStops: monaco.editor.InjectedTextCursorStops.None
          },
          hoverMessage: { value: errorLensMarkdown(item) },
          zIndex: 20
        }
      }));
    this.errorLensDecorations.set(decorations);
  }

  private renderBrandHighlights(): void {
    this.brandDecorations ??= this.editor.createDecorationsCollection();
    const tab = this.activeTab;
    if (!tab) {
      this.brandDecorations.clear();
      return;
    }

    const decorations: monaco.editor.IModelDeltaDecoration[] = [];
    for (const rule of this.brandHighlightRules()) {
      for (const range of findBrandRanges(tab.model, rule.terms)) {
        decorations.push({
          range,
          options: {
            inlineClassName: rule.className,
            zIndex: 30
          }
        });
        if (decorations.length >= MAX_BRAND_HIGHLIGHTS) {
          this.brandDecorations.set(decorations);
          return;
        }
      }
    }
    this.brandDecorations.set(decorations);
  }

  private brandHighlightRules(): BrandHighlightRule[] {
    if (!this.brandHighlightName) return FIXED_BRAND_HIGHLIGHTS;
    return [
      ...FIXED_BRAND_HIGHLIGHTS,
      { terms: [this.brandHighlightName], className: "brand-highlight-special" }
    ];
  }

  private applyDiagnosticsToTab(tab: EditorTab): void {
    if (!tab.path) {
      monaco.editor.setModelMarkers(tab.model, "npsharp", []);
      return;
    }

    const markers = this.diagnostics
      .filter(item => sameFilePath(item.filePath, tab.path))
      .map(item => ({
        severity: severityToMarker(item.severity),
        message: item.message,
        source: item.source,
        startLineNumber: boundedLine(tab.model, item.line),
        startColumn: boundedColumn(tab.model, item.line, item.column),
        endLineNumber: boundedLine(tab.model, item.endLine ?? item.line),
        endColumn: boundedColumn(tab.model, item.endLine ?? item.line, item.endColumn ?? item.column + 1)
      }));
    monaco.editor.setModelMarkers(tab.model, "npsharp", markers);
  }

  private goToOffset(start: number, end: number): void {
    const model = this.editor.getModel();
    if (!model) return;
    const startPosition = model.getPositionAt(start);
    const endPosition = model.getPositionAt(end);
    this.editor.setSelection(new monaco.Range(startPosition.lineNumber, startPosition.column, endPosition.lineNumber, endPosition.column));
    this.editor.revealPositionInCenter(startPosition);
    this.editor.focus();
  }

  private addRecent(filePath: string): void {
    this.recentFiles = [filePath, ...this.recentFiles.filter(item => item !== filePath)].slice(0, 20);
  }

  private suggestedFileName(tab: EditorTab): string {
    const extension = extname(tab.title) || ".txt";
    return tab.title.includes(".") ? tab.title : `${tab.title}${extension}`;
  }

  private applyLineEnding(content: string, lineEnding: "\n" | "\r\n"): string {
    return lineEnding === "\n" ? content.replace(/\r\n/g, "\n") : content.replace(/\r?\n/g, "\r\n");
  }

  private languageLabel(name: string): string {
    const language = languageForPath(name);
    const labels: Record<string, string> = {
      javascript: "JavaScript",
      typescript: "TypeScript",
      json: "JSON",
      html: "HTML",
      css: "CSS",
      java: "Java",
      python: "Python",
      go: "Go",
      rust: "Rust",
      csharp: "C#",
      cpp: "C++",
      c: "C",
      php: "PHP",
      ruby: "Ruby",
      lua: "Lua",
      kotlin: "Kotlin",
      shell: "Shell",
      powershell: "PowerShell",
      portugol: "Portugol",
      markdown: "Markdown"
    };
    return labels[language] ?? "Plain Text";
  }
}

function severityToMarker(severity: EditorDiagnostic["severity"]): monaco.MarkerSeverity {
  switch (severity) {
    case "ERROR":
      return monaco.MarkerSeverity.Error;
    case "WARNING":
      return monaco.MarkerSeverity.Warning;
    case "INFORMATION":
      return monaco.MarkerSeverity.Info;
    case "HINT":
      return monaco.MarkerSeverity.Hint;
  }
}

function sameFilePath(left?: string, right?: string): boolean {
  return normalizeFilePath(left) === normalizeFilePath(right);
}

function normalizeFilePath(filePath?: string): string {
  return (filePath ?? "").replace(/\\/g, "/");
}

function boundedLine(model: monaco.editor.ITextModel, line: number): number {
  return Math.min(Math.max(1, line), model.getLineCount());
}

function boundedColumn(model: monaco.editor.ITextModel, line: number, column: number): number {
  const safeLine = boundedLine(model, line);
  return Math.min(Math.max(1, column), model.getLineMaxColumn(safeLine));
}

function severityClass(severity: EditorDiagnostic["severity"]): string {
  return severity.toLowerCase();
}

function errorLensText(diagnostic: EditorDiagnostic): string {
  return diagnostic.source ? `${diagnostic.message} (${diagnostic.source})` : diagnostic.message;
}

function errorLensMarkdown(diagnostic: EditorDiagnostic): string {
  return `**${diagnostic.severity}** ${errorLensText(diagnostic)}`;
}

function findBrandRanges(model: monaco.editor.ITextModel, terms: string[]): monaco.Range[] {
  const pattern = terms
    .map(term => term.trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");
  if (!pattern) return [];

  const ranges: monaco.Range[] = [];
  const regex = new RegExp(pattern, "giu");
  for (const match of model.getValue().matchAll(regex)) {
    if (match.index === undefined) continue;
    const start = model.getPositionAt(match.index);
    const end = model.getPositionAt(match.index + match[0].length);
    ranges.push(new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column));
  }
  return ranges;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
