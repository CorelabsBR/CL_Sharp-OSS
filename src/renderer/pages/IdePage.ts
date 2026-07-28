/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { AppSettings, AppUpdateStatus, CustomShortcutBinding, EditorDiagnostic, PersistedSession, TextEncoding } from "../../shared/types";
import type { AppLocale } from "../../shared/i18n";
import { setUiLocale } from "../../shared/i18n";
import { BUILD_CONFIG } from "../../shared/buildConfig";
import { PortugolInterpreter } from "../../core/portugol/interpreter";
import { ArduinoPanel } from "../components/ArduinoPanel";
import { AIChatPanel } from "../components/AIChatPanel";
import { CommandCenter, type CommandCenterAction, type CommandCenterShortcut } from "../components/CommandCenter";
import { CommandPalette } from "../components/CommandPalette";
import { EditorTabs, type EditorStatusInfo } from "../components/EditorTabs";
import { ExtensionManagerPanel } from "../components/ExtensionManagerPanel";
import { FileExplorer } from "../components/FileExplorer";
import { KeyboardShortcutsModal } from "../components/KeyboardShortcutsModal";
import { LanguageRuntimesDialog } from "../components/LanguageRuntimesDialog";
import { RemotePanel } from "../components/RemotePanel";
import { RuntimePanel } from "../components/RuntimePanel";
import { SearchPanel } from "../components/SearchPanel";
import { SourceControlPanel } from "../components/SourceControlPanel";
import { isSafeCustomShortcut, normalizeShortcut, type ShortcutBinding } from "../shortcuts/keybindings";
import { createShortcutRegistry, type ShortcutAction } from "../shortcuts/shortcutRegistry";
import { useGlobalShortcuts, type GlobalShortcutController } from "../shortcuts/useGlobalShortcuts";
import { TerminalPanel } from "../components/TerminalPanel";
import { api, DEFAULT_MOBILE_WORKSPACE, MOBILE_ROOT, MOBILE_WORKSPACES_ROOT, platform } from "../services/api";
import { applyTheme, listThemes } from "../services/themes";
import { buttonIcon, closeContextMenus, contextMenu, el, icon, installContextMenuDismiss, localizeElementTree } from "../utils/dom";
import { errorMessage, reportError } from "../utils/errors";
import { cssUrl, DEFAULT_LOGO_URL } from "../utils/assets";
import { basename, dirname, extname, fileUri, isSubPath, joinPath, relativePath } from "../utils/path";
import type { CommandAction } from "../components/CommandPalette";

type PanelId = "explorer" | "search" | "source" | "run" | "extensions" | "remote" | "arduino" | "ai" | "settings" | "problems";
type SettingsCategory = "Appearance" | "Editor" | "Terminal" | "Diagnostics" | "Build" | "Workbench";
type MenuAction = (event: MouseEvent) => void;

const EDITOR_FONT_OPTIONS = [
  "JetBrains Mono",
  "Fira Code",
  "Cascadia Code",
  "Consolas",
  "Menlo",
  "Monaco",
  "Roboto Mono",
  "Source Code Pro",
  "Ubuntu Mono",
  "Courier New"
].map(value => ({ value, label: value }));
const EDITOR_FONT_SIZE_OPTIONS = Array.from({ length: 33 }, (_, index) => {
  const value = String(index + 8);
  return { value, label: `${value} px` };
});
const EDITOR_TAB_SIZE_OPTIONS = Array.from({ length: 12 }, (_, index) => {
  const value = String(index + 1);
  return { value, label: `${value} ${index === 0 ? "espaço" : "espaços"}` };
});

export class IdePage {
  readonly element = el("main", { className: "app-shell" });
  private readonly wallpaper = el("div", { className: "wallpaper" });
  private readonly titleBar = el("header", { className: "title-bar" });
  private readonly activityBar = el("nav", { className: "activity-bar" });
  private readonly sideBar = el("aside", { className: "side-bar" });
  private readonly sideTitle = el("div", { className: "side-title", text: "EXPLORADOR" });
  private readonly sideContent = el("div", { className: "side-content" });
  private readonly workbench = el("section", { className: "workbench" });
  private readonly editorStack = el("section", { className: "editor-stack" });
  private readonly aiDock = el("aside", { className: "ai-dock", attrs: { "aria-label": "Codex" } });
  private readonly statusLeft = el("span", { text: "Pronto" });
  private readonly statusBranch = el("button", { className: "status-item status-branch", text: "Git" });
  private readonly statusAuthor = el("span", { className: "status-meta status-author", text: "" });
  private readonly statusType = el("span", { className: "status-meta", text: "" });
  private readonly statusLineEnding = el("span", { className: "status-meta status-line-ending", text: "" });
  private readonly statusEncoding = el("button", { className: "status-item status-encoding", text: "UTF-8" });
  private readonly statusPosition = el("span", { className: "status-meta", text: "Ln 1, Col 1" });
  private readonly statusBarElement = el("footer", { className: "status-bar" });
  private readonly commandBar = el("input", { className: "command-bar", attrs: { placeholder: "Pesquisar...", "aria-label": "Pesquisa rápida de arquivos" } });
  private readonly commandCenter = new CommandCenter(workspace => void this.openRecentWorkspace(workspace));
  private readonly editor = new EditorTabs(text => this.updateStatus(text));
  private readonly explorer = new FileExplorer(
    file => void this.editor.openFile(file),
    text => this.updateStatus(text),
    () => this.settings.confirmDelete,
    value => this.updateSettings({ ...this.settings, confirmDelete: value })
  );
  private readonly search = new SearchPanel(result => void this.editor.openSearchResult(result), text => this.updateStatus(text));
  private readonly source = new SourceControlPanel((title, uri, content) => this.editor.openVirtualFile(title, uri, content), text => this.updateStatus(text));
  private readonly terminal = new TerminalPanel(() => this.terminalCwd(), text => this.updateStatus(text), () => this.closeTerminalPanel());
  private readonly aiChat = new AIChatPanel({
    workspace: () => this.explorer.workspace,
    currentFile: () => this.editor.getCurrentFile(),
    currentText: () => this.editor.getCurrentText(),
    selection: () => this.editor.getSelectedText(),
    openEditors: () => this.editor.getOpenEditorContents(),
    terminalOutput: () => this.terminal.getContextOutput(),
    gitDiff: () => this.source.getDiffContext(),
    diagnostics: () => this.diagnostics
  }, {
    insertBelow: code => this.editor.insertBelow(code),
    replaceSelection: code => this.editor.replaceSelection(code),
    replaceFile: code => this.editor.replaceCurrentFile(code),
    createNewFile: (code, language) => this.editor.newTab(code, extensionForAILanguage(language))
  }, text => this.updateStatus(text));
  private readonly languageRuntimes = new LanguageRuntimesDialog(text => this.updateStatus(text));
  private readonly runtime = new RuntimePanel(
    () => this.runCurrentFile(),
    () => this.installCurrentPythonDependencies(),
    text => this.updateStatus(text),
    () => void this.showLanguageRuntimes()
  );
  private readonly extensions = new ExtensionManagerPanel(text => this.updateStatus(text));
  private readonly remote = new RemotePanel((title, uri, content, save) => this.editor.openVirtualFile(title, uri, content, save), text => this.updateStatus(text));
  private readonly arduino = new ArduinoPanel(() => this.explorer.workspace, file => this.editor.openFile(file), text => this.updateStatus(text));
  private readonly palette = new CommandPalette();
  private readonly keyboardShortcuts = new KeyboardShortcutsModal(text => this.updateStatus(text));
  private readonly problemsPanel = el("div", { className: "panel problems-panel" });
  private settingsDialog?: HTMLElement;
  private settingsDialogPanel?: HTMLElement;
  private readonly panels = new Map<PanelId, HTMLElement>();
  private shortcuts: ShortcutBinding[] = [];
  private shortcutController?: GlobalShortcutController;
  private activePanel: PanelId = "explorer";
  private settings!: AppSettings;
  private session: PersistedSession = { openFiles: [], sidePanel: "explorer", terminalVisible: false };
  private diagnostics: EditorDiagnostic[] = [];
  private diagnosticIndex = -1;
  private settingsCategory: SettingsCategory = "Appearance";
  private settingsQuery = "";
  private appPlatform = "";
  private appInfoPath = "";
  private commandCenterForced = false;
  private focusMode = false;
  private terminalVisibleBeforeFocus = false;
  private sidebarHiddenBeforeFocus = false;
  private compactPreview = false;
  private liveServerActive = false;
  private pendingChord: string | undefined;
  private pendingChordTimer?: number;
  private updateButton?: HTMLButtonElement;
  private statusGitRequest = 0;
  private readonly disposers: Array<() => void> = [];
  private disposed = false;
  private readonly dispose = (): void => {
    if (this.disposed) return;
    this.disposed = true;
    if (this.pendingChordTimer !== undefined) {
      window.clearTimeout(this.pendingChordTimer);
      this.pendingChordTimer = undefined;
    }
    this.shortcutController?.dispose();
    this.shortcutController = undefined;
    for (const dispose of this.disposers.splice(0)) {
      dispose();
    }
    this.explorer.dispose();
    this.search.dispose();
    this.terminal.dispose();
    this.aiChat.dispose();
    this.editor.dispose();
    this.palette.close();
    this.languageRuntimes.close();
    this.keyboardShortcuts.close();
    closeContextMenus();
    document.querySelector(".html-preview-overlay")?.remove();
  };

  constructor() {
    this.handleShortcut = this.handleShortcut.bind(this);
    void this.init().catch(error => this.renderFatalError(error));
  }

  private async init(): Promise<void> {
    this.element.dataset.platform = platform.kind;
    this.settings = await api.settings.load();
    if (this.disposed) return;
    setUiLocale(this.settings.language);
    this.terminal.setEnabled(this.settings.terminalEnabled);
    this.terminal.setShell(this.terminalShell());
    this.editor.applySettings(this.settings);
    this.wireEvents();
    this.build();
    localizeElementTree(this.element);
    this.applyLayoutSettings();
    this.updateCommandCenter();
    this.registerCommands();
    void api.startup.mark("renderer-rendered");

    requestAnimationFrame(() => {
      if (this.disposed) return;
      void api.startup.mark("editor-interactive");
      void api.startup.ready();
    });
    void this.restoreStartupState();
  }

  /** Restaura recursos persistidos depois que o editor já pode receber entrada. */
  private async restoreStartupState(): Promise<void> {
    try {
      const [appInfo, session, theme] = await Promise.all([
        api.appInfo(),
        api.settings.loadSession(),
        applyTheme(this.settings)
      ]);
      if (this.disposed) return;
      this.appPlatform = appInfo.platform;
      this.appInfoPath = appInfo.npsharpHome;
      this.session = session;
      this.editor.applyTheme(theme);
      this.applyWallpaper();
      this.bindUpdater();
      await this.restoreSession();
    } catch (error) {
      reportError(error, text => this.updateStatus(text), "Falha ao restaurar a sessão");
    }
  }

  private build(): void {
    this.buildTitleBar();
    this.buildActivityBar();
    this.buildSideBar();
    const center = el("section", { className: "center-area" });
    this.editor.element.append(this.commandCenter.element);
    this.editorStack.append(this.editor.element, this.terminal.element);
    this.setTerminalVisible(this.session.terminalVisible, false);
    this.aiDock.hidden = true;
    center.append(this.activityBar, this.sideBar, this.editorStack, this.aiDock);
    this.workbench.append(center);
    this.element.append(this.wallpaper, this.titleBar, this.workbench, this.statusBar());
    this.showPanel((this.session.sidePanel as PanelId) || "explorer");
  }

  private buildTitleBar(): void {
    const logo = el("div", { className: "title-logo" });
    logo.append(el("img", { attrs: { src: DEFAULT_LOGO_URL, alt: BUILD_CONFIG.displayName } }), el("span", { text: BUILD_CONFIG.displayName }));
    const menus = el("div", { className: "title-menus" });
    const openWorkspaceLabel = platform.isMobile ? "Abrir workspace mobile" : "Abrir pasta";
    menus.append(
      menuButton("Arquivo", [
        ["Novo arquivo", "Ctrl+N", () => this.editor.newTab()],
        ["Abrir arquivo", "Ctrl+O", () => void this.editor.openFileFromDialog()],
        [openWorkspaceLabel, "Ctrl+K Ctrl+O", () => void this.explorer.openFolderFromDialog()],
        ["Fechar pasta", "", () => this.explorer.clearFolder()],
        ["Salvar", "Ctrl+S", () => void this.editor.saveCurrentFile()],
        ["Salvar como", "Ctrl+Shift+S", () => void this.editor.saveCurrentFileAs()],
        ["Salvar tudo", "", () => void this.editor.saveAll()],
        ["Reverter arquivo", "", () => void this.editor.revertCurrentFile()],
        ["Fechar editor", "Ctrl+W", () => this.editor.closeCurrentTab()],
        ["Fechar todos os editores", "Ctrl+Shift+W", () => this.editor.closeAllTabs()]
      ]),
      menuButton("Editar", [
        ["Desfazer", "Ctrl+Z", () => this.editor.undo()],
        ["Refazer", "Ctrl+Y", () => this.editor.redo()],
        ["Recortar", "Ctrl+X", () => this.editor.cut()],
        ["Copiar", "Ctrl+C", () => this.editor.copy()],
        ["Colar", "Ctrl+V", () => this.editor.paste()],
        ["Localizar", "Ctrl+F", () => this.editor.find()],
        ["Substituir", "Ctrl+H", () => this.editor.replace()],
        ["Comentar linha", "Ctrl+/", () => this.editor.addLineComment()],
        // ["Uncomment Line", "Ctrl+Shift+/", () => this.editor.removeLineComment()],
        // ["Comment Block", "Ctrl+Shift+/", () => this.editor.toggleBlockComment()],
        ["Ir para a linha", "Ctrl+G", () => this.editor.goToLine()],
        ["Ir para o início", "Ctrl+Home", () => this.editor.goToStartOfFile()],
        ["Ir para o fim", "Ctrl+End", () => this.editor.goToEndOfFile()],
        ["Formatar documento", "Shift+Alt+F", () => this.editor.formatDocument()]
      ]),
      menuButton("Seleção", [
        ["Selecionar tudo", "Ctrl+A", () => this.editor.selectAll()],
        ["Selecionar próxima ocorrência", "Ctrl+D", () => this.editor.selectNextOccurrence()],
        ["Selecionar todas as ocorrências", "Ctrl+Shift+L", () => this.editor.selectAllOccurrences()],
        ["Duplicar linha", "", () => this.editor.duplicateCurrentLine()],
        ["Excluir linha", "Ctrl+Shift+K", () => this.editor.deleteCurrentLine()],
        ["Mover linha para cima", "Alt+Up", () => this.editor.moveLineUp()],
        ["Mover linha para baixo", "Alt+Down", () => this.editor.moveLineDown()],
        ["Copiar linha para cima", "Shift+Alt+Up", () => this.editor.copyLineUp()],
        ["Copiar linha para baixo", "Shift+Alt+Down", () => this.editor.copyLineDown()]
      ]),
      menuButton("Exibir", [
        ["Paleta de comandos", "Ctrl+Shift+P", () => this.palette.showCommands()],
        ["Abertura rápida", "Ctrl+P", () => this.palette.showQuickOpen()],
        ["Explorador", "Ctrl+Shift+E", () => this.showPanel("explorer")],
        ["Pesquisar", "Ctrl+Shift+F", () => this.showPanel("search")],
        ["Controle de código-fonte", "Ctrl+Shift+G", () => this.showPanel("source")],
        ["Executar e depurar", "Ctrl+Shift+D", () => this.showPanel("run")],
        ["Arduino", "", () => this.showPanel("arduino")],
        ["Problemas", "F8", () => this.showPanel("problems")],
        ["Saída", "Ctrl+Shift+U", () => this.showOutput()],
        ["Atalhos de teclado", "Ctrl+K Ctrl+S", () => this.showKeyboardShortcuts()],
        ["Extensões", "Ctrl+Shift+X", () => this.showPanel("extensions")],
        ["Alternar barra lateral", "Ctrl+B", () => this.toggleSidebar()],
        ["Alternar terminal", "Ctrl+`", () => this.toggleTerminal()],
        ["Alternar painel", "Ctrl+J", () => this.toggleTerminal()]
      ]),
      menuButton("Executar", [
        ["Depurar arquivo atual", "F5", () => void this.runCurrentFile(true)],
        ["Executar sem depuração", "Ctrl+F5", () => void this.runWithoutDebug()],
        ["Baixar imports Python e preparar .venv", "", () => void this.installCurrentPythonDependencies()],
        ["Compilar projeto", "Ctrl+Shift+B", () => void this.buildProject()],
        ["Arduino", "", () => this.showPanel("arduino")],
        ["Caminhos dos runtimes", "", () => void this.showLanguageRuntimes()]
      ]),
      menuButton("Terminal", [
        ["Novo terminal", "Ctrl+Shift+`", () => this.showTerminal(true)],
        ["Saída", "", () => this.terminal.showOutputPanel()],
        ["Problemas", "", () => this.terminal.showProblemsPanel()],
        ["Console de depuração", "", () => this.terminal.showDebugConsole()],
        ["Portas", "", () => this.terminal.showPortsPanel()],
        ["Git", "", () => this.terminal.showGitPanel()],
        ["Limpar", "", () => this.terminal.clearCurrentTerminal()],
        ["Encerrar processo", "", () => this.terminal.killCurrentTerminal()],
        ["Fechar terminal", "", () => this.terminal.closeCurrentTerminal()]
      ]),
      menuButton("Preferências", [
        ["Paleta de comandos", "Ctrl+Shift+P", () => this.palette.showCommands()],
        ["Configurações", "Ctrl+,", () => this.showSettings()],
        ["Verificar atualizações", "", () => void this.checkForUpdates()],
        ["Configurar runtimes de linguagem", "", () => void this.showLanguageRuntimes()],
        ["Tema de cores", "", event => void this.showThemePicker(event.shiftKey)],
        ["Papel de parede", "", () => void this.chooseWallpaper()],
        ["Limpar papel de parede", "", () => void this.clearWallpaper()],
        ["Alternar ErrorLens", "", () => this.toggleErrorLens()],
        ["Sobre o NPSharp", "", () => this.about()]
      ])
    );
    this.commandBar.addEventListener("click", () => this.palette.showQuickOpen(this.commandBar.value));
    const nav = el("div", { className: "title-nav" });
    nav.append(
      buttonIcon("arrow-left", "Voltar para o arquivo anterior", () => this.editor.navigateBack()),
      buttonIcon("arrow-right", "Avançar para o próximo arquivo", () => this.editor.navigateForward()),
      buttonIcon("play", "Executar arquivo atual", () => void this.runCurrentFile()),
      // el("button", {
      //   className: "title-run-dependencies",
      //   text: "Baixar imports Python (.venv)",
      //   title: "Cria ou reutiliza o .venv do projeto e instala os imports do arquivo Python atual"
      // })
    );
    this.updateButton = el("button", {
      className: "title-update-action",
      text: "",
      attrs: { hidden: "", "aria-live": "polite" }
    });
    this.updateButton.addEventListener("click", () => void this.handleUpdateButton());
    nav.append(this.updateButton);
    nav.querySelector<HTMLButtonElement>(".title-run-dependencies")?.addEventListener("click", () => void this.installCurrentPythonDependencies());
    const windowButtons = el("div", { className: "window-buttons" });
    if (platform.isDesktop) {
      windowButtons.append(
        titleIcon("chrome-minimize", "Minimizar", () => void api.window.minimize()),
        titleIcon("chrome-maximize", "Maximizar", () => void api.window.maximize()),
        titleIcon("chrome-close", "Fechar", () => void api.window.close(), "close")
      );
    }
    this.titleBar.append(logo, menus, nav, this.commandBar, windowButtons);
  }

  private buildActivityBar(): void {
    this.activityBar.append(
      this.activityButton("explorer", "files", "Explorador"),
      this.activityButton("search", "search", "Pesquisar"),
      this.activityButton("source", "source-control", "Controle de código-fonte"),
      this.activityButton("run", "debug-alt", "Executar e depurar"),
      this.activityButton("extensions", "extensions-large", "Extensões"),
      this.activityButton("remote", "remote", "Host remoto"),
      this.activityButton("arduino", "circuit-board", "Arduino"),
      // this.activityButton("ai", "copilot-large", "AI Chat"),
      this.activityButton("problems", "warning", "Problemas"),
      el("div", { className: "activity-spacer" }),
      this.settingsActivityButton()
    );
  }

  private buildSideBar(): void {
    this.panels.set("explorer", this.explorer.element);
    this.panels.set("search", this.search.element);
    this.panels.set("source", this.source.element);
    this.panels.set("run", this.runtime.element);
    this.panels.set("extensions", this.extensions.element);
    this.panels.set("remote", this.remote.element);
    this.panels.set("arduino", this.arduino.element);
    this.panels.set("settings", this.settingsPanel());
    this.panels.set("problems", this.problemsPanel);
    this.sideBar.append(this.sideTitle, this.sideContent);
    this.renderProblems();
  }

  private statusBar(): HTMLElement {
    const status = this.statusBarElement;
    const left = el("div", { className: "status-left" });
    const right = el("div", { className: "status-right" });
    this.statusBranch.addEventListener("click", () => {
      this.showPanel("source");
      void this.refreshStatusGit();
    });
    const run = el("button", { className: "status-item", text: "Executar" });
    run.addEventListener("click", () => void this.runCurrentFile());
    const terminal = el("button", { className: "status-item", text: "Terminal" });
    terminal.addEventListener("click", () => this.toggleTerminal());
    this.statusEncoding.addEventListener("click", event => this.showEncodingMenu(event));
    left.append(this.statusBranch, run, terminal, this.statusLeft);
    right.append(this.statusAuthor, this.statusType, this.statusLineEnding, this.statusEncoding, this.statusPosition);
    status.append(left, right);
    this.updateEditorStatus(this.editor.getStatusInfo());
    return status;
  }

  private wireEvents(): void {
    this.explorer.onWorkspaceChanged = workspace => {
      this.search.setWorkspace(workspace);
      void this.source.setWorkspace(workspace);
      this.palette.setWorkspace(workspace);
      if (workspace) this.rememberWorkspace(workspace);
      this.commandBar.placeholder = this.commandLabel();
      this.updateCommandCenter();
      this.persist();
      void this.runDiagnostics();
      void this.refreshStatusGit(workspace);
    };
    this.editor.onTabsChanged = () => {
      this.palette.setQuickOpenFiles([...this.editor.getOpenFiles(), ...this.editor.getRecentFiles()]);
      this.updateCommandCenter();
      this.persist();
    };
    this.editor.onFileActivated = file => {
      if (file) void this.explorer.revealFile(file);
      this.commandBar.placeholder = this.commandLabel();
      this.updateCommandCenter();
      this.persist();
      void this.runDiagnostics();
      void this.refreshStatusGit(undefined, file);
    };
    this.editor.onEditorStatus = status => this.updateEditorStatus(status);
    this.editor.onFileSaved = () => {
      if (this.settings.compileOnSave) void this.runDiagnostics();
    };
    this.editor.onAIAction = action => {
      this.showPanel("ai");
      void this.aiChat.runAction(action);
    };
    this.palette.setFileOpener(file => void this.editor.openFile(file));
    const handleError = (event: ErrorEvent) => this.updateStatus(`Error: ${errorMessage(event.error ?? event.message)}`);
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => this.updateStatus(`Error: ${errorMessage(event.reason)}`);
    window.addEventListener("keydown", this.handleShortcut, true);
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("beforeunload", this.dispose, { once: true });
    window.addEventListener("pagehide", this.dispose, { once: true });
    this.disposers.push(
      () => window.removeEventListener("keydown", this.handleShortcut, true),
      () => window.removeEventListener("error", handleError),
      () => window.removeEventListener("unhandledrejection", handleUnhandledRejection),
      () => window.removeEventListener("beforeunload", this.dispose),
      () => window.removeEventListener("pagehide", this.dispose)
    );
    const events = window as typeof window & { npsharpEvents?: { onCommand(callback: (command: string) => void): () => void; onOpenFile(callback: (filePath: string) => void): () => void } };
    const disposeCommandListener = events.npsharpEvents?.onCommand(command => this.handleCommand(command));
    if (disposeCommandListener) this.disposers.push(disposeCommandListener);
    const disposeOpenFileListener = events.npsharpEvents?.onOpenFile(filePath => void this.editor.openFile(filePath));
    if (disposeOpenFileListener) this.disposers.push(disposeOpenFileListener);
  }

  private registerCommands(): void {
    const commands: CommandAction[] = [
      { label: "Arquivo: Novo arquivo", shortcut: "Ctrl+N", run: () => this.editor.newTab() },
      { label: "Arquivo: Abrir arquivo", shortcut: "Ctrl+O", run: () => this.editor.openFileFromDialog() },
      { label: "Arquivo: Abrir pasta", shortcut: "Ctrl+K Ctrl+O", run: () => this.explorer.openFolderFromDialog() },
      { label: "Arquivo: Salvar", shortcut: "Ctrl+S", run: () => this.editor.saveCurrentFile() },
      { label: "Arquivo: Salvar como", shortcut: "Ctrl+Shift+S", run: () => this.editor.saveCurrentFileAs() },
      { label: "Arquivo: Salvar tudo", run: () => this.editor.saveAll() },
      { label: "Arquivo: Fechar editor", shortcut: "Ctrl+W", run: () => this.editor.closeCurrentTab() },
      { label: "Arquivo: Fechar todos os editores", shortcut: "Ctrl+Shift+W", run: () => this.editor.closeAllTabs() },
      { label: "Editor: Ir para a linha", shortcut: "Ctrl+G", run: () => this.editor.goToLine() },
      { label: "Editor: Adicionar comentário de linha", shortcut: "Ctrl+/", run: () => this.editor.addLineComment() },
      { label: "Editor: Remover comentário de linha", shortcut: "Ctrl+Shift+/", run: () => this.editor.removeLineComment() },
      // { label: "Editor: Toggle Block Comment", shortcut: "Ctrl+Shift+/", run: () => this.editor.toggleBlockComment() },
      { label: "Editor: Formatar documento", shortcut: "Shift+Alt+F", run: () => this.editor.formatDocument() },
      { label: "Editor: Alternar quebra automática", shortcut: "Alt+Z", run: () => this.toggleEditorWordWrap() },
      { label: "Exibir: Explorador", shortcut: "Ctrl+Shift+E", run: () => this.showPanel("explorer") },
      { label: "Exibir: Pesquisar", shortcut: "Ctrl+Shift+F", run: () => this.showPanel("search") },
      { label: "Exibir: Controle de código-fonte", shortcut: "Ctrl+Shift+G", run: () => this.showPanel("source") },
      { label: "Exibir: Executar e depurar", shortcut: "Ctrl+Shift+D", run: () => this.showPanel("run") },
      { label: "Exibir: Extensões", shortcut: "Ctrl+Shift+X", run: () => this.showPanel("extensions") },
      { label: "Exibir: Arduino", run: () => this.showPanel("arduino") },
      { label: "IA: Abrir conversa", shortcut: "Ctrl+Alt+I", keywords: "copilot conversa assistente", run: () => this.openAIChat() },
      { label: "IA: Nova conversa", run: () => { this.openAIChat(); return this.aiChat.newConversation(); } },
      { label: "IA: Limpar conversa", run: () => this.aiChat.clearConversation() },
      { label: "IA: Alterar provedor", run: () => this.aiChat.changeProvider() },
      { label: "IA: Alterar modelo", run: () => this.aiChat.changeModel() },
      { label: "IA: Explicar seleção", run: () => this.runAIAction("explain") },
      { label: "IA: Refatorar seleção", run: () => this.runAIAction("refactor") },
      { label: "IA: Otimizar seleção", run: () => this.runAIAction("optimize") },
      { label: "IA: Gerar documentação", run: () => this.runAIAction("docs") },
      { label: "IA: Gerar testes unitários", run: () => this.runAIAction("tests") },
      { label: "IA: Corrigir erros", run: () => this.runAIAction("fix") },
      { label: "IA: Mensagem de commit", run: () => this.runAIAction("commit") },
      { label: "IA: Renomear símbolos", run: () => this.runAIAction("rename") },
      { label: "Exibir: Problemas", shortcut: "F8", run: () => this.showPanel("problems") },
      { label: "Terminal: Alternar terminal", shortcut: "Ctrl+`", run: () => this.toggleTerminal() },
      { label: "Terminal: Novo terminal", shortcut: "Ctrl+Shift+`", run: () => this.showTerminal(true) },
      { label: "Terminal: Saída", run: () => this.terminal.showOutputPanel() },
      { label: "Terminal: Console de depuração", run: () => this.terminal.showDebugConsole() },
      { label: "Executar: Depurar arquivo atual", shortcut: "F5", run: () => this.runCurrentFile(true) },
      { label: "Executar: Compilar projeto", shortcut: "Ctrl+Shift+B", run: () => this.buildProject() },
      { label: "NPSharp: Verificar atualizações", keywords: "atualização versão baixar", run: () => this.checkForUpdates() },
      { label: "Preferências: Configurações", shortcut: "Ctrl+,", run: () => this.showSettings() },
      { id: "npsharp.configureLanguageRuntimes", label: "Configurar runtimes de linguagem", keywords: "runtimes caminho executáveis", run: () => this.showLanguageRuntimes() },
      { label: "Extensões: Instalar de VSIX", keywords: "vsix extensão local instalar", run: () => this.installExtensionFromVsix() },
      { label: "Extensões: Recarregar", keywords: "recarregar gerenciador de extensões", run: () => this.reloadExtensionsCommand() },
      { label: "Extensões: Ativar", keywords: "ativar gerenciador de extensões", run: () => this.toggleExtensionCommand(true) },
      { label: "Extensões: Desativar", keywords: "desativar gerenciador de extensões", run: () => this.toggleExtensionCommand(false) },
      { label: "Extensões: Mostrar instaladas", keywords: "instaladas gerenciador de extensões", run: () => this.showInstalledExtensions() },
      { label: "Preferências: Tema de cores", run: () => this.showThemePicker() },
      { label: "Preferências: Papel de parede", run: () => this.chooseWallpaper() },
      { label: "Preferências: Remover papel de parede", run: () => this.clearWallpaper() },
      { label: "Preferências: Alternar ErrorLens", run: () => this.toggleErrorLens() },
      { label: "Notas: Mostrar notas", run: () => this.openNotes() },
      { label: "Pesquisar: Localizar", shortcut: "Ctrl+F", run: () => this.editor.find() },
      { label: "Pesquisar: Substituir", shortcut: "Ctrl+H", run: () => this.editor.replace() },
      { label: "Pesquisar: Localizar no workspace", shortcut: "Ctrl+Shift+F", run: () => this.showPanel("search") },
      { label: "Editor: Comentar linha", shortcut: "Ctrl+/", run: () => this.editor.addLineComment() },
      { label: "Editor: Adicionar comentário de linha", shortcut: "Ctrl+K Ctrl+C", run: () => this.editor.addLineComment() },
      // { label: "Editor: Remove Line Comment", shortcut: "Ctrl+K Ctrl+U", run: () => this.editor.removeLineComment() },
      // { label: "Editor: Toggle Block Comment", shortcut: "Shift+Alt+A", run: () => this.editor.toggleBlockComment() },

      { label: "Exibir: Paleta de comandos", shortcut: "Ctrl+Shift+P", run: () => this.palette.showCommands() },
      { label: "Exibir: Abertura rápida", shortcut: "Ctrl+P", run: () => this.palette.showQuickOpen() },
      { label: "Exibir: Explorador", shortcut: "Ctrl+Shift+E", run: () => this.showPanel("explorer") },
      { label: "Exibir: Controle de código-fonte", shortcut: "Ctrl+Shift+G", run: () => this.showPanel("source") },
      { label: "Exibir: Extensões", shortcut: "Ctrl+Shift+X", run: () => this.showPanel("extensions") },
      { label: "Exibir: Problemas", shortcut: "Ctrl+Shift+M", run: () => this.showPanel("problems") },
      { label: "Exibir: Alternar barra lateral", shortcut: "Ctrl+B", run: () => this.toggleSidebar() },
      { label: "Terminal: Alternar terminal", shortcut: "Ctrl+`", run: () => this.toggleTerminal() },
      { label: "Terminal: Novo terminal", shortcut: "Ctrl+Shift+`", run: () => this.showTerminal(true) },
      { label: "Terminal: Limpar", shortcut: "Ctrl+Alt+K", run: () => this.terminal.clearCurrentTerminal() },
      { label: "Executar: Depurar arquivo atual", shortcut: "F5", run: () => this.runCurrentFile(true) },
      { label: "Executar: Compilar projeto", shortcut: "Ctrl+Shift+B", run: () => this.buildProject() },
      { label: "NPSharp: Notas", shortcut: "Ctrl+Alt+N", run: () => this.openNotes() },
      { label: "NPSharp: Central de comandos", shortcut: "Ctrl+Alt+C", run: () => this.updateStatus("Central de comandos") },
      { label: "NPSharp: Seletor de temas", shortcut: "Ctrl+Alt+T", run: () => this.showThemePicker() },
    ];
    this.palette.setCommands(commands);
    this.refreshShortcuts();
  }

  private refreshShortcuts(): void {
    this.shortcutController?.dispose();
    this.shortcuts = createShortcutRegistry({
      actions: this.shortcutActions(),
      when: { canCloseTransient: () => this.canCloseTransient() },
      customBindings: this.customKeyboardShortcuts()
    });
    this.shortcutController = useGlobalShortcuts(this.shortcuts, { updateStatus: text => this.updateStatus(text) });
    this.editor.registerMonacoShortcuts(this.shortcuts);
    this.updateCommandCenter();
  }

  private shortcutActions(): Record<string, ShortcutAction> {
    return {
      "file.new": () => this.editor.newTab(),
      "file.open": () => this.editor.openFileFromDialog(),
      "file.openWorkspace": () => this.explorer.openFolderFromDialog(),
      "file.save": () => this.editor.saveCurrentFile(),
      "file.saveAs": () => this.editor.saveCurrentFileAs(),
      "file.closeEditor": () => this.editor.closeCurrentTab(),
      "file.reopenClosedEditor": () => this.editor.reopenClosedTab(),
      "file.newWindow": () => this.openNewWindow(),
      "file.recentWorkspaces": () => this.showRecentWorkspaces(),
      "search.findInFile": () => this.editor.find(),
      "search.replaceInFile": () => this.editor.replace(),
      "search.findInWorkspace": () => this.openGlobalSearch(),
      "search.replaceInWorkspace": () => this.openGlobalReplace(),
      "search.nextMatch": () => this.editor.runMonacoAction("editor.action.nextMatchFindAction"),
      "search.previousMatch": () => this.editor.runMonacoAction("editor.action.previousMatchFindAction"),
      "view.closeTransient": () => this.closeTransient(),
      "editor.toggleLineComment": () => this.editor.runMonacoAction("editor.action.commentLine"),
      "editor.addLineComment": () => this.editor.addLineComment(),
      "editor.removeLineComment": () => this.editor.removeLineComment(),
      "editor.toggleBlockComment": () => this.editor.runMonacoAction("editor.action.blockComment"),
      "editor.goToLine": () => this.editor.goToLine(),
      "editor.selectNextOccurrence": () => this.editor.selectNextOccurrence(),
      "editor.selectAllOccurrences": () => this.editor.selectAllOccurrences(),
      "editor.moveLineUp": () => this.editor.moveLineUp(),
      "editor.moveLineDown": () => this.editor.moveLineDown(),
      "editor.copyLineUp": () => this.editor.copyLineUp(),
      "editor.copyLineDown": () => this.editor.copyLineDown(),
      "editor.insertLineBelow": () => this.editor.runMonacoAction("editor.action.insertLineAfter"),
      "editor.insertLineAbove": () => this.editor.runMonacoAction("editor.action.insertLineBefore"),
      "editor.renameSymbol": () => this.editor.runMonacoAction("editor.action.rename"),
      "editor.goToDefinition": () => this.editor.runMonacoAction("editor.action.revealDefinition"),
      "editor.peekDefinition": () => this.editor.runMonacoAction("editor.action.peekDefinition"),
      "editor.triggerSuggest": () => this.editor.runMonacoAction("editor.action.triggerSuggest"),
      "editor.fileSymbols": () => this.editor.runMonacoAction("editor.action.quickOutline"),
      "editor.toggleWordWrap": () => this.toggleEditorWordWrap(),
      "view.quickOpen": () => this.palette.showQuickOpen(),
      "view.commandPalette": () => this.palette.showCommands(),
      "view.toggleTerminal": () => this.toggleTerminal(),
      "view.toggleSidebar": () => this.toggleSidebar(),
      "view.toggleBottomPanel": () => this.setTerminalVisible(this.terminal.element.hidden),
      "view.nextTab": () => this.editor.nextTab(),
      "view.previousTab": () => this.editor.previousTab(),
      "view.navigateBack": () => this.editor.navigateBack(),
      "view.navigateForward": () => this.editor.navigateForward(),
      "view.keyboardShortcuts": () => this.showKeyboardShortcuts(),
      "view.problems": () => this.showPanel("problems"),
      "view.output": () => this.showOutput(),
      "view.settings": () => this.showSettings(),
      "view.explorer": () => this.showPanel("explorer"),
      "view.sourceControl": () => this.showPanel("source"),
      "view.extensions": () => this.showPanel("extensions"),
      "run.debug": () => this.runCurrentFile(true),
      "run.withoutDebug": () => this.runWithoutDebug(),
      "run.build": () => this.buildProject(),
      "npsharp.notes": () => this.openNotes(),
      "npsharp.commandCenter": () => this.openCommandCenter(),
      "npsharp.themeLab": () => this.showThemePicker(true),
      "npsharp.focusMode": () => this.toggleFocusMode(),
      "npsharp.projectHealth": () => this.openProjectHealth(),
      "npsharp.liveServer": () => this.toggleLiveServer(),
      "npsharp.runDetected": () => this.runCurrentFile(),
      "npsharp.gitQuickActions": () => this.showGitQuickActions(),
      "npsharp.mobileLayout": () => this.toggleCompactPreview(),
      "npsharp.clearTemporaryPanels": () => this.clearTemporaryPanels(),
      "npsharp.snapshot": () => this.snapshotWorkspace(),
      "fallback.unavailable": () => this.updateStatus("Atalho indisponível neste contexto")
    };
  }

  private customKeyboardShortcuts(): CustomShortcutBinding[] {
    return Array.isArray(this.settings.keyboardShortcuts) ? this.settings.keyboardShortcuts : [];
  }

  private async createKeyboardShortcut(commandId: string, key: string): Promise<readonly ShortcutBinding[]> {
    const normalized = normalizeShortcut(key);
    if (!isSafeCustomShortcut(normalized)) throw new Error("Atalho inválido");
    if (!this.shortcuts.some(shortcut => !shortcut.custom && shortcut.id === commandId)) {
      throw new Error("Comando não encontrado");
    }
    if (this.shortcuts.some(shortcut => shortcut.keys.includes(normalized))) {
      throw new Error(`O atalho ${normalized} já está em uso`);
    }
    const firstKey = normalized.split(" ")[0];
    if (normalized.includes(" ") && this.shortcuts.some(shortcut => shortcut.keys.includes(firstKey))) {
      throw new Error(`A primeira combinação ${firstKey} já está em uso`);
    }
    const custom = this.customKeyboardShortcuts();
    this.settings = await api.settings.save({
      ...this.settings,
      keyboardShortcuts: [...custom, { commandId, key: normalized }]
    });
    this.refreshShortcuts();
    this.updateStatus(`Atalho ${normalized} salvo globalmente`);
    return this.shortcuts;
  }

  private async removeKeyboardShortcut(commandId: string, key: string): Promise<readonly ShortcutBinding[]> {
    const normalized = normalizeShortcut(key);
    const custom = this.customKeyboardShortcuts();
    const next = custom.filter(binding => binding.commandId !== commandId || normalizeShortcut(binding.key) !== normalized);
    if (next.length === custom.length) throw new Error("Atalho personalizado não encontrado");
    this.settings = await api.settings.save({ ...this.settings, keyboardShortcuts: next });
    this.refreshShortcuts();
    this.updateStatus(`Atalho ${normalized} removido`);
    return this.shortcuts;
  }

  private async restoreSession(): Promise<void> {
    try {
      if (this.settings.restoreWorkspaceOnStartup && this.session.workspace && await api.fs.exists(this.session.workspace)) {
        if (this.disposed) return;
        await this.explorer.openFolder(this.session.workspace);
      }
      if (this.disposed) return;
      await this.editor.restoreFiles(this.session.openFiles, this.session.activeFile);
      if (this.disposed) return;
      this.showPanel((this.session.sidePanel as PanelId) || "explorer");
      this.setTerminalVisible(this.session.terminalVisible, false);
      this.updateCommandCenter();
    } catch (error) {
      reportError(error, text => this.updateStatus(text), "Restore session failed");
    }
  }

  private showPanel(panelId: PanelId): void {
    this.commandCenterForced = false;
    this.activePanel = panelId;
    const showAiDock = panelId === "ai";
    this.aiDock.hidden = !showAiDock;
    if (showAiDock) this.aiDock.replaceChildren(this.aiChat.element);
    this.sideBar.hidden = false;
    if (!showAiDock) {
      this.sideContent.replaceChildren(this.panels.get(panelId) ?? this.explorer.element);
      this.sideTitle.textContent = panelTitle(panelId);
    }
    for (const button of this.activityBar.querySelectorAll<HTMLElement>(".activity-button")) {
      button.classList.toggle("active", button.dataset.panel === panelId);
    }
    if (panelId === "search") this.search.focus();
    if (panelId === "source") void this.source.refresh();
    if (panelId === "run") void this.runtime.refresh();
    if (panelId === "extensions") void this.extensions.refresh();
    if (panelId === "remote") void this.remote.refresh();
    if (panelId === "arduino") void this.arduino.refresh();
    if (panelId === "ai") this.aiChat.focusInput();
    this.updateCommandCenter();
    this.updateStatus(panelTitle(panelId));
    this.persist();
  }

  private openGlobalSearch(): void {
    this.showPanel("search");
    this.search.focus();
    this.updateStatus("Busca global aberta");
  }

  private openAIChat(): void {
    this.showPanel("ai");
    this.aiChat.focusInput();
  }

  private runAIAction(action: string): void {
    this.openAIChat();
    void this.aiChat.runAction(action);
  }

  private openGlobalReplace(): void {
    this.showPanel("search");
    this.search.focusReplace();
    this.updateStatus("Substituição global aberta");
  }

  private showKeyboardShortcuts(): void {
    this.keyboardShortcuts.show(this.shortcuts, {
      create: (commandId, key) => this.createKeyboardShortcut(commandId, key),
      remove: (commandId, key) => this.removeKeyboardShortcut(commandId, key)
    });
  }

  private openCommandCenter(): void {
    this.commandCenterForced = true;
    this.updateCommandCenter();
    this.updateStatus("Central de comandos aberta");
  }

  private showOutput(): void {
    this.setTerminalVisible(true);
    this.terminal.showOutputPanel();
    this.updateStatus("Saída aberta");
  }

  private async showLanguageRuntimes(): Promise<void> {
    await this.languageRuntimes.show();
    this.updateStatus("Configurar runtimes de linguagem");
  }

  private async installExtensionFromVsix(): Promise<void> {
    this.showPanel("extensions");
    await this.extensions.installFromVsix();
  }

  private async showInstalledExtensions(): Promise<void> {
    this.showPanel("extensions");
    await this.extensions.refresh();
    this.extensions.focusSearch();
    this.updateStatus("Extensões instaladas");
  }

  private async reloadExtensionsCommand(): Promise<void> {
    this.showPanel("extensions");
    const installed = await this.extensions.refresh();
    if (!installed.length) {
      await this.extensions.reload();
      return;
    }
    this.palette.showPicker("Recarregar extensão", [
      { label: "Extensões: Recarregar todas", hint: `${installed.length} instaladas`, run: async () => { await this.extensions.reload(); } },
      ...installed.map(extension => ({
        label: extension.displayName,
        hint: extension.id,
        keywords: extension.description,
        run: async () => { await this.extensions.reload(extension.id); }
      }))
    ]);
  }

  private async toggleExtensionCommand(enabled: boolean): Promise<void> {
    this.showPanel("extensions");
    const installed = await api.extensions.list();
    const candidates = installed.filter(extension => extension.enabled !== enabled);
    if (!candidates.length) {
      this.updateStatus(enabled ? "Não há extensões desativadas" : "Não há extensões ativadas");
      return;
    }
    this.palette.showPicker(enabled ? "Ativar extensão" : "Desativar extensão", candidates.map(extension => ({
      label: extension.displayName,
      hint: extension.id,
      keywords: extension.description,
      run: async () => {
        await (enabled ? api.extensions.enable(extension.id) : api.extensions.disable(extension.id));
        await this.extensions.refresh();
        this.updateStatus(`${enabled ? "Ativada" : "Desativada"}: ${extension.displayName}`);
      }
    })));
  }

  private canCloseTransient(): boolean {
    return Boolean(this.settingsDialog?.isConnected) || this.keyboardShortcuts.visible || Boolean(document.querySelector(".palette-overlay")) || this.commandCenterForced || (this.activePanel === "search" && !this.sideBar.hidden);
  }

  private closeTransient(): void {
    if (this.settingsDialog?.isConnected) {
      this.closeSettingsDialog();
      return;
    }
    if (this.keyboardShortcuts.visible) {
      this.keyboardShortcuts.close();
      this.updateStatus("Atalhos de teclado fechados");
      return;
    }
    if (document.querySelector(".palette-overlay")) {
      this.palette.close();
      this.updateStatus("Palette fechada");
      return;
    }
    if (this.commandCenterForced) {
      this.commandCenterForced = false;
      this.updateCommandCenter();
      this.updateStatus("Command Center fechado");
      return;
    }
    if (this.activePanel === "search" && !this.sideBar.hidden) {
      this.showPanel("explorer");
      this.updateStatus("Busca fechada");
    }
  }

  private showSettings(category?: SettingsCategory): void {
    if (category) this.settingsCategory = category;
    this.closeSettingsDialog();
    const overlay = el("div", { className: "settings-overlay" });
    const dialog = el("section", { className: "settings-dialog", attrs: { "aria-label": "Configurações" } });
    const header = el("header", { className: "settings-dialog-header" });
    header.append(
      el("div", { children: [el("h2", { text: "Configurações" }), el("span", { text: "Preferências do NPSharp" })] }),
      el("button", { className: "icon-button", text: "×", attrs: { title: "Fechar" } })
    );
    const close = header.querySelector<HTMLButtonElement>("button")!;
    close.addEventListener("click", () => this.closeSettingsDialog());
    const panel = this.settingsPanel();
    overlay.addEventListener("click", event => {
      if (event.target === overlay) this.closeSettingsDialog();
    });
    overlay.addEventListener("keydown", event => {
      if (event.key === "Escape") this.closeSettingsDialog();
    });
    dialog.append(header, panel);
    overlay.append(dialog);
    document.body.append(overlay);
    this.settingsDialog = overlay;
    this.settingsDialogPanel = panel;
    void this.renderSettings(panel);
    this.updateStatus("Configurações abertas");
  }

  private closeSettingsDialog(): void {
    this.settingsDialog?.remove();
    this.settingsDialog = undefined;
    this.settingsDialogPanel = undefined;
    this.updateStatus("Configurações fechadas");
  }

  private activityButton(panelId: PanelId, iconName: string, title: string): HTMLButtonElement {
    const button = el("button", { className: "activity-button", title, attrs: { "data-panel": panelId }, children: [icon(iconName, title)] });
    button.addEventListener("click", () => {
      if (this.activePanel === panelId && !this.sideBar.hidden) this.toggleSidebar();
      else this.showPanel(panelId);
    });
    return button;
  }

  private settingsActivityButton(): HTMLButtonElement {
    const button = el("button", { className: "activity-button", title: "Gerenciar", children: [icon("settings-gear", "Gerenciar")] });
    button.addEventListener("click", event => {
      event.stopPropagation();
      this.showSettingsMenu(button);
    });
    return button;
  }

  private showSettingsMenu(anchor: HTMLElement): void {
    closeContextMenus();
    const rect = anchor.getBoundingClientRect();
    const menu = el("div", { className: "context-menu manage-menu" });
    menu.addEventListener("click", event => event.stopPropagation());

    let close = () => menu.remove();
    const addSeparator = () => menu.append(el("div", { className: "menu-separator" }));
    const addRow = (label: string, shortcut = "", action?: MenuAction, className = ""): HTMLButtonElement => {
      const row = el("button", { className: `menu-row ${className}`.trim() });
      row.append(el("span", { text: label }), el("span", { className: "menu-shortcut", text: shortcut }));
      if (action) {
        row.addEventListener("click", event => {
          close();
          action(event);
        });
      } else {
        row.disabled = true;
      }
      menu.append(row);
      return row;
    };

    addRow("Paleta de comandos...", "Ctrl+Shift+P", () => this.palette.showCommands());
    addRow("Configurações", "Ctrl+,", () => this.showSettings());
    addRow("Configurar runtimes de linguagem", "", () => void this.showLanguageRuntimes());
    addRow("Extensões", "Ctrl+Shift+X", () => this.showPanel("extensions"));
    addRow("Atalhos de teclado", "Ctrl+K Ctrl+S", () => this.showKeyboardShortcuts());
    addRow("Trechos", "", () => this.updateStatus("Trechos"));
    addRow("Tarefas", "", () => this.updateStatus("Tarefas"));
    addSeparator();

    const appearance = el("div", { className: "manage-submenu" });
    appearance.hidden = true;
    const appearanceRow = addRow("Aparencia", ">", undefined);
    appearanceRow.disabled = false;
    appearanceRow.addEventListener("click", event => {
      event.stopPropagation();
      appearance.hidden = !appearance.hidden;
    });
    const addAppearanceRow = (label: string, shortcut: string, action: MenuAction) => {
      const row = el("button", { className: "menu-row submenu-row" });
      row.append(el("span", { text: label }), el("span", { className: "menu-shortcut", text: shortcut }));
      row.addEventListener("click", event => {
        close();
        action(event);
      });
      appearance.append(row);
    };
    addAppearanceRow("Tema de cores...", "Escolher", event => void this.showThemePicker(event.shiftKey));
    addAppearanceRow("Wallpaper...", "Escolher", () => void this.chooseWallpaper());
    addAppearanceRow("Remover papel de parede", "", () => void this.clearWallpaper());
    menu.append(appearance);

    addRow(this.settings.errorLensEnabled ? "Desativar ErrorLens" : "Ativar ErrorLens", "", () => this.toggleErrorLens());
    addSeparator();
    addRow("Backup e sincronização de configurações...", "", () => this.updateStatus("Backup e sincronização de configurações"));
    addRow("Baixar atualização (1)");

    document.body.append(menu);
    close = installContextMenuDismiss(menu);
    const left = Math.min(rect.right + 2, window.innerWidth - menu.offsetWidth - 8);
    const top = Math.min(rect.top, window.innerHeight - menu.offsetHeight - 8);
    menu.style.left = `${Math.max(8, left)}px`;
    menu.style.top = `${Math.max(8, top)}px`;
  }

  private settingsPanel(): HTMLElement {
    const panel = el("div", { className: "panel settings-panel" });
    void this.renderSettings(panel);
    return panel;
  }

  private async renderSettings(panel: HTMLElement): Promise<void> {
    panel.replaceChildren();

    const search = el("input", {
      className: "settings-search panel-input",
      attrs: { placeholder: "Pesquisar configurações", value: this.settingsQuery }
    });
    const layout = el("div", { className: "settings-view" });
    const categories = el("div", { className: "settings-categories" });
    const page = el("div", { className: "settings-page" });
    const categoryNames: SettingsCategory[] = ["Appearance", "Editor", "Terminal", "Diagnostics", "Build", "Workbench"];
    const categoryLabels: Record<SettingsCategory, string> = {
      Appearance: "Aparência", Editor: "Editor", Terminal: "Terminal", Diagnostics: "Diagnósticos", Build: "Compilação", Workbench: "Área de trabalho"
    };

    for (const category of categoryNames) {
      const button = el("button", { className: `settings-category ${category === this.settingsCategory ? "active" : ""}`, text: categoryLabels[category] });
      button.addEventListener("click", () => {
        this.settingsCategory = category;
        this.settingsQuery = "";
        void this.renderSettings(panel);
      });
      categories.append(button);
    }

    search.addEventListener("input", () => {
      this.settingsQuery = search.value;
      void this.renderSettingsPage(page);
    });

    layout.append(categories, page);
    panel.append(search, layout, settingsFooter(
      () => void this.resetSettings(),
      () => this.updateStatus("Configurações salvas")
    ));
    await this.renderSettingsPage(page);
  }

  private async showThemePicker(includeSpecial = false): Promise<void> {
    try {
      const themes = await listThemes();
      const visibleThemes = themes.filter(theme => includeSpecial || !theme.special);
      this.palette.showPicker("Selecionar tema de cores", visibleThemes.map(theme => {
        const active = theme.id === this.settings.theme || theme.name === this.settings.theme;
        return {
          label: theme.name,
          hint: active ? "Atual" : theme.special ? "Especial" : theme.uiTheme === "vs" ? "Claro" : "Escuro",
          active,
          swatch: theme.colors["--accent"],
          run: () => this.updateSettings({ ...this.settings, theme: theme.id })
        };
      }));
    } catch (error) {
      reportError(error, text => this.updateStatus(text), "Falha no seletor de temas");
    }
  }

  private async renderSettingsPage(page: HTMLElement): Promise<void> {
    page.replaceChildren();
    const query = this.settingsQuery.trim().toLowerCase();
    const themes = await listThemes();
    const regularThemes = themes.filter(theme => !theme.special);
    const themeOptions = regularThemes.map(theme => ({ value: theme.id, label: theme.name }));

    if (query) {
      page.append(el("h2", { className: "settings-page-title", text: "Resultados da pesquisa" }));
      const beforeCount = page.childElementCount;
      this.appendSearchSetting(page, query, "theme appearance color", () =>
        settingSelect("Tema", "Tema visual da interface.", this.settings.theme, themeOptions, value => void this.updateSettings({ ...this.settings, theme: value }))
      );
      this.appendSearchSetting(page, query, "font editor family", () =>
        settingSelect("Fonte do editor", "Fonte usada no editor.", this.settings.editorFontFamily, editorFontOptions(this.settings.editorFontFamily), value => void this.updateSettings({ ...this.settings, editorFontFamily: value }))
      );
      this.appendSearchSetting(page, query, "font size editor", () =>
        settingSelect("Tamanho da fonte", "Tamanho usado no editor.", String(this.settings.editorFontSize), EDITOR_FONT_SIZE_OPTIONS, value => void this.updateSettings({ ...this.settings, editorFontSize: Number(value) }))
      );
      this.appendSearchSetting(page, query, "tab tabulation indent indentation editor", () =>
        settingSelect("Tamanho do tab", "Largura de cada tabulação no editor.", String(this.settings.editorTabSize), EDITOR_TAB_SIZE_OPTIONS, value => void this.updateSettings({ ...this.settings, editorTabSize: Number(value) }))
      );
      this.appendSearchSetting(page, query, "brand special custom pink highlight editor", () =>
        settingText("Nome especial da marca", "Destaque personalizado da marca em rosa.", this.settings.brandSpecialName, value => void this.updateSettings({ ...this.settings, brandSpecialName: value.trim() }))
      );
      this.appendSearchSetting(page, query, "word wrap editor", () =>
        settingToggle("Quebra automática", "Quebra linhas longas.", this.settings.editorWordWrap, value => void this.updateSettings({ ...this.settings, editorWordWrap: value }))
      );
      this.appendSearchSetting(page, query, "terminal shell", () =>
        settingToggle("Terminal ativado", "Ativa o terminal integrado.", this.settings.terminalEnabled, value => void this.updateSettings({ ...this.settings, terminalEnabled: value }))
      );
      this.appendSearchSetting(page, query, "diagnostics errorlens errors warnings inline", () =>
        settingToggle("ErrorLens ativado", "Mostra diagnósticos na linha.", this.settings.errorLensEnabled, value => void this.updateSettings({ ...this.settings, errorLensEnabled: value }))
      );
      this.appendSearchSetting(page, query, "compile save diagnostics", () =>
        settingToggle("Compilar ao salvar", "Compila Java ao salvar.", this.settings.compileOnSave, value => void this.updateSettings({ ...this.settings, compileOnSave: value }))
      );
      this.appendSearchSetting(page, query, "build command maven", () =>
        settingText("Comando de compilação", "Comando usado para compilar.", this.settings.buildCommand, value => void this.updateSettings({ ...this.settings, buildCommand: value.trim() || "mvn -q -DskipTests compile" }))
      );
      if (page.childElementCount === beforeCount) page.append(el("div", { className: "muted-row", text: "Nenhuma configuração encontrada." }));
      return;
    }

    page.append(el("h2", { className: "settings-page-title", text: ({ Appearance: "Aparência", Editor: "Editor", Terminal: "Terminal", Diagnostics: "Diagnósticos", Build: "Compilação", Workbench: "Área de trabalho" } as Record<SettingsCategory, string>)[this.settingsCategory] }));

    if (this.settingsCategory === "Appearance") {
      const languages = await api.i18n.availableLanguages();
      page.append(settingSelect("Idioma", "Escolha o idioma da interface. A aplicação será recarregada.", this.settings.language, languages.map(language => ({ value: language.code, label: language.label })), value => void this.setLanguage(value as AppLocale)));
      const themeList = el("div", { className: "settings-list" });
      for (const theme of regularThemes) {
        const active = theme.id === this.settings.theme || theme.name === this.settings.theme;
        const row = el("button", { className: `theme-row ${active ? "active" : ""}` });
        const swatch = el("span", { className: "theme-swatch" });
        swatch.style.background = theme.colors["--accent"];
        row.append(swatch, el("span", { className: "theme-name", text: theme.name }));
        if (theme.special) row.append(el("span", { className: "theme-badge", text: "Especial" }));
        row.addEventListener("click", () => void this.updateSettings({ ...this.settings, theme: theme.id }));
        themeList.append(row);
      }
      page.append(themeList);
      page.append(settingSelect("Tema de ícones", "Default preserva as cores dos ícones; Monocromático usa a cor definida abaixo.", this.settings.iconTheme, [
        { value: "default", label: "Padrão" },
        { value: "minimal", label: "Monocromático" }
      ], value => void this.updateSettings({ ...this.settings, iconTheme: value })));
      page.append(settingText("Cor dos ícones", "Cor CSS usada pelo tema de ícones monocromático, por exemplo #c5c5c5.", this.settings.iconColor, value => void this.updateSettings({ ...this.settings, iconColor: value.trim() })));
      page.append(settingText("Caminho do papel de parede", "Caminho da imagem de fundo.", this.settings.wallpaperPath, value => void this.updateSettings({ ...this.settings, wallpaperPath: value.trim() })));
      page.append(settingNumber("Opacidade do papel de parede", "Opacidade da imagem de fundo.", this.settings.wallpaperOpacity, 0, 1, 0.05, value => void this.updateSettings({ ...this.settings, wallpaperOpacity: value })));
      const actions = el("div", { className: "settings-inline-actions" });
      const choose = el("button", { className: "wide-action", text: "Escolher papel de parede" });
      choose.addEventListener("click", () => void this.chooseWallpaper());
      const clear = el("button", { className: "wide-action", text: "Remover papel de parede" });
      clear.addEventListener("click", () => void this.clearWallpaper());
      actions.append(choose, clear);
      page.append(actions);
      return;
    }

    if (this.settingsCategory === "Editor") {
      page.append(settingSelect("Fonte", "Fonte usada no editor.", this.settings.editorFontFamily, editorFontOptions(this.settings.editorFontFamily), value => void this.updateSettings({ ...this.settings, editorFontFamily: value })));
      page.append(settingSelect("Tamanho da fonte", "Tamanho usado no editor.", String(this.settings.editorFontSize), EDITOR_FONT_SIZE_OPTIONS, value => void this.updateSettings({ ...this.settings, editorFontSize: Number(value) })));
      page.append(settingSelect("Tamanho do tab", "Largura de cada tabulação no editor.", String(this.settings.editorTabSize), EDITOR_TAB_SIZE_OPTIONS, value => void this.updateSettings({ ...this.settings, editorTabSize: Number(value) })));
      page.append(settingToggle("Quebra automática", "Quebra linhas longas.", this.settings.editorWordWrap, value => void this.updateSettings({ ...this.settings, editorWordWrap: value })));
      page.append(settingToggle("Números de linha", "Mostra os números das linhas.", this.settings.editorLineNumbers, value => void this.updateSettings({ ...this.settings, editorLineNumbers: value })));
      page.append(settingToggle("Salvar automaticamente", "Salva automaticamente.", this.settings.editorAutoSave, value => void this.updateSettings({ ...this.settings, editorAutoSave: value })));
      page.append(settingToggle("Formatar ao salvar", "Formata ao salvar.", this.settings.editorFormatOnSave, value => void this.updateSettings({ ...this.settings, editorFormatOnSave: value })));
      page.append(settingText("Nome especial da marca", "Destaque personalizado da marca em rosa.", this.settings.brandSpecialName, value => void this.updateSettings({ ...this.settings, brandSpecialName: value.trim() })));
      return;
    }

    if (this.settingsCategory === "Terminal") {
      const shellOptions = await this.terminalShellOptionsForSettings();
      page.append(settingToggle("Terminal ativado", "Ativa o terminal integrado.", this.settings.terminalEnabled, value => void this.updateSettings({ ...this.settings, terminalEnabled: value })));
      if (this.appPlatform === "win32" && shellOptions.length) {
        page.append(settingSelect("Shell do Windows", "Shell padrão no Windows.", this.settings.terminalShellWindows, shellOptions, value => void this.updateSettings({ ...this.settings, terminalShellWindows: value })));
      } else if (this.appPlatform !== "win32" && shellOptions.length) {
        page.append(settingSelect("Shell do Linux/macOS", "Shell padrão no Linux e macOS.", this.settings.terminalShellLinux, shellOptions, value => void this.updateSettings({ ...this.settings, terminalShellLinux: value })));
      } else {
        page.append(settingText("Shell do Linux/macOS", "Shell padrão no Linux e macOS.", this.settings.terminalShellLinux, value => void this.updateSettings({ ...this.settings, terminalShellLinux: value.trim() || "/bin/bash" })));
        page.append(settingText("Shell do Windows", "Shell padrão no Windows.", this.settings.terminalShellWindows, value => void this.updateSettings({ ...this.settings, terminalShellWindows: value.trim() || "powershell.exe" })));
      }
      page.append(settingText("Diretório inicial", "Diretório inicial do terminal.", this.settings.terminalInitialDirectory, value => void this.updateSettings({ ...this.settings, terminalInitialDirectory: value.trim() })));
      return;
    }

    if (this.settingsCategory === "Diagnostics") {
      page.append(settingToggle("Diagnósticos ativados", "Ativa diagnósticos.", this.settings.diagnosticsEnabled, value => void this.updateSettings({ ...this.settings, diagnosticsEnabled: value })));
      page.append(settingToggle("ErrorLens ativado", "Mostra diagnósticos na linha no editor.", this.settings.errorLensEnabled, value => void this.updateSettings({ ...this.settings, errorLensEnabled: value })));
      page.append(settingToggle("Compilar ao salvar", "Compila Java ao salvar.", this.settings.compileOnSave, value => void this.updateSettings({ ...this.settings, compileOnSave: value })));
      page.append(settingToggle("Abrir problemas automaticamente", "Abre Problemas quando os diagnósticos falham.", this.settings.problemsAutoOpen, value => void this.updateSettings({ ...this.settings, problemsAutoOpen: value })));
      return;
    }

    if (this.settingsCategory === "Build") {
      page.append(settingText("Comando de compilação", "Comando usado para compilar o projeto.", this.settings.buildCommand, value => void this.updateSettings({ ...this.settings, buildCommand: value.trim() || "mvn -q -DskipTests compile" })));
      page.append(settingToggle("Pular testes", "Pula testes durante a compilação.", this.settings.buildSkipTests, value => void this.updateSettings({ ...this.settings, buildSkipTests: value })));
      return;
    }

    page.append(settingToggle("Barra de status visível", "Mostra a barra de status inferior.", this.settings.statusBarVisible, value => void this.updateSettings({ ...this.settings, statusBarVisible: value })));
    page.append(settingToggle("Barra de atividades visível", "Mostra a barra de atividades.", this.settings.activityBarVisible, value => void this.updateSettings({ ...this.settings, activityBarVisible: value })));
    page.append(settingToggle("Barra lateral visível", "Mostra o painel lateral.", this.settings.sideBarVisible, value => void this.updateSettings({ ...this.settings, sideBarVisible: value })));
    page.append(settingToggle("Restaurar último workspace ao iniciar", "Reabre automaticamente o workspace que estava aberto ao fechar o NPSharp.", this.settings.restoreWorkspaceOnStartup, value => void this.updateSettings({ ...this.settings, restoreWorkspaceOnStartup: value })));
    page.append(settingToggle("Confirmar exclusão", "Pede confirmação antes de excluir arquivos e pastas no Explorer.", this.settings.confirmDelete, value => void this.updateSettings({ ...this.settings, confirmDelete: value })));
  }

  private appendSearchSetting(page: HTMLElement, query: string, keywords: string, row: () => HTMLElement): void {
    const compactQuery = query.replace(/\s+/g, "");
    const compactKeywords = keywords.replace(/\s+/g, "");
    if (keywords.includes(query) || compactKeywords.includes(compactQuery)) {
      page.append(row());
    }
  }

  private async updateSettings(settings: AppSettings): Promise<void> {
    this.settings = await api.settings.save(settings);
    if (!this.settings.restoreWorkspaceOnStartup) {
      this.session.workspace = undefined;
      this.session.openFiles = [];
      this.session.activeFile = undefined;
      await api.settings.saveSession(this.session);
    }
    await this.applySettingsEffects();
  }

  private async setLanguage(language: AppLocale): Promise<void> {
    await api.i18n.setLanguage(language);
    window.location.reload();
  }

  private async terminalShellOptionsForSettings(): Promise<Array<{ value: string; label: string }>> {
    if (!platform.canUseNodeBackend) return [];
    try {
      return (await api.terminal.shells())
        .filter(option => option.available)
        .map(option => ({ value: option.path, label: option.label }));
    } catch (error) {
      console.warn("[NPSharp terminal] Failed to list shells for settings.", error);
      return [];
    }
  }

  private async resetSettings(): Promise<void> {
    this.settings = await api.settings.reset();
    this.refreshShortcuts();
    await this.applySettingsEffects();
    this.updateStatus("Configurações redefinidas");
  }

  private async clearWallpaper(): Promise<void> {
    await this.updateSettings({ ...this.settings, wallpaperPath: "" });
    this.updateStatus("Wallpaper removido");
  }

  private toggleErrorLens(): void {
    const next = !this.settings.errorLensEnabled;
    void this.updateSettings({ ...this.settings, errorLensEnabled: next });
    this.updateStatus(next ? "ErrorLens ativado" : "ErrorLens desativado");
  }

  private toggleEditorWordWrap(): void {
    const next = !this.settings.editorWordWrap;
    void this.updateSettings({ ...this.settings, editorWordWrap: next });
    this.updateStatus(next ? "Quebra automática ativada" : "Quebra automática desativada");
  }

  private async applySettingsEffects(): Promise<void> {
    this.terminal.setEnabled(this.settings.terminalEnabled);
    this.terminal.setShell(this.terminalShell());
    this.editor.applyTheme(await applyTheme(this.settings));
    this.applyWallpaper();
    this.applyLayoutSettings();
    document.documentElement.dataset.iconTheme = this.settings.iconTheme === "minimal" ? "minimal" : "default";
    document.documentElement.style.setProperty("--custom-icon-color", this.settings.iconColor || "currentColor");
    this.editor.applySettings(this.settings);
    if (this.settingsDialogPanel?.isConnected) void this.renderSettings(this.settingsDialogPanel);
    if (!this.settings.diagnosticsEnabled) {
      this.diagnostics = [];
      this.editor.setDiagnostics([]);
      this.renderProblems();
    }
  }

  private applyLayoutSettings(): void {
    this.statusBarElement.hidden = !this.settings.statusBarVisible;
    this.activityBar.hidden = !this.settings.activityBarVisible;
    if (!this.settings.sideBarVisible) {
      this.sideBar.hidden = true;
    } else if (this.activePanel) {
      this.sideBar.hidden = false;
    }
  }

  private async chooseWallpaper(): Promise<void> {
    if (!platform.isDesktop) {
      this.updateStatus("Seletor nativo de wallpaper disponivel apenas no desktop.");
      return;
    }
    try {
      const result = await api.dialog.chooseWallpaper();
      if (!result.canceled && result.paths[0]) {
        await this.updateSettings({ ...this.settings, wallpaperPath: result.paths[0] });
      }
    } catch (error) {
      reportError(error, text => this.updateStatus(text), "Falha ao escolher papel de parede");
    }
  }

  private async createProject(): Promise<void> {
    const folderInput = prompt(platform.isDesktop ? "Nome da pasta do novo projeto" : "Nome da pasta do workspace mobile", platform.isDesktop ? "meu-projeto" : "Main");
    if (!folderInput?.trim()) return;
    const repositoryInput = prompt("Nome do repositório", folderInput.trim());
    if (!repositoryInput?.trim()) return;
    let folderName: string;
    let repositoryName: string;
    try {
      folderName = projectNameFromInput(folderInput);
      repositoryName = projectNameFromInput(repositoryInput);
    } catch (error) {
      reportError(error, text => this.updateStatus(text), "Nome de projeto inválido");
      return;
    }

    let target: string;
    if (platform.isDesktop) {
      const parentResult = await api.dialog.openFolder();
      if (parentResult.canceled || !parentResult.paths[0]) return;
      target = joinPath(parentResult.paths[0], folderName);
    } else {
      target = joinPath(MOBILE_WORKSPACES_ROOT, folderName);
    }

    try {
      if (await api.fs.exists(target)) throw new Error("Já existe um projeto com esse nome nessa pasta.");
      await api.fs.createFolder(target);
      await api.fs.createFolder(joinPath(target, ".npsharp"));
      await api.fs.writeFile(joinPath(target, ".npsharp", "project.json"), `${JSON.stringify({ folderName, repositoryName }, null, 2)}\n`);
      const gitStatus = await this.initializeProjectGit(target, repositoryName);
      await this.explorer.openFolder(target);
      this.showPanel("explorer");
      this.updateStatus(`Projeto criado: ${folderName} · repositório: ${repositoryName}. ${gitStatus}`);
    } catch (error) {
      reportError(error, text => this.updateStatus(text), "Não foi possível criar o projeto");
    }
  }

  private async initializeProjectGit(target: string, repositoryName: string): Promise<string> {
    if (!platform.canUseGit) return "Git não disponível; a pasta foi criada normalmente.";
    try {
      const init = await api.git.run(target, ["init"]);
      if (!init.success) return `Git não disponível: ${init.output || "git init falhou"}. A pasta foi criada normalmente.`;
      const config = await api.git.run(target, ["config", "--local", "npsharp.repositoryName", repositoryName]);
      if (!config.success) return "Git inicializado; não foi possível registrar o nome do repositório no Git.";
      return "Git inicializado.";
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return `Git não disponível: ${detail}. A pasta foi criada normalmente.`;
    }
  }

  private async cloneRepository(): Promise<void> {
    const url = prompt("URL do repositorio Git");
    if (!url?.trim()) return;
    if (!platform.canUseGit) {
      this.showTerminal(false);
      this.terminal.appendOutput(`[git] ${url.trim()}`);
      this.terminal.appendOutput("Git nativo ainda nao esta disponivel no mobile.");
      try {
        await this.saveFutureRemote(url.trim());
        this.terminal.appendOutput("URL salva como projeto remoto futuro.");
        this.updateStatus("Git mobile limitado: URL salva para backend futuro");
      } catch (error) {
        reportError(error, text => this.updateStatus(text), "Save remote URL failed");
      }
      return;
    }
    const target = await api.dialog.openFolder();
    if (target.canceled || !target.paths[0]) return;
    const parent = target.paths[0];
    this.showTerminal(true);
    this.terminal.appendOutput(`[git] git clone ${url.trim()}`);
    try {
      const result = await api.git.run(parent, ["clone", url.trim()]);
      this.terminal.appendOutput(result.output || (result.success ? "Clone concluido." : "Clone falhou."));
      this.updateStatus(result.success ? "Clone completed" : "Clone failed");
      const clonedPath = joinPath(parent, cloneFolderName(url.trim()));
      if (result.success && await api.fs.exists(clonedPath)) {
        await this.explorer.openFolder(clonedPath);
        this.showPanel("explorer");
      }
    } catch (error) {
      reportError(error, text => this.updateStatus(text), "Clone repository failed");
    }
  }

  

  private async saveFutureRemote(url: string): Promise<void> {
    const path = joinPath(MOBILE_ROOT, "remote-projects.json");
    let entries: Array<{ url: string; savedAt: string }> = [];
    if (await api.fs.exists(path)) {
      try {
        entries = JSON.parse((await api.fs.readFile(path)).content) as Array<{ url: string; savedAt: string }>;
      } catch (error) {
        console.warn(`[NPSharp remote] Failed to read saved remote projects from ${path}; starting with an empty list.`, error);
        entries = [];
      }
    }
    const next = [{ url, savedAt: new Date().toISOString() }, ...entries.filter(item => item.url !== url)].slice(0, 50);
    await api.fs.writeFile(path, `${JSON.stringify(next, null, 2)}\n`);
  }

  private async openNotes(): Promise<void> {
    if (!platform.isDesktop) {
      try {
        const notes = await api.notes.read();
        await this.editor.openFile(notes.path);
        this.updateStatus(`Notes aberto: ${notes.path}`);
      } catch (error) {
        reportError(error, text => this.updateStatus(text), "Open notes failed");
      }
      return;
    }

    const base = this.explorer.workspace ? joinPath(this.explorer.workspace, ".npsharp") : this.appInfoPath;
    const notesPath = joinPath(base, "notes.nps.md");
    try {
      await api.fs.createFolder(base);
      if (!await api.fs.exists(notesPath)) {
        await api.fs.writeFile(notesPath, "# NPSharp Notes\n\n## TODO\n\n- \n\n## Ideias\n\n## Bugs\n\n## Observacoes\n");
      }
      await this.editor.openFile(notesPath);
      this.updateStatus(`Notes aberto: ${notesPath}`);
    } catch (error) {
      reportError(error, text => this.updateStatus(text), "Open notes failed");
    }
  }

  private openNewWindow(): void {
    if (!platform.isDesktop) {
      this.updateStatus("Nova janela disponivel apenas no desktop");
      return;
    }
    this.updateStatus("Nova janela ainda depende do backend Electron");
  }

  private showRecentWorkspaces(): void {
    const workspaces = this.session.recentWorkspaces ?? [];
    if (!workspaces.length) {
      this.updateStatus("Nenhum workspace recente");
      return;
    }
    this.palette.showPicker("Recent workspaces", workspaces.map(workspace => ({
      label: basename(workspace),
      hint: workspace,
      keywords: workspace,
      run: () => this.openRecentWorkspace(workspace)
    })));
    this.updateStatus("Recentes aberto");
  }

  private async runWithoutDebug(): Promise<void> {
    this.updateStatus("Run sem debug iniciado");
    await this.runCurrentFile(false);
  }

  private bindUpdater(): void {
    this.disposers.push(api.update.onStatus(status => this.renderUpdateStatus(status)));
    void api.update.status().then(status => this.renderUpdateStatus(status)).catch(() => undefined);
  }

  private renderUpdateStatus(status: AppUpdateStatus): void {
    if (this.disposed) return;
    const button = this.updateButton;
    if (!button) return;
    const visible = status.state === "available" || status.state === "downloading" || status.state === "downloaded";
    button.hidden = !visible;
    button.disabled = status.state === "downloading";
    button.title = status.message;
    if (status.state === "available") button.textContent = `Atualizar NPSharp para v${status.version}`;
    else if (status.state === "downloading") button.textContent = `Baixando atualização: ${status.percent ?? 0}%`;
    else if (status.state === "downloaded") button.textContent = "Reiniciar e instalar";
    else button.textContent = "";
    if (status.state !== "idle" && status.state !== "unsupported") this.updateStatus(status.message);
  }

  private async checkForUpdates(): Promise<void> {
    try {
      const status = await api.update.check();
      this.renderUpdateStatus(status);
    } catch (error) {
      reportError(error, text => this.updateStatus(text), "Falha ao verificar atualizações");
    }
  }

  private async handleUpdateButton(): Promise<void> {
    try {
      const status = await api.update.status();
      if (status.state === "downloaded") {
        await api.update.install();
        return;
      }
      if (status.state === "available") this.renderUpdateStatus(await api.update.download());
    } catch (error) {
      reportError(error, text => this.updateStatus(text), "Falha ao atualizar o NPSharp");
    }
  }

  private async openProjectHealth(): Promise<void> {
    try {
      const workspace = this.explorer.workspace;
      const summary = await api.projectHealth.summary();
      const diagnostics = workspace ? await api.projectHealth.java(workspace, this.editor.getCurrentFile()) : [];
      const lines = [
        "# Project Health",
        "",
        summary,
        "",
        `Workspace: ${workspace ?? "none"}`,
        `Diagnostics: ${diagnostics.length}`,
        "",
        ...diagnostics.map(item => `- ${item.severity} ${basename(item.filePath)}:${item.line}:${item.column} ${item.message}`)
      ];
      this.editor.openVirtualFile("Project Health.md", "npsharp:project-health", `${lines.join("\n")}\n`);
      this.updateStatus("Project Health aberto");
    } catch (error) {
      reportError(error, text => this.updateStatus(text), "Project Health failed");
    }
  }

  private async toggleLiveServer(): Promise<void> {
    if (this.liveServerActive) {
      const result = await api.liveServer.stopAll();
      this.liveServerActive = false;
      this.updateStatus(result.output || "Live Server parado");
      return;
    }

    const filePath = this.editor.getCurrentFile();
    if (!filePath) {
      this.updateStatus("Abra um arquivo HTML para iniciar o Live Server");
      return;
    }
    if (!/\.html?$/i.test(filePath)) {
      this.updateStatus("Live Server suporta HTML neste atalho");
      return;
    }
    if (!this.explorer.workspace) {
      this.showHtmlPreview(basename(filePath), this.editor.getCurrentText());
      this.updateStatus("Preview HTML aberto sem workspace");
      return;
    }

    const result = await api.liveServer.open({ workspace: this.explorer.workspace, filePath });
    this.liveServerActive = result.success;
    if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
    this.updateStatus(result.success ? "Live Server iniciado" : result.output);
  }

  private showGitQuickActions(): void {
    this.showPanel("source");
    this.palette.showPicker("Git quick actions", [
      { label: "Git: Stage All", hint: "git add -A", run: () => this.source.runOnFirstRepo(["add", "-A"]) },
      { label: "Git: Commit", hint: "commit", run: () => this.source.commit() },
      { label: "Git: Pull", hint: "git pull", run: () => this.source.runOnFirstRepo(["pull"]) },
      { label: "Git: Push", hint: "git push", run: () => this.source.runOnFirstRepo(["push"]) }
    ]);
    this.updateStatus("Git quick actions aberto");
  }

  private toggleFocusMode(): void {
    this.focusMode = !this.focusMode;
    this.element.classList.toggle("focus-mode", this.focusMode);
    if (this.focusMode) {
      this.terminalVisibleBeforeFocus = !this.terminal.element.hidden;
      this.sidebarHiddenBeforeFocus = this.sideBar.hidden;
      this.sideBar.hidden = true;
      this.activityBar.hidden = true;
      this.statusBarElement.hidden = true;
      this.setTerminalVisible(false, false);
      this.updateStatus("Modo Foco ativo");
      return;
    }
    this.applyLayoutSettings();
    this.sideBar.hidden = this.sidebarHiddenBeforeFocus || !this.settings.sideBarVisible;
    this.setTerminalVisible(this.terminalVisibleBeforeFocus, false);
    this.updateStatus("Modo Foco desativado");
  }

  private toggleCompactPreview(): void {
    this.compactPreview = !this.compactPreview;
    this.element.classList.toggle("compact-preview", this.compactPreview);
    this.updateStatus(this.compactPreview ? "Layout compacto ativo" : "Layout compacto desativado");
  }

  private clearTemporaryPanels(): void {
    this.terminal.clearCurrentTerminal();
    this.updateStatus("Terminal/logs limpos");
  }

  private async snapshotWorkspace(): Promise<void> {
    const base = this.explorer.workspace ? joinPath(this.explorer.workspace, ".npsharp") : MOBILE_ROOT;
    const path = joinPath(base, "snapshot.json");
    try {
      await api.fs.createFolder(base);
      await api.fs.writeFile(path, `${JSON.stringify({
        savedAt: new Date().toISOString(),
        workspace: this.explorer.workspace,
        activeFile: this.editor.getCurrentFile(),
        openFiles: this.editor.getOpenFiles(),
        sidePanel: this.activePanel,
        platform: platform.kind
      }, null, 2)}\n`);
      this.updateStatus(`Snapshot salvo: ${path}`);
    } catch (error) {
      reportError(error, text => this.updateStatus(text), "Snapshot failed");
    }
  }

  private applyWallpaper(): void {
    const wallpaperPath = this.settings?.wallpaperPath.trim();
    if (!wallpaperPath) {
      this.wallpaper.style.backgroundImage = "";
      return;
    }
    if (!platform.isDesktop && !/^(blob:|data:|https?:)/i.test(wallpaperPath)) {
      this.wallpaper.style.backgroundImage = "";
      return;
    }
    const wallpaper = platform.isDesktop ? fileUri(wallpaperPath) : wallpaperPath;
    this.wallpaper.style.backgroundImage = cssUrl(wallpaper);
    const opacity = Number(this.settings.wallpaperOpacity);
    this.wallpaper.style.opacity = String(Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 0.18);
  }

  private async runCurrentFile(debug = false): Promise<void> {
    try {
      const activeFile = this.editor.getCurrentFile();
      if (!activeFile && this.explorer.workspace && await this.runWorkspace()) return;
      if (!activeFile) await this.editor.saveCurrentFileAs();
      else await this.editor.saveCurrentFile();
      const filePath = this.editor.getCurrentFile();
      if (!filePath) return;

      if (this.explorer.workspace && isProjectRunFile(filePath)) {
        if (await this.runWorkspace()) return;
      }

      this.showTerminal(true);
      this.terminal.showTerminal();
      await this.terminal.ensureTerminal();
      this.terminal.appendTerminalOutput(`[Run] Arquivo detectado: ${basename(filePath)}`);

      if (isPortugolFile(filePath)) {
        await this.runPortugolFile(this.editor.getCurrentText());
        return;
      }

      if (/\.html?$/i.test(filePath)) {
        if (platform.canUseLiveServer && this.explorer.workspace) {
          const result = await api.liveServer.open({ workspace: this.explorer.workspace, filePath });
          this.terminal.appendTerminalOutput(result.output);
          if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
          this.updateStatus(result.success ? "Live Server aberto" : "Live Server falhou");
        } else {
          this.showHtmlPreview(basename(filePath), this.editor.getCurrentText());
          this.terminal.appendTerminalOutput("Prévia HTML aberta sem iniciar servidor Node.");
          this.updateStatus("Prévia HTML aberta");
        }
        return;
      }

      if (!platform.canUseNodeBackend) {
        const result = await api.runtime.runFile({ filePath, content: this.editor.getCurrentText(), workspace: this.explorer.workspace, debug });
        this.terminal.appendTerminalOutput(result.output);
        this.updateStatus("Runtime local indisponivel neste ambiente");
        return;
      }

      const result = await api.runtime.runFile({ filePath, content: this.editor.getCurrentText(), workspace: this.explorer.workspace, debug });
      this.terminal.appendTerminalOutput(result.output);
      this.updateStatus(result.code === 0 ? "Execução concluída" : "Falha na execução");
    } catch (error) {
      reportError(error, text => this.updateStatus(text), "Falha na execução");
    }
  }

  private async runPortugolFile(source: string): Promise<void> {
    let failed = false;
    const interpreter = new PortugolInterpreter();
    await interpreter.executeWithOutputAsync(
      source,
      () => this.terminal.requestProgramInput("Entrada do Portugol"),
      line => {
        if (line.includes("[ERRO]")) failed = true;
        this.terminal.appendTerminalOutput(`[PORTUGOL] ${line}`);
      }
    );
    this.terminal.appendTerminalOutput("[Run] Execução finalizada");
    this.updateStatus(failed ? "Falha na execução Portugol" : "Execução Portugol concluída");
  }

  private async installCurrentPythonDependencies(): Promise<void> {
    try {
      const activeFile = this.editor.getCurrentFile();
      if (!activeFile) {
        this.updateStatus("Abra um arquivo Python para baixar seus imports");
        return;
      }
      if (!/\.py$/i.test(activeFile)) {
        this.updateStatus("O download automático de imports está disponível para arquivos Python (.py)");
        return;
      }
      await this.editor.saveCurrentFile();
      this.showTerminal(true);
      this.terminal.showTerminal();
      await this.terminal.ensureTerminal();
      this.terminal.appendTerminalOutput(`[Python] Preparando .venv e dependências: ${basename(activeFile)}`);
      const result = await api.runtime.installDependencies({
        filePath: activeFile,
        content: this.editor.getCurrentText(),
        workspace: this.explorer.workspace
      });
      this.terminal.appendTerminalOutput(result.output);
      this.updateStatus(result.code === 0 ? "Dependências Python preparadas no .venv" : "Falha ao preparar dependências Python");
    } catch (error) {
      reportError(error, text => this.updateStatus(text), "Falha ao baixar imports Python");
    }
  }

  private async runWorkspace(): Promise<boolean> {
    const workspace = this.explorer.workspace;
    if (!workspace) return false;
    const command = await this.detectWorkspaceRunCommand(workspace);
    if (!command) {
      this.updateStatus("Nenhum comando Run detectado no workspace");
      return false;
    }
    this.showTerminal(true);
    this.terminal.showTerminal();
    await this.terminal.runCommand(command);
    return true;
  }

  private async detectWorkspaceRunCommand(workspace: string): Promise<string | undefined> {
    const packageJson = joinPath(workspace, "package.json");
    if (await api.fs.exists(packageJson)) {
      try {
        const pkg = JSON.parse((await api.fs.readFile(packageJson)).content) as { scripts?: Record<string, string> };
        if (pkg.scripts?.dev) return "npm run dev";
        if (pkg.scripts?.start) return "npm start";
        if (pkg.scripts?.test) return "npm test";
      } catch (error) {
        console.warn(`[NPSharp runtime] Failed to inspect ${packageJson}.`, error);
        this.updateStatus("package.json invalido para Run");
      }
    }

    if (await api.fs.exists(joinPath(workspace, "pom.xml"))) return "mvn javafx:run";
    if (await api.fs.exists(joinPath(workspace, "gradlew"))) return this.appPlatform === "win32" ? "gradlew.bat run" : "./gradlew run";
    if (this.appPlatform === "win32" && await api.fs.exists(joinPath(workspace, "gradlew.bat"))) return "gradlew.bat run";
    if (await api.fs.exists(joinPath(workspace, "Cargo.toml"))) return "cargo run";
    if (await api.fs.exists(joinPath(workspace, "go.mod"))) return "go run .";
    return undefined;
  }

  private showHtmlPreview(title: string, content: string): void {
    document.querySelector(".html-preview-overlay")?.remove();
    const overlay = el("div", { className: "html-preview-overlay" });
    const panel = el("section", { className: "html-preview-panel" });
    const header = el("header", { className: "html-preview-header" });
    const close = buttonIcon("close", "Close Preview", () => overlay.remove());
    header.append(el("strong", { text: title }), close);
    const frame = el("iframe", {
      className: "html-preview-frame",
      attrs: { sandbox: "allow-scripts allow-forms allow-modals allow-popups" }
    });
    frame.srcdoc = content;
    panel.append(header, frame);
    overlay.append(panel);
    overlay.addEventListener("click", event => {
      if (event.target === overlay) overlay.remove();
    });
    document.body.append(overlay);
  }

  private async buildProject(): Promise<void> {
    if (!platform.canUseTerminal) {
      this.showTerminal(false);
      this.terminal.appendOutput(platform.isMobile
        ? "Build local depende de backend nativo futuro no mobile."
        : "Build local depende do backend Electron/Node.");
      this.updateStatus("Build local indisponivel neste ambiente");
      return;
    }
    this.showTerminal(true);
    await this.terminal.runCommand(this.settings.buildCommand);
    await this.runDiagnostics();
  }

  private async runDiagnostics(): Promise<void> {
    if (!platform.canUseNodeBackend) return;
    if (!this.settings?.diagnosticsEnabled || !this.explorer.workspace) return;
    const current = this.editor.getCurrentFile();
    if (current && !current.endsWith(".java")) return;
    this.diagnostics = await api.diagnostics.java(this.explorer.workspace, current);
    this.diagnosticIndex = -1;
    this.editor.setDiagnostics(this.diagnostics);
    this.renderProblems();
    if (this.diagnostics.length && this.settings.problemsAutoOpen) {
      this.showPanel("problems");
    }
  }

  private async openRecentWorkspace(workspace: string): Promise<void> {
    try {
      if (!await api.fs.exists(workspace)) {
        this.session.recentWorkspaces = (this.session.recentWorkspaces ?? []).filter(item => item !== workspace);
        this.updateCommandCenter();
        this.persist();
        this.updateStatus(`Workspace nao encontrado: ${workspace}`);
        return;
      }
      await this.explorer.openFolder(workspace);
      this.showPanel("explorer");
    } catch (error) {
      reportError(error, text => this.updateStatus(text), `Open workspace failed (${workspace})`);
    }
  }

  private rememberWorkspace(workspace: string): void {
    this.session.recentWorkspaces = [workspace, ...(this.session.recentWorkspaces ?? []).filter(item => item !== workspace)].slice(0, 12);
  }

  private updateCommandCenter(): void {
    const visible = this.commandCenterForced || (!this.explorer.workspace && !this.editor.activeTab);
    this.commandCenter.setState({
      visible,
      actions: this.commandCenterActions(),
      recentWorkspaces: this.session.recentWorkspaces ?? [],
      shortcuts: this.commandCenterShortcuts()
    });
  }

  private commandCenterActions(): CommandCenterAction[] {
    const hasProject = Boolean(this.explorer.workspace);
    const hasRunnableTarget = platform.canUseNodeBackend
      ? Boolean(this.editor.getCurrentFile() || this.explorer.workspace)
      : Boolean(this.editor.getCurrentFile());
    const openWorkspaceLabel = platform.isMobile ? "Abrir workspace mobile" : "Abrir pasta";
    const openWorkspaceDetail = platform.isMobile ? "Usar o sandbox Documents/NPSharp." : "Escolher um workspace local.";
    return [
      { id: "open-folder", label: openWorkspaceLabel, detail: openWorkspaceDetail, iconName: "root-folder-opened", run: () => void this.explorer.openFolderFromDialog() },
      { id: "new-file", label: "Novo arquivo", detail: "Criar um arquivo sem sair do hub.", iconName: "new-file", run: () => this.editor.newTab() },
      { id: "new-project", label: "Novo projeto", detail: platform.isMobile ? "Criar workspace em Documents/NPSharp/workspaces." : "Criar uma pasta e abrir como workspace.", iconName: "project", run: () => void this.createProject() },
      { id: "clone", label: "Clonar Git", detail: platform.canUseGit ? "Executar git clone em uma pasta escolhida." : "Salvar URL para backend Git nativo futuro.", iconName: "repo-clone", run: () => void this.cloneRepository() },
      { id: "terminal", label: platform.canUseTerminal ? "Abrir terminal" : "Abrir saída", detail: platform.canUseTerminal ? "Abrir o terminal integrado." : "Terminal real indisponível neste ambiente.", iconName: "terminal", run: () => this.showTerminal(true) },
      { id: "arduino", label: "Arduino", detail: platform.canUseNodeBackend ? "Placas, portas, compilação e envio via Arduino CLI." : "Modo limitado para sketches Arduino.", iconName: "circuit-board", run: () => this.showPanel("arduino") },
      { id: "extensions", label: "Extensões", detail: "Instalar pacotes VSIX locais e gerenciar extensões instaladas.", iconName: "extensions-large", run: () => this.showPanel("extensions") },
      { id: "language-runtimes", label: "Runtimes de linguagem", detail: "Configurar caminhos de executáveis fora das configurações gerais.", iconName: "server-environment", run: () => void this.showLanguageRuntimes() },
      { id: "notes", label: "Abrir notas", detail: platform.isMobile ? "Abrir ou criar Documents/NPSharp/notes.nps.md." : "Abrir ou criar .npsharp/notes.nps.md.", iconName: "note", run: () => void this.openNotes() },
      { id: "theme-lab", label: "Abrir laboratório de temas", detail: "Abrir o seletor de temas, incluindo especiais.", iconName: "paintcan", run: () => void this.showThemePicker(true) },
      { id: "settings", label: "Configurações", detail: "Abrir ajustes do editor.", iconName: "settings-gear", run: () => this.showSettings() },
      { id: "keyboard-shortcuts", label: "Atalhos de teclado", detail: "Ver comandos, teclas e conflitos.", iconName: "key", run: () => this.showKeyboardShortcuts() },
      { id: "run", label: "Executar projeto", detail: hasRunnableTarget ? (platform.canUseNodeBackend ? "Executar o arquivo/projeto atual." : "Prévia HTML ou alternativa de runtime.") : "Abra um arquivo primeiro.", iconName: "play", disabled: !hasRunnableTarget, run: () => void this.runCurrentFile() },
      { id: "git-status", label: "Controle de código-fonte", detail: platform.canUseGit ? (hasProject ? "Abrir o controle de código-fonte do workspace." : "Abra um workspace primeiro.") : "Abrir o controle de código-fonte em modo limitado.", iconName: "source-control", disabled: platform.canUseGit && !hasProject, run: () => this.showPanel("source") }
    ];
  }

  private commandCenterShortcuts(): CommandCenterShortcut[] {
    return this.shortcuts
      .filter(shortcut => ["view.commandPalette", "file.openWorkspace", "view.quickOpen", "view.toggleTerminal", "view.keyboardShortcuts", "run.debug"].includes(shortcut.id))
      .map(shortcut => ({ label: shortcut.label.replace(/^[^:]+:\s*/, ""), keys: shortcut.keys[0] }))
      .slice(0, 8);
  }

  private renderProblems(): void {
    const errors = this.diagnostics.filter(diagnostic => diagnostic.severity === "ERROR").length;
    const warnings = this.diagnostics.filter(diagnostic => diagnostic.severity === "WARNING").length;
    const header = el("div", { className: "problems-header" });
    header.append(
      el("strong", { text: "Problemas" }),
      el("span", { className: "panel-summary", text: `${errors} erro(s), ${warnings} aviso(s), ${this.diagnostics.length} no total` })
    );
    this.problemsPanel.replaceChildren(header);
    if (!this.diagnostics.length) {
      this.problemsPanel.append(el("div", { className: "empty-state", text: "Nenhum problema encontrado no workspace." }));
      return;
    }
    for (const diagnostic of this.diagnostics) {
      const row = el("button", { className: `problem-row ${diagnostic.severity.toLowerCase()}` });
      const filePath = this.explorer.workspace && diagnostic.filePath
        ? relativePath(this.explorer.workspace, diagnostic.filePath)
        : basename(diagnostic.filePath);
      const location = el("span", { className: "problem-location", text: `${filePath} · linha ${diagnostic.line}, coluna ${diagnostic.column}` });
      const message = el("span", { className: "problem-message", text: diagnostic.message });
      row.append(el("strong", { className: "problem-severity", text: problemSeverityLabel(diagnostic.severity) }), location, message);
      row.addEventListener("click", () => this.editor.goToDiagnostic(diagnostic));
      this.problemsPanel.append(row);
    }
  }

  private showTerminal(focus = false): void {
    this.setTerminalVisible(true);
    if (!this.terminal.hasTerminal()) this.terminal.newTerminal();
    if (!platform.canUseTerminal) {
      this.terminal.showOutputPanel();
      this.terminal.appendOutput(platform.isMobile
        ? "O terminal Node real não está disponível no mobile. Saída e registro de comandos ativos."
        : "O terminal real não está disponível no modo web. Saída e registro de comandos ativos.");
    } else if (focus) {
      this.terminal.focusCurrentTerminal();
    }
  }

  private toggleTerminal(): void {
    const visible = this.terminal.element.hidden;
    this.setTerminalVisible(visible);
    if (visible && !this.terminal.hasTerminal()) this.terminal.newTerminal();
    if (visible && !platform.canUseTerminal) this.terminal.showOutputPanel();
  }

  private closeTerminalPanel(): void {
    this.setTerminalVisible(false);
    this.updateStatus("Terminal oculto");
  }

  private setTerminalVisible(visible: boolean, persist = true): void {
    this.terminal.element.hidden = !visible;
    this.editorStack.classList.toggle("terminal-visible", visible);
    this.session.terminalVisible = visible;
    if (persist) this.persist();
  }

  private toggleSidebar(): void {
    this.sideBar.hidden = !this.sideBar.hidden;
    this.updateStatus(this.sideBar.hidden ? "Barra lateral oculta" : panelTitle(this.activePanel));
  }

  private terminalCwd(): string {
    if (!platform.isDesktop) {
      return this.editor.getCurrentFile()
        ? dirname(this.editor.getCurrentFile()!)
        : this.explorer.workspace ?? DEFAULT_MOBILE_WORKSPACE;
    }
    return this.editor.getCurrentFile()
      ? dirname(this.editor.getCurrentFile()!)
      : this.explorer.workspace ?? this.settings?.terminalInitialDirectory ?? "";
  }

  private terminalShell(): string {
    return this.appPlatform === "win32" ? this.settings.terminalShellWindows : this.settings.terminalShellLinux;
  }

  private handleShortcut(event: KeyboardEvent): void {
  const key = shortcutFromEvent(event);
  if (!key) return;

  if (this.shortcuts.some(shortcut => shortcut.custom && shortcut.keys.some(binding => binding.startsWith(`${key} `)))) return;

const active = document.activeElement;
const tag = active?.tagName?.toLowerCase();
const isMonaco = Boolean(active?.closest?.(".monaco-editor"));

const isTyping =
  !isMonaco &&
  (
    tag === "input" ||
    tag === "textarea" ||
    (active instanceof HTMLElement && active.isContentEditable)
  );

if (isTyping && !["Ctrl+F", "Ctrl+H", "Ctrl+S", "Ctrl+Shift+P", "Ctrl+P", "Ctrl+Alt+I"].includes(key)) {
  return;
}

  const chord = this.pendingChord ? `${this.pendingChord} ${key}` : key;

  const run = (action: () => void): void => {
    event.preventDefault();
    event.stopPropagation();
    this.pendingChord = undefined;
    if (this.pendingChordTimer !== undefined) {
      window.clearTimeout(this.pendingChordTimer);
      this.pendingChordTimer = undefined;
    }
    action();
  };

  switch (chord) {
    case "Ctrl+K Ctrl+C":
      run(() => this.editor.addLineComment());
      return;

    case "Ctrl+K Ctrl+U":
      run(() => this.editor.removeLineComment());
      return;

    case "Ctrl+K Ctrl+O":
      run(() => this.explorer.openFolderFromDialog());
      return;
      case "Ctrl+K Ctrl+S":
        run(() => this.showKeyboardShortcuts());
        return;
  }

  if (key === "Ctrl+K") {
    event.preventDefault();
    event.stopPropagation();

    this.pendingChord = "Ctrl+K";
    this.updateStatus("Ctrl+K...");

    if (this.pendingChordTimer !== undefined) window.clearTimeout(this.pendingChordTimer);
    this.pendingChordTimer = window.setTimeout(() => {
      if (this.pendingChord === "Ctrl+K") {
        this.pendingChord = undefined;
        this.pendingChordTimer = undefined;
        this.updateStatus("Atalho cancelado");
      }
    }, 1600);

    return;
  }

  switch (key) {
    case "Ctrl+Alt+I":
      run(() => this.openAIChat());
      return;

    case "Ctrl+F":
      run(() => this.editor.find());
      return;

    case "Ctrl+H":
      run(() => this.editor.replace());
      return;

    case "Ctrl+Shift+F":
      run(() => this.showPanel("search"));
      return;

    case "Ctrl+/":
      run(() => this.editor.addLineComment());
      return;

    case "Ctrl+Shift+/":
      run(() => this.editor.removeLineComment());
      return;

    // case "Shift+Alt+A":
    //   run(() => this.editor.toggleBlockComment());
    //   return;

    case "Ctrl+S":
      run(() => this.editor.saveCurrentFile());
      return;

    case "Ctrl+Shift+S":
      run(() => this.editor.saveCurrentFileAs());
      return;

    case "Ctrl+O":
      run(() => this.editor.openFileFromDialog());
      return;

    case "Ctrl+N":
      run(() => this.editor.newTab());
      return;

    case "Ctrl+W":
      run(() => this.editor.closeCurrentTab());
      return;

    case "Alt+Z":
      run(() => this.toggleEditorWordWrap());
      return;

    case "Ctrl+Shift+P":
      run(() => this.palette.showCommands());
      return;

    case "Ctrl+P":
      run(() => this.palette.showQuickOpen());
      return;

    case "Ctrl+Shift+E":
      run(() => this.showPanel("explorer"));
      return;

    case "Ctrl+Shift+G":
      run(() => this.showPanel("source"));
      return;

    case "Ctrl+Shift+X":
      run(() => this.showPanel("extensions"));
      return;

    case "Ctrl+Shift+M":
      run(() => this.showPanel("problems"));
      return;

    case "Ctrl+B":
      run(() => this.toggleSidebar());
      return;

    case "Ctrl+`":
      run(() => this.toggleTerminal());
      return;

    case "F5":
      run(() => this.runCurrentFile(true));
      return;

    case "Ctrl+Alt+N":
      run(() => this.openNotes());
      return;

    case "Ctrl+Alt+C":
      run(() => this.updateStatus("Command Center"));
      return;

    case "Ctrl+Alt+T":
      run(() => this.showThemePicker());
      return;
  }

  this.pendingChord = undefined;
}

  private goToDiagnosticByOffset(offset: number): void {
    if (this.diagnostics.length === 0) {
      this.updateStatus("No problems");
      return;
    }
    this.diagnosticIndex = (this.diagnosticIndex + offset + this.diagnostics.length) % this.diagnostics.length;
    this.showPanel("problems");
    this.editor.goToDiagnostic(this.diagnostics[this.diagnosticIndex]);
  }

  private handleCommand(command: string): void {
    const map: Record<string, () => void> = {
      "file:new": () => this.editor.newTab(),
      "file:open": () => void this.editor.openFileFromDialog(),
      "file:save": () => void this.editor.saveCurrentFile(),
      "file:saveAs": () => void this.editor.saveCurrentFileAs(),
      "file:saveAll": () => void this.editor.saveAll(),
      "file:close": () => this.editor.closeCurrentTab(),
      "file:reopenClosed": () => this.editor.reopenClosedTab(),
      "file:closeAll": () => this.editor.closeAllTabs(),
      "workspace:openFolder": () => void this.explorer.openFolderFromDialog(),
      "editor:find": () => this.editor.find(),
      "editor:replace": () => this.editor.replace(),
      "editor:commentLine": () => this.editor.addLineComment(),
      "editor:uncommentLine": () => this.editor.removeLineComment(),
      // "editor:commentBlock": () => this.editor.toggleBlockComment(),
      "editor:goToLine": () => this.editor.goToLine(),
      "editor:start": () => this.editor.goToStartOfFile(),
      "editor:end": () => this.editor.goToEndOfFile(),
      "editor:format": () => this.editor.formatDocument(),
      "view:explorer": () => this.showPanel("explorer"),
      "view:search": () => this.openGlobalSearch(),
      "view:replaceInFiles": () => this.openGlobalReplace(),
      "view:source": () => this.showPanel("source"),
      "view:run": () => this.showPanel("run"),
      "view:arduino": () => this.showPanel("arduino"),
      "view:problems": () => this.showPanel("problems"),
      "view:debugConsole": () => this.terminal.showDebugConsole(),
      "view:commandPalette": () => this.palette.showCommands(),
      "view:keyboardShortcuts": () => this.showKeyboardShortcuts(),
      "view:settings": () => this.showSettings(),
      "view:terminal": () => this.toggleTerminal(),
      "view:output": () => this.showOutput(),
      "view:extensions": () => this.showPanel("extensions"),
      "update:check": () => void this.checkForUpdates(),
      "ai:openChat": () => this.openAIChat(),
      "ai:newConversation": () => { this.openAIChat(); void this.aiChat.newConversation(); },
      "extensions:installVsix": () => void this.installExtensionFromVsix(),
      "extensions:reload": () => void this.reloadExtensionsCommand(),
      "extensions:enable": () => void this.toggleExtensionCommand(true),
      "extensions:disable": () => void this.toggleExtensionCommand(false),
      "extensions:showInstalled": () => void this.showInstalledExtensions(),
      "terminal:new": () => this.showTerminal(true),
      "terminal:output": () => this.terminal.showOutputPanel(),
      "terminal:problems": () => this.terminal.showProblemsPanel(),
      "terminal:debug": () => this.terminal.showDebugConsole(),
      "terminal:ports": () => this.terminal.showPortsPanel(),
      "terminal:git": () => this.terminal.showGitPanel(),
      "terminal:clear": () => this.terminal.clearCurrentTerminal(),
      "terminal:kill": () => this.terminal.killCurrentTerminal(),
      "terminal:close": () => this.terminal.closeCurrentTerminal(),
      "tools:run": () => void this.runCurrentFile(true),
      "tools:runWithoutDebug": () => void this.runWithoutDebug(),
      "tools:build": () => void this.buildProject(),
      "git:pull": () => void this.source.runOnFirstRepo(["pull"]),
      "git:push": () => void this.source.runOnFirstRepo(["push"]),
      "git:fetch": () => void this.source.runOnFirstRepo(["fetch"]),
      "preferences:theme": () => void this.showThemePicker(),
      "preferences:keyboardShortcuts": () => this.showKeyboardShortcuts(),
      "preferences:wallpaper": () => void this.chooseWallpaper(),
      "preferences:clearWallpaper": () => void this.clearWallpaper(),
      "preferences:errorLensToggle": () => this.toggleErrorLens(),
      "help:about": () => this.about(),
      "notes:open": () => void this.openNotes(),
      "npsharp:commandCenter": () => this.openCommandCenter(),
      "npsharp:configureLanguageRuntimes": () => void this.showLanguageRuntimes()
    };
    map[command]?.();
  }

  private updateStatus(text: string): void {
    if (this.disposed) return;
    this.statusLeft.textContent = text;
  }

  private updateEditorStatus(status: EditorStatusInfo): void {
    this.statusType.textContent = status.active ? status.language : "";
    this.statusLineEnding.textContent = status.active ? (status.lineEnding === "\r\n" ? "CRLF" : "LF") : "";
    this.statusEncoding.textContent = status.active ? statusEncodingLabel(status.encoding) : "UTF-8";
    this.statusEncoding.disabled = !status.active;
    this.statusPosition.textContent = status.active ? `Ln ${status.line}, Col ${status.column}` : "";
  }

  private showEncodingMenu(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    contextMenu([
      { label: "UTF-8", action: () => this.editor.setCurrentEncoding("utf8") },
      { label: "UTF-8 com BOM", action: () => this.editor.setCurrentEncoding("utf8bom") }
    ], rect.left, rect.top - 72);
  }

  private async refreshStatusGit(workspace = this.explorer.workspace, filePath = this.editor.getCurrentFile()): Promise<void> {
    const request = ++this.statusGitRequest;
    this.statusBranch.textContent = "Git";
    this.statusAuthor.textContent = "";
    if (!workspace || !platform.canUseGit) return;
    try {
      const repos = await api.git.status(workspace);
      if (this.disposed || request !== this.statusGitRequest) return;
      const repo = repos
        .filter(item => !filePath || isSubPath(item.repo, filePath))
        .sort((left, right) => right.repo.length - left.repo.length)[0] ?? repos[0];
      if (!repo) return;
      this.statusBranch.replaceChildren(icon("git-branch", "Branch"), document.createTextNode(` ${repo.branch}`));
      this.statusBranch.title = `Branch atual: ${repo.branch}`;
      if (!filePath || !isSubPath(repo.repo, filePath)) return;
      const result = await api.git.run(repo.repo, ["log", "-1", "--format=%an", "--", relativePath(repo.repo, filePath)]);
      if (this.disposed || request !== this.statusGitRequest) return;
      const author = result.success ? result.output.trim() : "";
      this.statusAuthor.textContent = author ? `Última alteração: ${author}` : "Sem histórico Git";
      this.statusAuthor.title = this.statusAuthor.textContent;
    } catch {
      if (!this.disposed && request === this.statusGitRequest) this.statusBranch.textContent = "Git";
    }
  }

  private commandLabel(): string {
    return this.explorer.workspace
      ? `Pesquisar em ${basename(this.explorer.workspace)}`
      : BUILD_CONFIG.displayName
  }

  private persist(): void {
    if (this.disposed) return;
    this.session.workspace = this.settings.restoreWorkspaceOnStartup ? this.explorer.workspace : undefined;
    if (this.explorer.workspace) this.rememberWorkspace(this.explorer.workspace);
    this.session.openFiles = this.editor.getOpenFiles();
    this.session.activeFile = this.editor.getCurrentFile();
    this.session.sidePanel = this.activePanel;
    this.session.terminalVisible = !this.terminal.element.hidden;
    void api.settings.saveSession(this.session);
  }
private about(): void {
  alert(`${BUILD_CONFIG.displayName}
Versão ${BUILD_CONFIG.version}

Desenvolvido pela ${BUILD_CONFIG.author}.

Código sem distrações.

O ${BUILD_CONFIG.displayName} é uma IDE rápida, moderna e centrada em desenvolvedores, criada para oferecer uma experiência de programação limpa e eficiente. Combinando o poder do Monaco Editor com Electron, entrega um ambiente familiar com temas personalizados, ferramentas integradas, controle de código-fonte, terminal e um fluxo de trabalho para desenvolvimento de software real.

Feito por desenvolvedores, para desenvolvedores.

© ${new Date().getFullYear()} ${BUILD_CONFIG.copyrightOwner}. Todos os direitos reservados.`);
}

  private renderFatalError(error: unknown): void {
    if (this.disposed) return;
    this.element.replaceChildren(
      el("section", {
        className: "fatal-screen",
        children: [
          el("img", { className: "welcome-logo", attrs: { src: DEFAULT_LOGO_URL, alt: "NPSharp" } }),
          el("h1", { text: "Não foi possível iniciar o NPSharp" }),
          el("pre", { text: errorMessage(error) })
        ]
      })
    );
  }
}

function cloneFolderName(url: string): string {
  const clean = url.replace(/[?#].*$/, "").replace(/\/+$/, "").replace(/\.git$/i, "");
  const match = clean.match(/([^/:]+)$/);
  return match?.[1] || "repository";
}

function projectNameFromInput(value: string): string {
  const name = value.trim();
  if (!name || name === "." || name === ".." || /[\\/:*?"<>|\u0000-\u001F]/.test(name)) {
    throw new Error("Informe um nome de projeto válido, sem separadores de caminho.");
  }
  return name;
}

function problemSeverityLabel(severity: EditorDiagnostic["severity"]): string {
  return ({ ERROR: "Erro", WARNING: "Aviso", INFORMATION: "Informação", HINT: "Dica" } as const)[severity];
}

function isPortugolFile(filePath: string): boolean {
  return [".gol", ".por", ".portugol", ".alg"].includes(extname(filePath).toLowerCase());
}

function isProjectRunFile(filePath: string): boolean {
  const name = basename(filePath).toLowerCase();
  return ["package.json", "pom.xml", "gradlew", "gradlew.bat", "cargo.toml", "go.mod"].includes(name);
}

function menuButton(label: string, items: Array<[string, string, MenuAction]>): HTMLButtonElement {
  const button = el("button", { className: "title-menu", text: label });
  button.addEventListener("click", event => {
    event.stopPropagation();
    closeContextMenus();
    const rect = button.getBoundingClientRect();
    const menu = el("div", { className: "context-menu title-context" });
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom}px`;
    const close = installContextMenuDismiss(menu);
    for (const [text, shortcut, action] of items) {
      const row = el("button", { className: "menu-row" });
      row.append(el("span", { text }), el("span", { className: "menu-shortcut", text: shortcut }));
      row.addEventListener("click", event => {
        close();
        action(event);
      });
      menu.append(row);
    }
    document.body.append(menu);
  });
  return button;
}

function titleIcon(iconName: string, title: string, action: () => void, extraClass = ""): HTMLButtonElement {
  const button = el("button", { className: `title-icon ${extraClass}`, title, children: [icon(iconName, title)] });
  button.addEventListener("click", action);
  return button;
}

function panelTitle(panel: PanelId): string {
  const titles: Record<PanelId, string> = {
    explorer: "EXPLORADOR",
    search: "PESQUISAR",
    source: "CONTROLE DE CÓDIGO-FONTE",
    run: "EXECUTAR E DEPURAR",
    extensions: "EXTENSÕES",
    remote: "HOST REMOTO",
    arduino: "ARDUINO",
    ai: "CONVERSA COM IA",
    settings: "CONFIGURAÇÕES",
    problems: "PROBLEMAS"
  };
  return titles[panel];
}

function extensionForAILanguage(language: string): string {
  const extensions: Record<string, string> = {
    typescript: ".ts", ts: ".ts", javascript: ".js", js: ".js", python: ".py", py: ".py",
    java: ".java", csharp: ".cs", cs: ".cs", cpp: ".cpp", c: ".c", rust: ".rs", go: ".go",
    html: ".html", css: ".css", json: ".json", markdown: ".md", md: ".md", shell: ".sh",
    bash: ".sh", powershell: ".ps1", php: ".php", ruby: ".rb", kotlin: ".kt"
  };
  return extensions[language.toLocaleLowerCase()] ?? ".txt";
}

function editorFontOptions(current: string): Array<{ value: string; label: string }> {
  if (EDITOR_FONT_OPTIONS.some(option => option.value === current)) return EDITOR_FONT_OPTIONS;
  return [{ value: current, label: `${current} (atual)` }, ...EDITOR_FONT_OPTIONS];
}

function statusEncodingLabel(encoding: TextEncoding): string {
  return encoding === "utf8bom" ? "UTF-8 com BOM" : encoding === "utf8" ? "UTF-8" : encoding.toUpperCase();
}

function settingsFooter(onReset: () => void, onSave: () => void): HTMLElement {
  const footer = el("div", { className: "settings-footer" });
  const path = el("span", { className: "settings-path", text: platform.isMobile ? "App Data/NPSharp/settings.json" : "~/.npsharp/settings.json" });
  const spacer = el("span", { className: "spacer" });
  const save = el("button", { className: "wide-action", text: "Salvar" });
  save.addEventListener("click", onSave);
  const reset = el("button", { className: "wide-action", text: "Redefinir" });
  reset.addEventListener("click", onReset);
  footer.append(path, spacer, save, reset);
  return footer;
}

function settingText(label: string, description: string, value: string, onChange: (value: string) => void): HTMLElement {
  const input = el("input", { className: "panel-input", attrs: { value } });
  input.addEventListener("change", () => onChange(input.value));
  return settingRow(label, description, input);
}

function settingNumber(label: string, description: string, value: number, min: number, max: number, step: number, onChange: (value: number) => void): HTMLElement {
  const input = el("input", {
    className: "panel-input",
    attrs: { type: "number", min: String(min), max: String(max), step: String(step), value: String(value) }
  });
  input.addEventListener("change", () => onChange(clampNumber(Number(input.value), min, max, value)));
  return settingRow(label, description, input);
}

function settingToggle(label: string, description: string, value: boolean, onChange: (value: boolean) => void): HTMLElement {
  const input = el("input", { attrs: { type: "checkbox" } });
  input.checked = value;
  input.addEventListener("change", () => onChange(input.checked));
  return settingRow(label, description, input);
}

function settingSelect(label: string, description: string, value: string, options: Array<{ value: string; label: string }>, onChange: (value: string) => void): HTMLElement {
  const select = el("select", { className: "panel-input" });
  for (const option of options) {
    select.append(el("option", { text: option.label, attrs: { value: option.value } }));
  }
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  return settingRow(label, description, select);
}

function settingRow(label: string, description: string, control: HTMLElement): HTMLElement {
  const row = el("label", { className: "setting-row" });
  const labels = el("span", { className: "setting-copy" });
  labels.append(el("strong", { text: label }), el("span", { text: description }));
  row.append(labels, control);
  return row;
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}
function shortcutFromEvent(event: KeyboardEvent): string {
  const parts: string[] = [];

  if (event.ctrlKey || event.metaKey) parts.push("Ctrl");
  if (event.shiftKey) parts.push("Shift");
  if (event.altKey) parts.push("Alt");

  let key = event.key;

  if (key === " ") key = "Space";
  if (key.length === 1) key = key.toUpperCase();

  if (["Control", "Shift", "Alt", "Meta"].includes(key)) return "";

  parts.push(key);
  return parts.join("+");
}
