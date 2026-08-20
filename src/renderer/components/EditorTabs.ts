/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { EditorDiagnostic, FileOpenResult, GitDiffContent, SearchResult, TextEncoding } from "../../shared/types";
import { COMPACT_MINIMAP_OPTIONS, configureMonaco, ensureLanguageSupport, languageForPath, monaco } from "../../editor/monacoSetup";
import { emmetAbbreviationAt, emmetLanguageConfig, htmlAbbreviationAt, isLikelyHtmlAbbreviation } from "../../editor/emmet";
import { matchingSnippets, snippetAtPrefix, typedSnippetPrefix } from "../../editor/snippets";
import type { ShortcutBinding } from "../shortcuts/keybindings";
import { monacoKeybindingFromShortcut } from "../shortcuts/keybindings";
import { api } from "../services/api";
import { buttonIcon, el, fileIcon, icon } from "../utils/dom";
import { reportError } from "../utils/errors";
import { DEFAULT_LOGO_URL } from "../utils/assets";
import { basename, extname } from "../utils/path";
import { ImageViewer } from "./ImageViewer";
import { UniversalFileViewer } from "./UniversalFileViewer";
import { MonacoDiffViewer } from "./MonacoDiffViewer";

interface BrandHighlightRule {
  readonly terms: string[];
  readonly className: string;
}

const FIXED_BRAND_HIGHLIGHTS: BrandHighlightRule[] = [
  { terms: ["girellidev", "girelli"], className: "brand-highlight-red" },
  { terms: ["arcaridev", "arcari"], className: "brand-highlight-yellow" },
  { terms: ["corelabs","Npsharp","NPSharp"], className: "brand-highlight-red" },
  { terms: ["ESPERA O SPOILER"], className: "brand-highlight-special" },
  { terms: ["PRF","Policia Rodoviaria Federal"], className: "brand-highlight-police" }
];

const MAX_BRAND_HIGHLIGHTS = 2000;
const HEX_COLOR_PATTERN = /#[\da-fA-F]{3,4}(?:[\da-fA-F]{2}){0,2}\b/g;

export interface EditorTab {
  id: string;
  title: string;
  path?: string;
  initialContent: string;
  dirty: boolean;
  lineEnding: "\n" | "\r\n";
  encoding: TextEncoding;
  encodingDirty?: boolean;
  displayType?: string;
  virtualUri?: string;
  saveHandler?: (content: string) => Promise<void>;
  model: monaco.editor.ITextModel;
}

interface ClosedEditorTab {
  readonly title: string;
  readonly path?: string;
  readonly virtualUri?: string;
  readonly content: string;
  readonly lineEnding: "\n" | "\r\n";
  readonly encoding: TextEncoding;
}

export interface EditorStatusInfo {
  readonly active: boolean;
  readonly language: string;
  readonly encoding: TextEncoding;
  readonly lineEnding: "\n" | "\r\n";
  readonly line: number;
  readonly column: number;
}

export class EditorTabs {
  readonly element = el("section", { className: "editor-shell" });
  private readonly tabsBar = el("div", { className: "tabs-bar" });
  private readonly editorHost = el("div", { className: "editor-host" });
  private readonly welcome = el("div", { className: "welcome-pane" });
  private readonly welcomeLogo = el("img", { className: "welcome-logo", attrs: { src: DEFAULT_LOGO_URL, alt: "NPSharp" } });
  private editor: monaco.editor.IStandaloneCodeEditor;
  private tabs: EditorTab[] = [];
  private readonly fileViewers = new Map<string, ImageViewer | UniversalFileViewer | MonacoDiffViewer>();
  private activeId: string | undefined;
  private closedTabs: ClosedEditorTab[] = [];
  private navigationBackStack: string[] = [];
  private navigationForwardStack: string[] = [];
  private navigatingHistory = false;
  private untitledCounter = 1;
  private recentFiles: string[] = [];
  private diagnostics: EditorDiagnostic[] = [];
  private errorLensEnabled = true;
  private tabSize = 4;
  private errorLensDecorations?: monaco.editor.IEditorDecorationsCollection;
  private brandHighlightName = "";
  private brandDecorations?: monaco.editor.IEditorDecorationsCollection;
  private colorDecorations?: monaco.editor.IEditorDecorationsCollection;
  private readonly colorStyle = document.createElement("style");
  private readonly colorClasses = new Map<string, string>();
  private readonly disposables: monaco.IDisposable[] = [];
  private readonly shortcutDisposables: monaco.IDisposable[] = [];
  private disposed = false;

  onTabsChanged: () => void = () => undefined;
  onFileActivated: (filePath?: string) => void = () => undefined;
  onFileSaved: (filePath?: string) => void = () => undefined;
  onAIAction: (action: string) => void = () => undefined;
  onEditorStatus: (status: EditorStatusInfo) => void = () => undefined;
  onStatus: (text: string) => void;
  action: any;

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
      minimap: COMPACT_MINIMAP_OPTIONS,
      colorDecorators: false,
      glyphMargin: true,
      overviewRulerLanes: 3,
      renderLineHighlight: "all",
      lineNumbers: "on",
      wordWrap: "off",
      scrollBeyondLastLine: false,
      bracketPairColorization: { enabled: true },
      quickSuggestions: { other: true, comments: false, strings: true },
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: "on",
      tabCompletion: "on",
      snippetSuggestions: "top",
      wordBasedSuggestions: "allDocuments",
      suggest: {
        showWords: true,
        showKeywords: true,
        showSnippets: true,
        showClasses: true,
        showFunctions: true,
        showMethods: true,
        showProperties: true,
        showVariables: true,
        showValues: true,
        showConstants: true,
        showConstructors: true,
        showInterfaces: true,
        showStructs: true,
        showEvents: true,
        showOperators: true,
        showModules: true
      }
    });
    const handleEmmetTab = (event: KeyboardEvent): void => {
      if (event.key !== "Tab" || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      if (!(event.target instanceof Element) || !event.target.closest(".monaco-editor")) return;
      if (!this.expandSnippetAtCursor() && !this.expandEmmetAtCursor()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    this.editorHost.addEventListener("keydown", handleEmmetTab, true);
    this.disposables.push(
      { dispose: () => this.editorHost.removeEventListener("keydown", handleEmmetTab, true) },
      this.editor.onDidChangeModelContent(event => {
        this.markDirtyFromEditor();
        if (event.isFlush) return;
        queueMicrotask(() => this.triggerSnippetSuggestions());
      }),
      this.editor.onDidChangeCursorPosition(() => this.updateCaretStatus()),
      monaco.editor.onDidChangeMarkers(changedModels => {
        const model = this.editor.getModel();
        if (model && changedModels.some(uri => uri.toString() === model.uri.toString())) {
          this.renderErrorLens();
        }
      })
    );
    document.head.append(this.colorStyle);
    this.registerAIContextActions();
    this.render();
  }

  private expandEmmetAtCursor(): boolean {
    const model = this.editor.getModel();
    const position = this.editor.getPosition();
    if (!model || !position) return false;
    const prefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
    const language = model.getLanguageId();
    const config = emmetLanguageConfig(language, model.uri.path);
    const expansion = config ? emmetAbbreviationAt(prefix, config) : htmlAbbreviationAt(prefix);
    if (!expansion) return false;
    const isNewHtmlDocument = language === "plaintext" && isLikelyHtmlAbbreviation(expansion.abbreviation) && model.getValue().trim() === expansion.abbreviation;
    if (!config && !isNewHtmlDocument) return false;

    const range = new monaco.Range(position.lineNumber, position.column - expansion.abbreviation.length, position.lineNumber, position.column);
    this.editor.executeEdits("emmet", [{ range, text: "" }]);
    if (isNewHtmlDocument) monaco.editor.setModelLanguage(model, "html");
    this.insertSnippet(expansion.snippet);
    return true;
  }

  private expandSnippetAtCursor(): boolean {
    const model = this.editor.getModel();
    const position = this.editor.getPosition();
    if (!model || !position) return false;
    const prefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
    const snippet = snippetAtPrefix(model.getLanguageId(), prefix);
    if (!snippet) return false;
    const range = new monaco.Range(position.lineNumber, position.column - snippet.prefix.length, position.lineNumber, position.column);
    this.editor.executeEdits("snippet", [{ range, text: "" }]);
    this.insertSnippet(snippet.body);
    return true;
  }

  private triggerSnippetSuggestions(): void {
    const model = this.editor.getModel();
    const position = this.editor.getPosition();
    if (!model || !position || !this.editor.hasTextFocus()) return;
    const linePrefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
    const typedPrefix = typedSnippetPrefix(linePrefix);
    if (!typedPrefix || !matchingSnippets(model.getLanguageId(), typedPrefix).length) return;
    this.editor.trigger("snippets", "editor.action.triggerSuggest", {});
  }

  private insertSnippet(template: string): void {
    const controller = this.editor.getContribution("snippetController2") as unknown as { insert(template: string): void } | null;
    if (controller) {
      controller.insert(template);
      return;
    }
    // The feature registration normally guarantees the controller. Keep text
    // insertion functional if a custom Monaco build removes that contribution.
    const selection = this.editor.getSelection();
    if (selection) this.editor.executeEdits("snippet-fallback", [{ range: selection, text: template.replace(/\$\{\d+(?::([^}]*))?\}|\$\d+/g, "$1") }]);
  }

  get activeTab(): EditorTab | undefined {
    return this.tabs.find(tab => tab.id === this.activeId);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const disposable of this.disposables.splice(0)) {
      disposable.dispose();
    }
    for (const disposable of this.shortcutDisposables.splice(0)) {
      disposable.dispose();
    }
    this.errorLensDecorations?.clear();
    this.brandDecorations?.clear();
    this.colorDecorations?.clear();
    this.colorStyle.remove();
    for (const tab of this.tabs) {
      if (!tab.model.isDisposed()) tab.model.dispose();
    }
    for (const viewer of this.fileViewers.values()) viewer.dispose();
    this.fileViewers.clear();
    this.tabs = [];
    this.closedTabs = [];
    this.editor.dispose();
  }

  getOpenFiles(): string[] {
    if (this.disposed) return [];
    return this.tabs.map(tab => tab.path).filter((value): value is string => Boolean(value));
  }

  getCurrentText(): string {
    if (this.disposed) return "";
    return this.activeTab?.model.getValue() ?? "";
  }

  getCurrentFile(): string | undefined {
    if (this.disposed) return undefined;
    return this.activeTab?.path;
  }

  getStatusInfo(): EditorStatusInfo {
    const tab = this.activeTab;
    const position = this.editor.getPosition();
    return {
      active: Boolean(tab),
      language: tab ? (tab.displayType ?? this.languageLabel(tab.title)) : "Plain Text",
      encoding: tab?.encoding ?? "utf8",
      lineEnding: tab?.lineEnding ?? "\n",
      line: position?.lineNumber ?? 1,
      column: position?.column ?? 1
    };
  }

  setCurrentEncoding(encoding: TextEncoding): void {
    const tab = this.activeTab;
    if (!tab || this.fileViewers.has(tab.id) || tab.encoding === encoding) return;
    tab.encoding = encoding;
    tab.encodingDirty = true;
    tab.dirty = true;
    this.renderTabs();
    this.onEditorStatus(this.getStatusInfo());
    this.onStatus(`Codificação alterada para ${encodingLabel(encoding)}; salve o arquivo para aplicar.`);
    this.onTabsChanged();
  }

  getSelectedText(): string {
    if (this.disposed) return "";
    const selection = this.editor.getSelection();
    return selection ? this.editor.getModel()?.getValueInRange(selection) ?? "" : "";
  }

  getOpenEditorContents(): Array<{ path: string; content: string }> {
    if (this.disposed) return [];
    return this.tabs
      .filter((tab): tab is EditorTab & { path: string } => Boolean(tab.path))
      .map(tab => ({ path: tab.path, content: tab.model.getValue() }));
  }

  insertBelow(code: string): void {
    const model = this.editor.getModel();
    const selection = this.editor.getSelection();
    if (!model || !selection) return;
    const line = selection.endLineNumber;
    const range = new monaco.Range(line, model.getLineMaxColumn(line), line, model.getLineMaxColumn(line));
    this.editor.executeEdits("npsharp.ai.insertBelow", [{ range, text: `\n${code}`, forceMoveMarkers: true }]);
    this.editor.focus();
  }

  replaceSelection(code: string): void {
    const selection = this.editor.getSelection();
    if (!selection) return;
    this.editor.executeEdits("npsharp.ai.replaceSelection", [{ range: selection, text: code, forceMoveMarkers: true }]);
    this.editor.focus();
  }

  replaceCurrentFile(code: string): void {
    const model = this.editor.getModel();
    if (!model) return;
    this.editor.executeEdits("npsharp.ai.replaceFile", [{
      range: model.getFullModelRange(),
      text: code,
      forceMoveMarkers: true
    }]);
    this.editor.focus();
  }

  getRecentFiles(): string[] {
    return [...this.recentFiles];
  }

  registerMonacoShortcuts(shortcuts: readonly ShortcutBinding[]): void {
    if (this.disposed) return;
    for (const disposable of this.shortcutDisposables.splice(0)) {
      disposable.dispose();
    }
    for (const shortcut of shortcuts) {
      if (shortcut.scope !== "editor") continue;
      for (const [index, key] of shortcut.keys.entries()) {
        const keybinding = monacoKeybindingFromShortcut(key);
        if (keybinding === undefined) continue;
        this.shortcutDisposables.push(this.editor.addAction({
          id: `npsharp.shortcut.${shortcut.id.replace(/[^a-zA-Z0-9_.-]/g, "-")}.${index}`,
          label: shortcut.label,
          keybindings: [keybinding],
          run: () => shortcut.run()
        }));
      }
    }
  }

  runMonacoAction(actionId: string, status?: string): void {
    this.runEditorAction(actionId, status);
  }

  private registerAIContextActions(): void {
    const actions = [
      ["ask", "Ask AI"],
      ["explain", "AI: Explain"],
      ["refactor", "AI: Refactor"],
      ["optimize", "AI: Optimize"],
      ["docs", "AI: Generate Docs"],
      ["tests", "AI: Generate Tests"],
      ["fix", "AI: Fix Code"],
      ["convert", "AI: Convert Language"],
      ["review", "AI: Review Code"]
    ] as const;
    actions.forEach(([id, label], index) => {
      this.disposables.push(this.editor.addAction({
        id: `npsharp.ai.${id}`,
        label,
        contextMenuGroupId: "9_ai",
        contextMenuOrder: index + 1,
        run: () => this.onAIAction(id)
      }));
    });
  }

  applySettings(settings: { editorFontFamily: string; editorFontSize: number; editorTabSize: number; editorWordWrap: boolean; editorLineNumbers: boolean; errorLensEnabled?: boolean; brandSpecialName?: string }): void {
    if (this.disposed) return;
    this.errorLensEnabled = settings.errorLensEnabled ?? true;
    this.brandHighlightName = settings.brandSpecialName?.trim() ?? "";
    this.tabSize = Math.max(1, Math.min(12, Math.round(settings.editorTabSize) || 4));
    this.editor.updateOptions({
      fontFamily: settings.editorFontFamily,
      fontSize: settings.editorFontSize,
      tabSize: this.tabSize,
      minimap: COMPACT_MINIMAP_OPTIONS,
      wordWrap: settings.editorWordWrap ? "on" : "off",
      lineNumbers: settings.editorLineNumbers ? "on" : "off"
    });
    for (const tab of this.tabs) tab.model.updateOptions({ tabSize: this.tabSize });
    this.renderErrorLens();
    this.renderBrandHighlights();
    this.renderHexColorDecorators();
  }

  applyTheme(theme: { welcomeLogo?: string }): void {
    if (this.disposed) return;
    this.welcomeLogo.src = theme.welcomeLogo ?? DEFAULT_LOGO_URL;
  }

  async restoreFiles(files: string[], activeFile?: string): Promise<void> {
    for (const file of files) {
      if (this.disposed) return;
      await this.openFile(file, { silent: true, context: `Restore file failed (${file})` });
    }
    if (this.disposed) return;
    if (activeFile) this.selectTabByPath(activeFile);
    this.render();
  }

  newTab(content = "", suggestedExtension = ".txt"): void {
    if (this.disposed) return;
    const title = `Untitled-${this.untitledCounter++}${suggestedExtension}`;
    const model = this.createTextModel(content, languageForPath(title), monaco.Uri.parse(`untitled:${title}-${crypto.randomUUID()}`));
    const tab: EditorTab = {
      id: crypto.randomUUID(),
      title,
      content,
      initialContent: content,
      dirty: content.length > 0,
      lineEnding: "\n",
      encoding: "utf8",
      model
    } as EditorTab;
    this.tabs.push(tab);
    this.selectTab(tab.id);
    this.onStatus(`Novo arquivo ${title}`);
  }

  async openFileFromDialog(): Promise<void> {
    if (this.disposed) return;
    try {
      const result = await api.dialog.openFile();
      if (this.disposed) return;
      if (!result.canceled && result.paths[0]) await this.openFile(result.paths[0]);
    } catch (error) {
      reportError(error, this.onStatus, "Falha ao abrir o diálogo de arquivo");
    }
  }

  async openFile(filePath: string, options: { silent?: boolean; context?: string } = {}, forceText = false): Promise<void> {
    if (this.disposed) return;
    const existing = this.tabs.find(tab => tab.path === filePath);
    if (existing) {
      this.selectTab(existing.id);
      return;
    }

    try {
      const file = await api.fs.openFile(filePath, forceText);
      if (this.disposed) return;
      if (file.editor === "image") {
        this.openImageFile(file);
        if (!options.silent) this.onStatus(`Aberto ${filePath}`);
        return;
      }
      if (file.editor !== "text") {
        this.openUniversalFile(file);
        if (!options.silent) this.onStatus(`Aberto ${filePath}`);
        return;
      }
      const content = file.content ?? "";
      const language = file.editableStructuredKind === "nbt" ? "json" : languageForPath(filePath);
      await ensureLanguageSupport(language);
      const model = this.createTextModel(content, language, filePath.startsWith("npsharp-remote://") ? monaco.Uri.parse(filePath) : monaco.Uri.file(filePath));
      const tab: EditorTab = {
        id: filePath,
        title: basename(filePath),
        path: filePath,
        initialContent: content,
        dirty: false,
        lineEnding: file.lineEnding ?? "\n",
        encoding: file.encoding ?? "utf8",
        saveHandler: file.editableStructuredKind
          ? async nextContent => api.fs.saveStructuredFile({ path: file.path, kind: file.editableStructuredKind!, content: nextContent })
          : undefined,
        displayType: file.editableStructuredKind ? `${file.type} editável` : undefined,
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

  async openDiff(title: string, uri: string, filePath: string, content: GitDiffContent): Promise<void> {
    const existing = this.tabs.find(tab => tab.id === uri);
    if (existing) {
      this.selectTab(existing.id);
      return;
    }
    const model = this.createTextModel("", "plaintext", monaco.Uri.parse(uri));
    const tab: EditorTab = { id: uri, title, initialContent: "", dirty: false, lineEnding: "\n", encoding: "utf8", displayType: "Diff", virtualUri: uri, model };
    const viewer = await MonacoDiffViewer.create(content, filePath);
    viewer.element.hidden = true;
    this.fileViewers.set(tab.id, viewer);
    this.editorHost.append(viewer.element);
    this.tabs.push(tab);
    this.selectTab(tab.id);
  }

  private openImageFile(file: FileOpenResult): void {
    const model = this.createTextModel("", "plaintext", monaco.Uri.file(file.path));
    const tab: EditorTab = { id: file.path, title: file.name, path: file.path, initialContent: "", dirty: false, lineEnding: "\n", encoding: "utf8", displayType: file.type, model };
    const viewer = new ImageViewer(file, text => {
      if (this.activeId === tab.id) this.onStatus(text);
    });
    viewer.element.hidden = true;
    this.fileViewers.set(tab.id, viewer);
    this.editorHost.append(viewer.element);
    this.tabs.push(tab);
    this.addRecent(file.path);
    this.selectTab(tab.id);
  }

  private openUniversalFile(file: FileOpenResult): void {
    const model = this.createTextModel("", "plaintext", monaco.Uri.file(file.path));
    const tab: EditorTab = {
      id: file.path,
      title: file.name,
      path: file.path,
      initialContent: "",
      dirty: false,
      lineEnding: "\n",
      encoding: "utf8",
      displayType: file.editor === "nbt" ? "NBT" : file.type,
      model
    };
    const viewer = new UniversalFileViewer(file, text => {
      if (this.activeId === tab.id) this.onStatus(text);
    });
    viewer.element.hidden = true;
    this.fileViewers.set(tab.id, viewer);
    this.editorHost.append(viewer.element);
    this.tabs.push(tab);
    this.addRecent(file.path);
    this.selectTab(tab.id);
  }

  openVirtualFile(title: string, uri: string, content: string, saveHandler?: (content: string) => Promise<void>): void {
    if (this.disposed) return;
    const existing = this.tabs.find(tab => tab.virtualUri === uri);
    if (existing) {
      this.selectTab(existing.id);
      return;
    }
    const language = languageForPath(title);
    const model = this.createTextModel(content, language, monaco.Uri.parse(`npsharp:${encodeURIComponent(uri)}`));
    void ensureLanguageSupport(language).then(() => monaco.editor.setModelLanguage(model, language)).catch(error => {
      console.warn(`[NPSharp editor] Não foi possível carregar o suporte para ${language}.`, error);
    });
    const tab: EditorTab = {
      id: uri,
      title,
      initialContent: content,
      dirty: false,
      lineEnding: content.includes("\r\n") ? "\r\n" : "\n",
      encoding: "utf8",
      virtualUri: uri,
      saveHandler,
      model
    };
    this.tabs.push(tab);
    this.applyDiagnosticsToTab(tab);
    this.selectTab(tab.id);
  }

  async saveCurrentFile(): Promise<void> {
    if (this.disposed) return;
    const tab = this.activeTab;
    if (!tab) return;
    if (this.fileViewers.has(tab.id)) {
      this.onStatus("Imagens abertas no visualizador nao sao alteradas pelo editor de texto");
      return;
    }
    try {
      await this.saveTab(tab, false);
    } catch (error) {
      reportError(error, this.onStatus, `Save failed (${tab.title})`);
    }
  }

  async saveCurrentFileAs(): Promise<void> {
    if (this.disposed) return;
    const tab = this.activeTab;
    if (!tab) return;
    if (this.fileViewers.has(tab.id)) {
      this.onStatus("Imagens abertas no visualizador nao podem ser salvas como texto");
      return;
    }
    try {
      await this.saveTab(tab, true);
    } catch (error) {
      reportError(error, this.onStatus, `Save As failed (${tab.title})`);
    }
  }

  async saveAll(): Promise<void> {
    if (this.disposed) return;
    for (const tab of this.tabs) {
      if (tab.dirty) await this.saveTab(tab, false);
    }
  }

  async openActiveInOffice(): Promise<void> {
    if (this.disposed) return;
    const tab = this.activeTab;
    if (!tab?.path) {
      this.onStatus("Abra um documento ou planilha salvo para editar no LibreOffice.");
      return;
    }
    try {
      if (tab.dirty) await this.saveTab(tab, false);
      await api.office.open(tab.path);
      this.onStatus(`Aberto no LibreOffice: ${tab.title}`);
    } catch (error) {
      reportError(error, this.onStatus, "Não foi possível abrir no LibreOffice");
    }
  }

  async revertCurrentFile(): Promise<void> {
    if (this.disposed) return;
    const tab = this.activeTab;
    if (!tab?.path) return;
    if (this.fileViewers.has(tab.id)) {
      this.onStatus("A imagem exibida corresponde ao arquivo salvo em disco");
      return;
    }
    try {
      const file = await api.fs.readFile(tab.path);
      if (this.disposed) return;
      tab.model.setValue(file.content);
      tab.initialContent = file.content;
      tab.lineEnding = file.lineEnding;
      tab.encoding = file.encoding;
      tab.encodingDirty = false;
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

  reopenClosedTab(): void {
    const closed = this.closedTabs.shift();
    if (!closed) {
      this.onStatus("Nenhuma aba fechada para reabrir");
      return;
    }

    if (closed.path) {
      void this.openFile(closed.path);
      return;
    }

    const model = this.createTextModel(
      closed.content,
      languageForPath(closed.title),
      monaco.Uri.parse(closed.virtualUri ? `npsharp:${encodeURIComponent(closed.virtualUri)}` : `untitled:${closed.title}-${crypto.randomUUID()}`)
    );
    const tab: EditorTab = {
      id: closed.virtualUri ?? crypto.randomUUID(),
      title: closed.title,
      initialContent: closed.virtualUri ? closed.content : "",
      dirty: !closed.virtualUri && closed.content.length > 0,
      lineEnding: closed.lineEnding,
      encoding: closed.encoding,
      virtualUri: closed.virtualUri,
      model
    };
    this.tabs.push(tab);
    this.selectTab(tab.id);
    this.onStatus(`Reaberto ${closed.title}`);
  }

  nextTab(): void {
    this.selectTabByOffset(1);
  }

  previousTab(): void {
    this.selectTabByOffset(-1);
  }

  navigateBack(): void {
    this.navigateTabHistory(this.navigationBackStack, this.navigationForwardStack, "Sem navegacao anterior");
  }

  navigateForward(): void {
    this.navigateTabHistory(this.navigationForwardStack, this.navigationBackStack, "Sem navegacao futura");
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
    this.runEditorAction("editor.action.moveLinesUpAction", "Linha movida");
  }

  moveLineDown(): void {
    this.runEditorAction("editor.action.moveLinesDownAction", "Linha movida");
  }

  copyLineUp(): void {
    this.runEditorAction("editor.action.copyLinesUpAction", "Linha copiada");
  }

  copyLineDown(): void {
    this.runEditorAction("editor.action.copyLinesDownAction", "Linha copiada");
  }

  selectNextOccurrence(): void {
    this.runEditorAction("editor.action.addSelectionToNextFindMatch", "Ocorrencia selecionada");
  }

  selectAllOccurrences(): void {
    this.runEditorAction("editor.action.selectHighlights", "Ocorrencias selecionadas");
  }

  addLineComment(): void {
    this.runEditorAction("editor.action.addCommentLine", "Comentario aplicado", () => this.commentSelectedLines(true));
  }

  removeLineComment(): void {
    this.runEditorAction("editor.action.removeCommentLine", "Comentario removido", () => this.commentSelectedLines(false));
  }

 
  formatDocument(): void {
    this.runEditorAction("editor.action.formatDocument", "Formatacao solicitada");
  }

  find(): void {
    if (this.disposed || !this.editor.getModel()) {
      this.onStatus("Abra um arquivo para pesquisar");
      return;
    }
    this.editor.focus();
    // Monaco Editor 0.52 registers the Find contribution with this action id.
    if (!this.editor.getAction("actions.find")) {
      this.onStatus("A busca no editor não está disponível");
      return;
    }
    try {
      this.editor.trigger("keyboard", "actions.find", null);
      this.onStatus("Busca no arquivo aberta");
    } catch (error) {
      reportError(error, this.onStatus, "Não foi possível abrir a busca no arquivo");
    }
  }

  replace(): void {
    this.runEditorAction("editor.action.startFindReplaceAction", "Substituição no arquivo aberta");
  }

  goToLine(): void {
    this.runEditorAction("editor.action.gotoLine", "Ir para linha");
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

  layout(): void {
    this.editor.layout();
  }

  private runEditorAction(actionId: string, status?: string, fallback?: () => void): void {
    this.editor.focus();
    const action = this.editor.getAction(actionId);
    if (action) {
      void action.run();
    } else {
      this.editor.trigger("keyboard", actionId, null);
      fallback?.();
    }
    if (status) this.onStatus(status);
  }

  private commentSelectedLines(add: boolean): void {
    const model = this.editor.getModel();
    const selection = this.editor.getSelection();
    if (!model || !selection) return;

    const language = model.getLanguageId();
    const token = lineCommentToken(language);
    if (!token) {
      this.onStatus(`Comentario de linha nao configurado para ${language}`);
      return;
    }

    const startLine = selection.startLineNumber;
    const endLine =
      selection.endColumn === 1 && selection.endLineNumber > startLine
        ? selection.endLineNumber - 1
        : selection.endLineNumber;

    const edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];

    for (let line = startLine; line <= endLine; line += 1) {
      const text = model.getLineContent(line);
      const firstNonWhitespace = text.search(/\S/);
      const column = firstNonWhitespace === -1 ? 1 : firstNonWhitespace + 1;

      if (add) {
        edits.push({
          range: new monaco.Range(line, column, line, column),
          text: `${token} `
        });
        continue;
      }

      const trimmedStart = firstNonWhitespace === -1 ? 0 : firstNonWhitespace;
      const afterIndent = text.slice(trimmedStart);

      if (afterIndent.startsWith(`${token} `)) {
        edits.push({
          range: new monaco.Range(line, trimmedStart + 1, line, trimmedStart + token.length + 2),
          text: ""
        });
      } else if (afterIndent.startsWith(token)) {
        edits.push({
          range: new monaco.Range(line, trimmedStart + 1, line, trimmedStart + token.length + 1),
          text: ""
        });
      }
    }

    if (!edits.length) return;

    this.editor.executeEdits("npsharp-comment-lines", edits);
    this.editor.pushUndoStop();
  }

  private async saveTab(tab: EditorTab, forceSaveAs: boolean): Promise<void> {
    const content = tab.model.getValue();
    if (tab.saveHandler && forceSaveAs) {
      this.onStatus("Salvar como não é suportado para este formato estruturado. Salve o arquivo aberto.");
      return;
    }
    if (tab.saveHandler && !forceSaveAs) {
      await tab.saveHandler(content);
      tab.initialContent = content;
      tab.dirty = false;
      tab.encodingDirty = false;
      this.renderTabs();
      this.onStatus(`Salvo ${tab.title}`);
      this.onFileSaved(tab.path);
      return;
    }

    if (tab.path && !forceSaveAs) {
      await api.fs.writeFile(tab.path, this.applyLineEnding(content, tab.lineEnding), tab.encoding);
      tab.initialContent = content;
      tab.dirty = false;
      tab.encodingDirty = false;
      this.addRecent(tab.path);
      this.renderTabs();
      this.onStatus(`Salvo ${tab.path}`);
      this.onFileSaved(tab.path);
      return;
    }

    const result = await api.dialog.saveFile({
      suggestedName: tab.path ? basename(tab.path) : this.suggestedFileName(tab),
      content: this.applyLineEnding(content, tab.lineEnding),
      encoding: tab.encoding
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
    tab.encodingDirty = false;
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
    this.closedTabs.unshift({
      title: tab.title,
      path: tab.path,
      virtualUri: tab.virtualUri,
      content: tab.model.getValue(),
      lineEnding: tab.lineEnding,
      encoding: tab.encoding
    });
    this.closedTabs = this.closedTabs.slice(0, 20);
    const index = this.tabs.indexOf(tab);
    this.tabs.splice(index, 1);
    this.fileViewers.get(id)?.dispose();
    this.fileViewers.get(id)?.element.remove();
    this.fileViewers.delete(id);
    this.navigationBackStack = this.navigationBackStack.filter(item => item !== id);
    this.navigationForwardStack = this.navigationForwardStack.filter(item => item !== id);
    tab.model.dispose();
    const closedActiveTab = this.activeId === id;
    if (closedActiveTab) {
      const next = this.tabs[Math.max(0, index - 1)] ?? this.tabs[0];
      this.activeId = next?.id;
    }
    this.render();
    if (closedActiveTab) {
      this.onFileActivated(this.activeTab?.path);
      this.updateCaretStatus();
    }
    return true;
  }

  private selectTab(id: string): void {
    if (!this.navigatingHistory && this.activeId && this.activeId !== id) {
      this.navigationBackStack.push(this.activeId);
      this.navigationBackStack = this.navigationBackStack.slice(-50);
      this.navigationForwardStack = [];
    }
    this.activeId = id;
    const tab = this.activeTab;
    const fileViewer = tab ? this.fileViewers.get(tab.id) : undefined;
    this.editor.setModel(tab?.model ?? null);
    this.editorHost.querySelector(".monaco-editor")?.toggleAttribute("hidden", Boolean(fileViewer));
    for (const [viewerId, viewer] of this.fileViewers) viewer.setActive(viewerId === tab?.id);
    this.welcome.hidden = Boolean(tab);
    this.render();
    this.onFileActivated(tab?.path);
    this.renderErrorLens();
    this.renderBrandHighlights();
    this.renderHexColorDecorators();
    this.updateCaretStatus();
    if (!fileViewer) this.editor.focus();
  }

  private selectTabByPath(filePath: string): void {
    const tab = this.tabs.find(item => item.path === filePath);
    if (tab) this.selectTab(tab.id);
  }

  private selectTabByOffset(offset: number): void {
    if (!this.tabs.length || !this.activeId) {
      this.onStatus("Nenhuma aba aberta");
      return;
    }
    const index = this.tabs.findIndex(tab => tab.id === this.activeId);
    const nextIndex = (index + offset + this.tabs.length) % this.tabs.length;
    this.selectTab(this.tabs[nextIndex].id);
  }

  private navigateTabHistory(from: string[], to: string[], emptyMessage: string): void {
    const current = this.activeId;
    while (from.length) {
      const next = from.pop();
      if (!next || !this.tabs.some(tab => tab.id === next)) continue;
      if (current) to.push(current);
      this.navigatingHistory = true;
      try {
        this.selectTab(next);
      } finally {
        this.navigatingHistory = false;
      }
      return;
    }
    this.onStatus(emptyMessage);
  }

  private markDirtyFromEditor(): void {
    const tab = this.activeTab;
    if (!tab) return;
    const content = tab.model.getValue();
    tab.dirty = content !== tab.initialContent || Boolean(tab.encodingDirty);
    this.renderTabs();
    this.updateCaretStatus();
    this.onTabsChanged();
    this.renderBrandHighlights();
    this.renderHexColorDecorators();
  }

  private render(): void {
    if (this.disposed) return;
    this.renderTabs();
    this.welcome.hidden = Boolean(this.activeTab);
    this.onTabsChanged();
  }

  private renderTabs(): void {
    this.tabsBar.replaceChildren();
    for (const tab of this.tabs) {
      const shell = el("div", { className: "tab-shell" });
      const button = el("button", {
        className: `tab ${tab.id === this.activeId ? "active" : ""}`,
        title: tab.path ?? tab.virtualUri ?? tab.title
      });
      button.append(fileIcon(tab.title, false), el("span", { text: `${tab.dirty ? "● " : ""}${tab.title}` }));
      button.addEventListener("click", () => this.selectTab(tab.id));
      shell.append(
        button,
        buttonIcon("close", "Fechar aba", () => this.closeTab(tab.id))
      );
      this.tabsBar.append(shell);
    }

    const add = el("button", { className: "tab-action", title: "Novo arquivo", children: [icon("add", "Novo arquivo")] });
    add.addEventListener("click", () => this.newTab());
    this.tabsBar.append(add);
  }

  private buildWelcome(): void {
    const title = el("h1", { text: "NPSharp" });
    const subtitle = el("p", { text: "Código, controle e domínio" });
    const actions = el("div", { className: "welcome-actions" });
    this.welcome.append(this.welcomeLogo, title, subtitle, actions);
  }

  private updateCaretStatus(): void {
    this.onEditorStatus(this.getStatusInfo());
  }

  private renderErrorLens(): void {
    this.errorLensDecorations ??= this.editor.createDecorationsCollection();
    const tab = this.activeTab;
    if (!tab || !this.errorLensEnabled) {
      this.errorLensDecorations.clear();
      return;
    }

    const diagnosticsByLine = new Map<number, monaco.editor.IMarker[]>();
    for (const marker of monaco.editor.getModelMarkers({ resource: tab.model.uri })) {
      const line = boundedLine(tab.model, marker.startLineNumber);
      const markers = diagnosticsByLine.get(line) ?? [];
      markers.push(marker);
      diagnosticsByLine.set(line, markers);
    }

    const decorations = [...diagnosticsByLine.entries()].map(([line, markers]) => {
      const severity = highestMarkerSeverity(markers);
      const severityName = markerSeverityClass(severity);
      const color = markerColor(severity);
      const message = errorLensText(markers);
      const markdown = errorLensMarkdown(markers, severity);
      return {
        range: new monaco.Range(
          line,
          tab.model.getLineMaxColumn(line),
          line,
          tab.model.getLineMaxColumn(line)
        ),
        options: {
          isWholeLine: true,
          className: `error-lens-line error-lens-line-${severityName}`,
          linesDecorationsClassName: `error-lens-lines error-lens-lines-${severityName}`,
          glyphMarginClassName: `error-lens-glyph error-lens-glyph-${severityName}`,
          glyphMarginHoverMessage: { value: markdown },
          after: {
            content: `  ${message}`,
            inlineClassName: `error-lens error-lens-${severityName}`,
            cursorStops: monaco.editor.InjectedTextCursorStops.None
          },
          hoverMessage: { value: markdown },
          overviewRuler: { color, position: monaco.editor.OverviewRulerLane.Right },
          minimap: { color, position: monaco.editor.MinimapPosition.Inline },
          zIndex: 20
        }
      };
    });
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

  private renderHexColorDecorators(): void {
    this.colorDecorations ??= this.editor.createDecorationsCollection();
    const tab = this.activeTab;
    if (!tab || this.fileViewers.has(tab.id)) {
      this.colorDecorations.clear();
      return;
    }
    const model = tab.model;
    const decorations: monaco.editor.IModelDeltaDecoration[] = [];
    const content = model.getValue();
    for (const match of content.matchAll(HEX_COLOR_PATTERN)) {
      if (match.index === undefined) continue;
      const color = match[0];
      const start = model.getPositionAt(match.index);
      const end = model.getPositionAt(match.index + color.length);
      const colorClass = this.colorClass(color);
      decorations.push({
        range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
        options: {
          inlineClassName: colorClass,
          before: {
            content: "■ ",
            inlineClassName: `${colorClass} npsharp-hex-swatch`,
            cursorStops: monaco.editor.InjectedTextCursorStops.None
          },
          hoverMessage: { value: `Cor: \`${color}\`` }
        }
      });
    }
    this.colorDecorations.set(decorations);
  }

  private colorClass(color: string): string {
    const normalized = color.toLowerCase();
    const existing = this.colorClasses.get(normalized);
    if (existing) return existing;
    const className = `npsharp-hex-color-${this.colorClasses.size}`;
    this.colorClasses.set(normalized, className);
    this.colorStyle.append(`.${className}{color:${normalized}!important;font-weight:700;text-shadow:0 0 1px rgba(0,0,0,.72);}.${className}.npsharp-hex-swatch{display:inline-block;font-size:1.05em;line-height:1;vertical-align:middle;text-shadow:0 0 1px rgba(0,0,0,.9);}`);
    return className;
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

  private createTextModel(content: string, language: string, uri: monaco.Uri): monaco.editor.ITextModel {
    void ensureLanguageSupport(language).catch(error => reportError(error, this.onStatus, `Language support failed (${language})`));
    const model = monaco.editor.createModel(content, language, uri);
    model.updateOptions({ tabSize: this.tabSize });
    return model;
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

function encodingLabel(encoding: TextEncoding): string {
  return encoding === "utf8bom" ? "UTF-8 com BOM" : encoding === "utf8" ? "UTF-8" : encoding.toUpperCase();
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

function markerSeverityClass(severity: monaco.MarkerSeverity): string {
  switch (severity) {
    case monaco.MarkerSeverity.Error:
      return "error";
    case monaco.MarkerSeverity.Warning:
      return "warning";
    case monaco.MarkerSeverity.Info:
      return "information";
    default:
      return "hint";
  }
}

function highestMarkerSeverity(markers: monaco.editor.IMarker[]): monaco.MarkerSeverity {
  return markers.reduce((highest, marker) => Math.max(highest, marker.severity), monaco.MarkerSeverity.Hint);
}

function markerColor(severity: monaco.MarkerSeverity): string {
  switch (severity) {
    case monaco.MarkerSeverity.Error:
      return "#f14c4c";
    case monaco.MarkerSeverity.Warning:
      return "#cca700";
    case monaco.MarkerSeverity.Info:
      return "#3794ff";
    default:
      return "#8c8c8c";
  }
}

function errorLensText(markers: monaco.editor.IMarker[]): string {
  return markers.map(marker => {
    const message = marker.message.replace(/\s+/g, " ").trim();
    return marker.source ? `${message} (${marker.source})` : message;
  }).join("  •  ");
}

function errorLensMarkdown(markers: monaco.editor.IMarker[], severity: monaco.MarkerSeverity): string {
  const label = markerSeverityClass(severity).toUpperCase();
  return `**${label}**\n\n${markers.map(marker => `- ${marker.message}`).join("\n")}`;
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

function lineCommentToken(language: string): string | undefined {
  const tokens: Record<string, string> = {
    javascript: "//",
    typescript: "//",
    json: "//",
    java: "//",
    csharp: "//",
    cpp: "//",
    c: "//",
    go: "//",
    rust: "//",
    php: "//",
    kotlin: "//",
    scala: "//",
    swift: "//",
    dart: "//",
    plaintext: "//",
    css: "//",
    scss: "//",
    less: "//",
    shell: "#",
    bash: "#",
    sh: "#",
    python: "#",
    ruby: "#",
    perl: "#",
    powershell: "#",
    yaml: "#",
    markdown: "<!--",
    html: "<!--",
    xml: "<!--"
  };
  return tokens[language];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
