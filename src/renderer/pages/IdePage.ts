import type { AppSettings, EditorDiagnostic, PersistedSession } from "../../shared/types";
import { ArduinoPanel } from "../components/ArduinoPanel";
import { CommandCenter, type CommandCenterAction, type CommandCenterShortcut } from "../components/CommandCenter";
import { CommandPalette, type CommandAction } from "../components/CommandPalette";
import { EditorTabs } from "../components/EditorTabs";
import { FileExplorer } from "../components/FileExplorer";
import { RemotePanel } from "../components/RemotePanel";
import { RuntimePanel } from "../components/RuntimePanel";
import { SearchPanel } from "../components/SearchPanel";
import { SourceControlPanel } from "../components/SourceControlPanel";
import { TerminalPanel } from "../components/TerminalPanel";
import { api, DEFAULT_MOBILE_WORKSPACE, MOBILE_ROOT, MOBILE_WORKSPACES_ROOT, platform } from "../services/api";
import { applyTheme, listThemes } from "../services/themes";
import { buttonIcon, el, icon } from "../utils/dom";
import { errorMessage, reportError } from "../utils/errors";
import { basename, dirname, extname, fileUri, joinPath } from "../utils/path";

type PanelId = "explorer" | "search" | "source" | "run" | "remote" | "arduino" | "settings" | "problems";
type SettingsCategory = "Appearance" | "Editor" | "Terminal" | "Diagnostics" | "Build" | "Workbench";
type MenuAction = (event: MouseEvent) => void;

export class IdePage {
  readonly element = el("main", { className: "app-shell" });
  private readonly wallpaper = el("div", { className: "wallpaper" });
  private readonly titleBar = el("header", { className: "title-bar" });
  private readonly activityBar = el("nav", { className: "activity-bar" });
  private readonly sideBar = el("aside", { className: "side-bar" });
  private readonly sideTitle = el("div", { className: "side-title", text: "EXPLORER" });
  private readonly sideContent = el("div", { className: "side-content" });
  private readonly workbench = el("section", { className: "workbench" });
  private readonly editorStack = el("section", { className: "editor-stack" });
  private readonly statusLeft = el("span", { text: "Ready" });
  private readonly statusRight = el("span", { text: "" });
  private readonly statusBarElement = el("footer", { className: "status-bar" });
  private readonly commandBar = el("input", { className: "command-bar", attrs: { readonly: "true" } });
  private readonly commandCenter = new CommandCenter(workspace => void this.openRecentWorkspace(workspace));
  private readonly editor = new EditorTabs(text => this.updateStatus(text));
  private readonly explorer = new FileExplorer(file => void this.editor.openFile(file), text => this.updateStatus(text));
  private readonly search = new SearchPanel(result => void this.editor.openSearchResult(result), text => this.updateStatus(text));
  private readonly source = new SourceControlPanel((title, uri, content) => this.editor.openVirtualFile(title, uri, content), text => this.updateStatus(text));
  private readonly terminal = new TerminalPanel(() => this.terminalCwd(), text => this.updateStatus(text), () => this.closeTerminalPanel());
  private readonly runtime = new RuntimePanel(() => this.runCurrentFile(), text => this.updateStatus(text));
  private readonly remote = new RemotePanel((title, uri, content, save) => this.editor.openVirtualFile(title, uri, content, save), text => this.updateStatus(text));
  private readonly arduino = new ArduinoPanel(() => this.explorer.workspace, file => this.editor.openFile(file), text => this.updateStatus(text));
  private readonly palette = new CommandPalette();
  private readonly problemsPanel = el("div", { className: "panel problems-panel" });
  private readonly panels = new Map<PanelId, HTMLElement>();
  private activePanel: PanelId = "explorer";
  private settings!: AppSettings;
  private session: PersistedSession = { openFiles: [], sidePanel: "explorer", terminalVisible: true };
  private diagnostics: EditorDiagnostic[] = [];
  private diagnosticIndex = -1;
  private pendingChord: string | undefined;
  private settingsCategory: SettingsCategory = "Appearance";
  private settingsQuery = "";
  private appPlatform = "";
  private appInfoPath = "";

  constructor() {
    void this.init().catch(error => this.renderFatalError(error));
    this.handleShortcut = this.handleShortcut.bind(this);
  }

  private async init(): Promise<void> {
    this.element.dataset.platform = platform.kind;
    this.settings = await api.settings.load();
    const appInfo = await api.appInfo();
    this.appPlatform = appInfo.platform;
    this.appInfoPath = appInfo.npsharpHome;
    this.terminal.setShell(this.terminalShell());
    this.session = await api.settings.loadSession();
    this.editor.applyTheme(await applyTheme(this.settings));
    this.applyWallpaper();
    this.editor.applySettings(this.settings);
    this.wireEvents();
    this.build();
    this.applyLayoutSettings();
    this.updateCommandCenter();
    this.registerCommands();
    await this.restoreSession();
  }

  private build(): void {
    this.buildTitleBar();
    this.buildActivityBar();
    this.buildSideBar();
    const center = el("section", { className: "center-area" });
    this.editor.element.append(this.commandCenter.element);
    this.editorStack.append(this.editor.element, this.terminal.element);
    this.setTerminalVisible(this.session.terminalVisible, false);
    center.append(this.activityBar, this.sideBar, this.editorStack);
    this.workbench.append(center);
    this.element.append(this.wallpaper, this.titleBar, this.workbench, this.statusBar());
    this.showPanel((this.session.sidePanel as PanelId) || "explorer");
  }

  private buildTitleBar(): void {
    const logo = el("div", { className: "title-logo" });
    logo.append(el("img", { attrs: { src: "/logos/app.png", alt: "NPSharp" } }), el("span", { text: "NPSharp" }));
    const menus = el("div", { className: "title-menus" });
    const openWorkspaceLabel = platform.isMobile ? "Open Mobile Workspace" : "Open Folder";
    menus.append(
      menuButton("File", [
        ["New File", "Ctrl+N", () => this.editor.newTab()],
        ["Open File", "Ctrl+O", () => void this.editor.openFileFromDialog()],
        [openWorkspaceLabel, "Ctrl+K Ctrl+O", () => void this.explorer.openFolderFromDialog()],
        ["Close Folder", "", () => this.explorer.clearFolder()],
        ["Save", "Ctrl+S", () => void this.editor.saveCurrentFile()],
        ["Save As", "Ctrl+Shift+S", () => void this.editor.saveCurrentFileAs()],
        ["Save All", "", () => void this.editor.saveAll()],
        ["Revert File", "", () => void this.editor.revertCurrentFile()],
        ["Close Editor", "Ctrl+W", () => this.editor.closeCurrentTab()],
        ["Close All Editors", "Ctrl+Shift+W", () => this.editor.closeAllTabs()]
      ]),
      menuButton("Edit", [
        ["Undo", "Ctrl+Z", () => this.editor.undo()],
        ["Redo", "Ctrl+Y", () => this.editor.redo()],
        ["Cut", "Ctrl+X", () => this.editor.cut()],
        ["Copy", "Ctrl+C", () => this.editor.copy()],
        ["Paste", "Ctrl+V", () => this.editor.paste()],
        ["Find", "Ctrl+F", () => this.editor.find()],
        ["Replace", "Ctrl+H", () => this.editor.replace()],
        ["Comment Line", "Ctrl+/", () => this.editor.addLineComment()],
        ["Uncomment Line", "Ctrl+Shift+/", () => this.editor.removeLineComment()],
        ["Comment Block", "Ctrl+Shift+/", () => this.editor.toggleBlockComment()],
        ["Go to Line", "Ctrl+G", () => this.editor.goToLine()],
        ["Go to Start", "Ctrl+Home", () => this.editor.goToStartOfFile()],
        ["Go to End", "Ctrl+End", () => this.editor.goToEndOfFile()],
        ["Format Document", "Shift+Alt+F", () => this.editor.formatDocument()]
      ]),
      menuButton("Selection", [
        ["Select All", "Ctrl+A", () => this.editor.selectAll()],
        ["Duplicate Line", "Ctrl+D", () => this.editor.duplicateCurrentLine()],
        ["Delete Line", "Ctrl+Shift+K", () => this.editor.deleteCurrentLine()],
        ["Move Line Up", "Ctrl+Up", () => this.editor.moveLineUp()],
        ["Move Line Down", "Ctrl+Down", () => this.editor.moveLineDown()]
      ]),
      menuButton("View", [
        ["Command Palette", "Ctrl+Shift+P", () => this.palette.showCommands()],
        ["Quick Open", "Ctrl+P", () => this.palette.showQuickOpen()],
        ["Explorer", "Ctrl+Shift+E", () => this.showPanel("explorer")],
        ["Search", "Ctrl+Shift+F", () => this.showPanel("search")],
        ["Source Control", "Ctrl+Shift+G", () => this.showPanel("source")],
        ["Run and Debug", "Ctrl+Shift+D", () => this.showPanel("run")],
        ["Arduino", "", () => this.showPanel("arduino")],
        ["Problems", "F8", () => this.showPanel("problems")],
        ["Debug Console", "", () => this.terminal.showDebugConsole()],
        ["Toggle Sidebar", "Ctrl+B", () => this.toggleSidebar()],
        ["Toggle Terminal", "Ctrl+`", () => this.toggleTerminal()]
      ]),
      menuButton("Run", [
        ["Run Current File", "F5", () => void this.runCurrentFile()],
        ["Build Project", "Ctrl+Shift+B", () => void this.buildProject()],
        ["Arduino", "", () => this.showPanel("arduino")],
        ["Runtime Paths", "", () => this.showPanel("run")]
      ]),
      menuButton("Terminal", [
        ["New Terminal", "Ctrl+Shift+`", () => this.showTerminal(true)],
        ["Output", "", () => this.terminal.showOutputPanel()],
        ["Problems", "", () => this.terminal.showProblemsPanel()],
        ["Debug Console", "", () => this.terminal.showDebugConsole()],
        ["Ports", "", () => this.terminal.showPortsPanel()],
        ["Git", "", () => this.terminal.showGitPanel()],
        ["Clear", "", () => this.terminal.clearCurrentTerminal()],
        ["Kill", "", () => this.terminal.killCurrentTerminal()]
      ]),
      menuButton("Preferences", [
        ["Command Palette", "Ctrl+Shift+P", () => this.palette.showCommands()],
        ["Settings", "Ctrl+,", () => this.showSettings()],
        ["Color Theme", "", event => void this.showThemePicker(event.shiftKey)],
        ["Wallpaper", "", () => void this.chooseWallpaper()],
        ["Clear Wallpaper", "", () => void this.clearWallpaper()],
        ["Toggle ErrorLens", "", () => this.toggleErrorLens()],
        ["About NPSharp", "", () => this.about()]
      ])
    );
    this.commandBar.value = this.commandLabel();
    this.commandBar.addEventListener("click", () => this.palette.showQuickOpen());
    const nav = el("div", { className: "title-nav" });
    nav.append(buttonIcon("arrow-left", "Back", () => this.updateStatus("Back")), buttonIcon("arrow-right", "Forward", () => this.updateStatus("Forward")));
    const windowButtons = el("div", { className: "window-buttons" });
    if (platform.isDesktop) {
      windowButtons.append(
        titleIcon("chrome-minimize", "Minimize", () => void api.window.minimize()),
        titleIcon("chrome-maximize", "Maximize", () => void api.window.maximize()),
        titleIcon("chrome-close", "Close", () => void api.window.close(), "close")
      );
    }
    this.titleBar.append(logo, menus, nav, this.commandBar, windowButtons);
  }

  private buildActivityBar(): void {
    this.activityBar.append(
      this.activityButton("explorer", "files", "Explorer"),
      this.activityButton("search", "search", "Search"),
      this.activityButton("source", "source-control", "Source Control"),
      this.activityButton("run", "debug-alt", "Run and Debug"),
      this.activityButton("remote", "remote", "Remote Host"),
      this.activityButton("arduino", "circuit-board", "Arduino"),
      this.activityButton("problems", "warning", "Problems"),
      el("div", { className: "activity-spacer" }),
      this.settingsActivityButton()
    );
  }

  private buildSideBar(): void {
    this.panels.set("explorer", this.explorer.element);
    this.panels.set("search", this.search.element);
    this.panels.set("source", this.source.element);
    this.panels.set("run", this.runtime.element);
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
    const git = el("button", { className: "status-item", text: "Git" });
    git.addEventListener("click", () => this.showPanel("source"));
    const run = el("button", { className: "status-item", text: "Run" });
    run.addEventListener("click", () => void this.runCurrentFile());
    const terminal = el("button", { className: "status-item", text: "Terminal" });
    terminal.addEventListener("click", () => this.toggleTerminal());
    left.append(git, run, terminal, this.statusLeft);
    right.append(this.statusRight);
    status.append(left, right);
    return status;
  }

  private wireEvents(): void {
    this.explorer.onWorkspaceChanged = workspace => {
      this.search.setWorkspace(workspace);
      void this.source.setWorkspace(workspace);
      this.palette.setWorkspace(workspace);
      if (workspace) this.rememberWorkspace(workspace);
      this.commandBar.value = this.commandLabel();
      this.updateCommandCenter();
      this.persist();
      void this.runDiagnostics();
    };
    this.editor.onTabsChanged = () => {
      this.palette.setQuickOpenFiles([...this.editor.getOpenFiles(), ...this.editor.getRecentFiles()]);
      this.updateCommandCenter();
      this.persist();
    };
    this.editor.onFileActivated = file => {
      if (file) void this.explorer.revealFile(file);
      this.commandBar.value = this.commandLabel();
      this.updateCommandCenter();
      this.persist();
      void this.runDiagnostics();
    };
    this.editor.onFileSaved = () => {
      if (this.settings.compileOnSave) void this.runDiagnostics();
    };
    this.palette.setFileOpener(file => void this.editor.openFile(file));
    window.addEventListener("keydown", this.handleShortcut, true);
    window.addEventListener("error", event => this.updateStatus(`Error: ${errorMessage(event.error ?? event.message)}`));
    window.addEventListener("unhandledrejection", event => this.updateStatus(`Error: ${errorMessage(event.reason)}`));
    const events = window as typeof window & { npsharpEvents?: { onCommand(callback: (command: string) => void): () => void } };
    events.npsharpEvents?.onCommand(command => this.handleCommand(command));
  }

  private registerCommands(): void {
    const commands: CommandAction[] = [
      { label: "File: New File", shortcut: "Ctrl+N", run: () => this.editor.newTab() },
      { label: "File: Open File", shortcut: "Ctrl+O", run: () => this.editor.openFileFromDialog() },
      { label: "File: Open Folder", shortcut: "Ctrl+K Ctrl+O", run: () => this.explorer.openFolderFromDialog() },
      { label: "File: Save", shortcut: "Ctrl+S", run: () => this.editor.saveCurrentFile() },
      { label: "File: Save As", shortcut: "Ctrl+Shift+S", run: () => this.editor.saveCurrentFileAs() },
      { label: "File: Save All", run: () => this.editor.saveAll() },
      { label: "File: Close Editor", shortcut: "Ctrl+W", run: () => this.editor.closeCurrentTab() },
      { label: "File: Close All Editors", shortcut: "Ctrl+Shift+W", run: () => this.editor.closeAllTabs() },
      { label: "Editor: Go to Line", shortcut: "Ctrl+G", run: () => this.editor.goToLine() },
      { label: "Editor: Add Line Comment", shortcut: "Ctrl+/", run: () => this.editor.addLineComment() },
      { label: "Editor: Remove Line Comment", shortcut: "Ctrl+Shift+/", run: () => this.editor.removeLineComment() },
      { label: "Editor: Toggle Block Comment", shortcut: "Ctrl+Shift+/", run: () => this.editor.toggleBlockComment() },
      { label: "Editor: Format Document", shortcut: "Shift+Alt+F", run: () => this.editor.formatDocument() },
      { label: "View: Explorer", shortcut: "Ctrl+Shift+E", run: () => this.showPanel("explorer") },
      { label: "View: Search", shortcut: "Ctrl+Shift+F", run: () => this.showPanel("search") },
      { label: "View: Source Control", shortcut: "Ctrl+Shift+G", run: () => this.showPanel("source") },
      { label: "View: Run and Debug", shortcut: "Ctrl+Shift+D", run: () => this.showPanel("run") },
      { label: "View: Arduino", run: () => this.showPanel("arduino") },
      { label: "View: Problems", shortcut: "F8", run: () => this.showPanel("problems") },
      { label: "Terminal: Toggle Terminal", shortcut: "Ctrl+`", run: () => this.toggleTerminal() },
      { label: "Terminal: New Terminal", shortcut: "Ctrl+Shift+`", run: () => this.showTerminal(true) },
      { label: "Terminal: Output", run: () => this.terminal.showOutputPanel() },
      { label: "Terminal: Debug Console", run: () => this.terminal.showDebugConsole() },
      { label: "Run: Run Current File", shortcut: "F5", run: () => this.runCurrentFile() },
      { label: "Run: Build Project", shortcut: "Ctrl+Shift+B", run: () => this.buildProject() },
      { label: "Preferences: Settings", shortcut: "Ctrl+,", run: () => this.showSettings() },
      { label: "Preferences: Color Theme", run: () => this.showThemePicker() },
      { label: "Preferences: Wallpaper", run: () => this.chooseWallpaper() },
      { label: "Preferences: Clear Wallpaper", run: () => this.clearWallpaper() },
      { label: "Preferences: ErrorLens Toggle", run: () => this.toggleErrorLens() },
      { label: "Notes: Show Notes", run: () => this.openNotes() },
      { label: "Search: Find", shortcut: "Ctrl+F", run: () => this.editor.find() },
      { label: "Search: Replace", shortcut: "Ctrl+H", run: () => this.editor.replace() },
      { label: "Search: Find in Workspace", shortcut: "Ctrl+Shift+F", run: () => this.showPanel("search") },
      { label: "Editor: Comment Line", shortcut: "Ctrl+/", run: () => this.editor.addLineComment() },
      { label: "Editor: Add Line Comment", shortcut: "Ctrl+K Ctrl+C", run: () => this.editor.addLineComment() },
      { label: "Editor: Remove Line Comment", shortcut: "Ctrl+K Ctrl+U", run: () => this.editor.removeLineComment() },
      { label: "Editor: Toggle Block Comment", shortcut: "Shift+Alt+A", run: () => this.editor.toggleBlockComment() },

      { label: "View: Command Palette", shortcut: "Ctrl+Shift+P", run: () => this.palette.showCommands() },
      { label: "View: Quick Open", shortcut: "Ctrl+P", run: () => this.palette.showQuickOpen() },
      { label: "View: Explorer", shortcut: "Ctrl+Shift+E", run: () => this.showPanel("explorer") },
      { label: "View: Source Control", shortcut: "Ctrl+Shift+G", run: () => this.showPanel("source") },
      { label: "View: Problems", shortcut: "Ctrl+Shift+M", run: () => this.showPanel("problems") },
      { label: "View: Toggle Sidebar", shortcut: "Ctrl+B", run: () => this.toggleSidebar() },
      { label: "Terminal: Toggle Terminal", shortcut: "Ctrl+`", run: () => this.toggleTerminal() },
      { label: "Terminal: New Terminal", shortcut: "Ctrl+Shift+`", run: () => this.showTerminal(true) },
      { label: "Terminal: Clear", shortcut: "Ctrl+Alt+K", run: () => this.terminal.clearCurrentTerminal() },
      { label: "Run: Run Current File", shortcut: "F5", run: () => this.runCurrentFile() },
      { label: "Run: Build Project", shortcut: "Ctrl+Shift+B", run: () => this.buildProject() },
      { label: "NPSharp: Notes", shortcut: "Ctrl+Alt+N", run: () => this.openNotes() },
      { label: "NPSharp: Command Center", shortcut: "Ctrl+Alt+C", run: () => this.updateStatus("Command Center") },
      { label: "NPSharp: Theme Picker", shortcut: "Ctrl+Alt+T", run: () => this.showThemePicker() },
    ];
    this.palette.setCommands(commands);
    }

  private async restoreSession(): Promise<void> {
    try {
      if (this.session.workspace && await api.fs.exists(this.session.workspace)) {
        await this.explorer.openFolder(this.session.workspace);
      }
      await this.editor.restoreFiles(this.session.openFiles, this.session.activeFile);
      this.showPanel((this.session.sidePanel as PanelId) || "explorer");
      this.setTerminalVisible(this.session.terminalVisible, false);
      this.updateCommandCenter();
    } catch (error) {
      reportError(error, text => this.updateStatus(text), "Restore session failed");
    }
  }

  private showPanel(panelId: PanelId): void {
    this.activePanel = panelId;
    this.sideBar.hidden = false;
    this.sideContent.replaceChildren(this.panels.get(panelId) ?? this.explorer.element);
    this.sideTitle.textContent = panelTitle(panelId);
    for (const button of this.activityBar.querySelectorAll<HTMLElement>(".activity-button")) {
      button.classList.toggle("active", button.dataset.panel === panelId);
    }
    if (panelId === "search") this.search.focus();
    if (panelId === "source") void this.source.refresh();
    if (panelId === "run") void this.runtime.refresh();
    if (panelId === "remote") void this.remote.refresh();
    if (panelId === "arduino") void this.arduino.refresh();
    this.persist();
  }

  private showSettings(category?: SettingsCategory): void {
    if (category) this.settingsCategory = category;
    const settingsPanel = this.panels.get("settings");
    if (settingsPanel) void this.renderSettings(settingsPanel);
    this.showPanel("settings");
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
    const button = el("button", { className: "activity-button", title: "Manage", children: [icon("settings-gear", "Manage")] });
    button.addEventListener("click", event => {
      event.stopPropagation();
      this.showSettingsMenu(button);
    });
    return button;
  }

  private showSettingsMenu(anchor: HTMLElement): void {
    document.querySelector(".context-menu")?.remove();
    const rect = anchor.getBoundingClientRect();
    const menu = el("div", { className: "context-menu manage-menu" });
    menu.addEventListener("click", event => event.stopPropagation());

    const close = () => menu.remove();
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

    addRow("Command Palette...", "Ctrl+Shift+P", () => this.palette.showCommands());
    addRow("Settings", "Ctrl+,", () => this.showSettings());
    addRow("Keyboard Shortcuts", "Ctrl+K Ctrl+S", () => this.updateStatus("Keyboard Shortcuts"));
    addRow("Snippets", "", () => this.updateStatus("Snippets"));
    addRow("Tasks", "", () => this.updateStatus("Tasks"));
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
    addAppearanceRow("Color Theme...", "Escolher", event => void this.showThemePicker(event.shiftKey));
    addAppearanceRow("Wallpaper...", "Escolher", () => void this.chooseWallpaper());
    addAppearanceRow("Clear Wallpaper", "", () => void this.clearWallpaper());
    menu.append(appearance);

    addRow(this.settings.errorLensEnabled ? "Disable ErrorLens" : "Enable ErrorLens", "", () => this.toggleErrorLens());
    addSeparator();
    addRow("Backup and Sync Settings...", "", () => this.updateStatus("Backup and Sync Settings"));
    addRow("Download Update (1)");

    document.body.append(menu);
    const left = Math.min(rect.right + 2, window.innerWidth - menu.offsetWidth - 8);
    const top = Math.min(rect.top, window.innerHeight - menu.offsetHeight - 8);
    menu.style.left = `${Math.max(8, left)}px`;
    menu.style.top = `${Math.max(8, top)}px`;
    setTimeout(() => document.addEventListener("click", close, { once: true }), 0);
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
      attrs: { placeholder: "Search settings", value: this.settingsQuery }
    });
    const layout = el("div", { className: "settings-view" });
    const categories = el("div", { className: "settings-categories" });
    const page = el("div", { className: "settings-page" });
    const categoryNames: SettingsCategory[] = ["Appearance", "Editor", "Terminal", "Diagnostics", "Build", "Workbench"];

    for (const category of categoryNames) {
      const button = el("button", { className: `settings-category ${category === this.settingsCategory ? "active" : ""}`, text: category });
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
      () => this.updateStatus("Settings saved")
    ));
    await this.renderSettingsPage(page);
  }

  private async showThemePicker(includeSpecial = false): Promise<void> {
    try {
      const themes = await listThemes();
      const visibleThemes = themes.filter(theme => includeSpecial || !theme.special);
      this.palette.showPicker("Select Color Theme", visibleThemes.map(theme => {
        const active = theme.id === this.settings.theme || theme.name === this.settings.theme;
        return {
          label: theme.name,
          hint: active ? "Current" : theme.special ? "Special" : theme.uiTheme === "vs" ? "Light" : "Dark",
          active,
          swatch: theme.colors["--accent"],
          run: () => this.updateSettings({ ...this.settings, theme: theme.id })
        };
      }));
    } catch (error) {
      reportError(error, text => this.updateStatus(text), "Theme picker failed");
    }
  }

  private async renderSettingsPage(page: HTMLElement): Promise<void> {
    page.replaceChildren();
    const query = this.settingsQuery.trim().toLowerCase();
    const themes = await listThemes();
    const regularThemes = themes.filter(theme => !theme.special);
    const themeOptions = regularThemes.map(theme => ({ value: theme.id, label: theme.name }));

    if (query) {
      page.append(el("h2", { className: "settings-page-title", text: "Search results" }));
      const beforeCount = page.childElementCount;
      this.appendSearchSetting(page, query, "theme appearance color", () =>
        settingSelect("Theme", "UI theme.", this.settings.theme, themeOptions, value => void this.updateSettings({ ...this.settings, theme: value }))
      );
      this.appendSearchSetting(page, query, "font editor family", () =>
        settingText("Editor Font Family", "Editor font.", this.settings.editorFontFamily, value => void this.updateSettings({ ...this.settings, editorFontFamily: value.trim() || "JetBrains Mono" }))
      );
      this.appendSearchSetting(page, query, "font size editor", () =>
        settingNumber("Editor Font Size", "Editor font size.", this.settings.editorFontSize, 8, 40, 1, value => void this.updateSettings({ ...this.settings, editorFontSize: value }))
      );
      this.appendSearchSetting(page, query, "brand special custom pink highlight editor", () =>
        settingText("Special Brand Name", "Custom pink brand highlight.", this.settings.brandSpecialName, value => void this.updateSettings({ ...this.settings, brandSpecialName: value.trim() }))
      );
      this.appendSearchSetting(page, query, "word wrap editor", () =>
        settingToggle("Word Wrap", "Wrap long lines.", this.settings.editorWordWrap, value => void this.updateSettings({ ...this.settings, editorWordWrap: value }))
      );
      this.appendSearchSetting(page, query, "terminal shell", () =>
        settingToggle("Terminal Enabled", "Enable integrated terminal.", this.settings.terminalEnabled, value => void this.updateSettings({ ...this.settings, terminalEnabled: value }))
      );
      this.appendSearchSetting(page, query, "diagnostics errorlens errors warnings inline", () =>
        settingToggle("ErrorLens Enabled", "Show diagnostics inline.", this.settings.errorLensEnabled, value => void this.updateSettings({ ...this.settings, errorLensEnabled: value }))
      );
      this.appendSearchSetting(page, query, "compile save diagnostics", () =>
        settingToggle("Compile On Save", "Compile Java on save.", this.settings.compileOnSave, value => void this.updateSettings({ ...this.settings, compileOnSave: value }))
      );
      this.appendSearchSetting(page, query, "build command maven", () =>
        settingText("Build Command", "Build command.", this.settings.buildCommand, value => void this.updateSettings({ ...this.settings, buildCommand: value.trim() || "mvn -q -DskipTests compile" }))
      );
      if (page.childElementCount === beforeCount) page.append(el("div", { className: "muted-row", text: "No settings found." }));
      return;
    }

    page.append(el("h2", { className: "settings-page-title", text: this.settingsCategory }));

    if (this.settingsCategory === "Appearance") {
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
      page.append(settingText("Icon Theme", "Icon theme.", this.settings.iconTheme, value => void this.updateSettings({ ...this.settings, iconTheme: value.trim() || "default" })));
      page.append(settingText("Icon Color", "Icon color when supported by theme.", this.settings.iconColor, value => void this.updateSettings({ ...this.settings, iconColor: value.trim() })));
      page.append(settingText("Wallpaper Path", "Background image path.", this.settings.wallpaperPath, value => void this.updateSettings({ ...this.settings, wallpaperPath: value.trim() })));
      page.append(settingNumber("Wallpaper Opacity", "Wallpaper opacity.", this.settings.wallpaperOpacity, 0, 1, 0.05, value => void this.updateSettings({ ...this.settings, wallpaperOpacity: value })));
      const actions = el("div", { className: "settings-inline-actions" });
      const choose = el("button", { className: "wide-action", text: "Choose Wallpaper" });
      choose.addEventListener("click", () => void this.chooseWallpaper());
      const clear = el("button", { className: "wide-action", text: "Clear Wallpaper" });
      clear.addEventListener("click", () => void this.clearWallpaper());
      actions.append(choose, clear);
      page.append(actions);
      return;
    }

    if (this.settingsCategory === "Editor") {
      page.append(settingText("Font Family", "Font used in the editor.", this.settings.editorFontFamily, value => void this.updateSettings({ ...this.settings, editorFontFamily: value.trim() || "JetBrains Mono" })));
      page.append(settingNumber("Font Size", "Editor font size.", this.settings.editorFontSize, 8, 40, 1, value => void this.updateSettings({ ...this.settings, editorFontSize: value })));
      page.append(settingNumber("Tab Size", "Tab width.", this.settings.editorTabSize, 1, 12, 1, value => void this.updateSettings({ ...this.settings, editorTabSize: value })));
      page.append(settingToggle("Word Wrap", "Wrap long lines.", this.settings.editorWordWrap, value => void this.updateSettings({ ...this.settings, editorWordWrap: value })));
      page.append(settingToggle("Line Numbers", "Show line numbers.", this.settings.editorLineNumbers, value => void this.updateSettings({ ...this.settings, editorLineNumbers: value })));
      page.append(settingToggle("Auto Save", "Save automatically.", this.settings.editorAutoSave, value => void this.updateSettings({ ...this.settings, editorAutoSave: value })));
      page.append(settingToggle("Format On Save", "Format when saving.", this.settings.editorFormatOnSave, value => void this.updateSettings({ ...this.settings, editorFormatOnSave: value })));
      page.append(settingText("Special Brand Name", "Custom pink brand highlight.", this.settings.brandSpecialName, value => void this.updateSettings({ ...this.settings, brandSpecialName: value.trim() })));
      return;
    }

    if (this.settingsCategory === "Terminal") {
      page.append(settingToggle("Terminal Enabled", "Enable integrated terminal.", this.settings.terminalEnabled, value => void this.updateSettings({ ...this.settings, terminalEnabled: value })));
      page.append(settingText("Linux/macOS Shell", "Default shell on Linux and macOS.", this.settings.terminalShellLinux, value => void this.updateSettings({ ...this.settings, terminalShellLinux: value.trim() || "/bin/bash" })));
      page.append(settingText("Windows Shell", "Default shell on Windows.", this.settings.terminalShellWindows, value => void this.updateSettings({ ...this.settings, terminalShellWindows: value.trim() || "powershell.exe" })));
      page.append(settingText("Initial Directory", "Terminal initial directory.", this.settings.terminalInitialDirectory, value => void this.updateSettings({ ...this.settings, terminalInitialDirectory: value.trim() })));
      return;
    }

    if (this.settingsCategory === "Diagnostics") {
      page.append(settingToggle("Diagnostics Enabled", "Enable diagnostics.", this.settings.diagnosticsEnabled, value => void this.updateSettings({ ...this.settings, diagnosticsEnabled: value })));
      page.append(settingToggle("ErrorLens Enabled", "Show diagnostics inline in the editor.", this.settings.errorLensEnabled, value => void this.updateSettings({ ...this.settings, errorLensEnabled: value })));
      page.append(settingToggle("Compile On Save", "Compile Java when saving.", this.settings.compileOnSave, value => void this.updateSettings({ ...this.settings, compileOnSave: value })));
      page.append(settingToggle("Problems Auto Open", "Open Problems when diagnostics fail.", this.settings.problemsAutoOpen, value => void this.updateSettings({ ...this.settings, problemsAutoOpen: value })));
      return;
    }

    if (this.settingsCategory === "Build") {
      page.append(settingText("Build Command", "Command used to build the project.", this.settings.buildCommand, value => void this.updateSettings({ ...this.settings, buildCommand: value.trim() || "mvn -q -DskipTests compile" })));
      page.append(settingToggle("Skip Tests", "Skip tests during build.", this.settings.buildSkipTests, value => void this.updateSettings({ ...this.settings, buildSkipTests: value })));
      return;
    }

    page.append(settingToggle("Status Bar Visible", "Show the bottom status bar.", this.settings.statusBarVisible, value => void this.updateSettings({ ...this.settings, statusBarVisible: value })));
    page.append(settingToggle("Activity Bar Visible", "Show the activity bar.", this.settings.activityBarVisible, value => void this.updateSettings({ ...this.settings, activityBarVisible: value })));
    page.append(settingToggle("Side Bar Visible", "Show the side panel.", this.settings.sideBarVisible, value => void this.updateSettings({ ...this.settings, sideBarVisible: value })));
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
    await this.applySettingsEffects();
  }

  private async resetSettings(): Promise<void> {
    this.settings = await api.settings.reset();
    await this.applySettingsEffects();
    this.updateStatus("Settings reset");
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

  private async applySettingsEffects(): Promise<void> {
    this.terminal.setShell(this.terminalShell());
    this.editor.applyTheme(await applyTheme(this.settings));
    this.applyWallpaper();
    this.applyLayoutSettings();
    this.editor.applySettings(this.settings);
    if (this.activePanel === "settings") {
      const settingsPanel = this.panels.get("settings");
      if (settingsPanel) void this.renderSettings(settingsPanel);
    }
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
    const result = await api.dialog.chooseWallpaper();
    if (!result.canceled && result.paths[0]) {
      await this.updateSettings({ ...this.settings, wallpaperPath: result.paths[0] });
    }
  }

  private async createProject(): Promise<void> {
    if (!platform.isDesktop) {
      const name = prompt("Nome do workspace mobile", "Main");
      if (!name?.trim()) return;
      const target = joinPath(MOBILE_WORKSPACES_ROOT, sanitizeWorkspaceName(name));
      try {
        await api.fs.createFolder(target);
        await this.explorer.openFolder(target);
        this.showPanel("explorer");
        this.updateStatus(`Workspace mobile criado: ${target}`);
      } catch (error) {
        reportError(error, text => this.updateStatus(text), "Create mobile workspace failed");
      }
      return;
    }

    const projectPath = prompt("Caminho completo do novo projeto");
    const target = projectPath?.trim();
    if (!target) return;
    if (!isAbsolutePath(target)) {
      this.updateStatus("Informe um caminho absoluto para criar o projeto.");
      return;
    }
    try {
      await api.fs.createFolder(target);
      await this.explorer.openFolder(target);
      this.showPanel("explorer");
      this.updateStatus(`Projeto criado: ${target}`);
    } catch (error) {
      reportError(error, text => this.updateStatus(text), "Create project failed");
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
      } catch {
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

  private applyWallpaper(): void {
    if (!this.settings?.wallpaperPath) {
      this.wallpaper.style.backgroundImage = "";
      return;
    }
    if (!platform.isDesktop && !/^(blob:|data:|https?:)/i.test(this.settings.wallpaperPath)) {
      this.wallpaper.style.backgroundImage = "";
      return;
    }
    const wallpaper = platform.isDesktop ? fileUri(this.settings.wallpaperPath) : this.settings.wallpaperPath;
    this.wallpaper.style.backgroundImage = `url("${wallpaper}")`;
    this.wallpaper.style.opacity = String(this.settings.wallpaperOpacity);
  }

  private async runCurrentFile(): Promise<void> {
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
      this.terminal.showDebugConsole();
      this.terminal.appendDebugOutput(`[DEBUG] Arquivo detectado: ${basename(filePath)}`);

      if (/\.html?$/i.test(filePath)) {
        if (platform.canUseLiveServer && this.explorer.workspace) {
          const result = await api.liveServer.open({ workspace: this.explorer.workspace, filePath });
          this.terminal.appendDebugOutput(result.output);
          if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
          this.updateStatus(result.success ? "Live Server aberto" : "Live Server falhou");
        } else {
          this.showHtmlPreview(basename(filePath), this.editor.getCurrentText());
          this.terminal.appendDebugOutput("Preview HTML aberto sem iniciar servidor Node.");
          this.updateStatus("Preview HTML aberto");
        }
        return;
      }

      if (!platform.canUseNodeBackend) {
        const result = await api.runtime.runFile({ filePath, content: this.editor.getCurrentText() });
        this.terminal.appendDebugOutput(result.output);
        this.updateStatus("Runtime local indisponivel neste ambiente");
        return;
      }

      const result = await api.runtime.runFile({ filePath, content: this.editor.getCurrentText() });
      this.terminal.appendDebugOutput(result.output);
      this.updateStatus(result.code === 0 ? "Run completed" : "Run failed");
    } catch (error) {
      reportError(error, text => this.updateStatus(text), "Run failed");
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
      } catch {
        this.updateStatus("package.json invalido para Run");
      }
    }

    if (await api.fs.exists(joinPath(workspace, "pom.xml"))) return "mvn javafx:run";
    if (await api.fs.exists(joinPath(workspace, "gradlew"))) return this.appPlatform === "win32" ? "gradlew.bat run" : "./gradlew run";
    if (await api.fs.exists(joinPath(workspace, "gradlew.bat"))) return this.appPlatform === "win32" ? "gradlew.bat run" : "./gradlew run";
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
    const visible = !this.explorer.workspace && !this.editor.activeTab;
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
      { id: "terminal", label: platform.canUseTerminal ? "Abrir terminal" : "Abrir Output", detail: platform.canUseTerminal ? "Abrir o terminal integrado." : "Terminal real indisponivel neste ambiente.", iconName: "terminal", run: () => this.showTerminal(true) },
      { id: "arduino", label: "Arduino", detail: platform.canUseNodeBackend ? "Boards, portas, compile e upload via Arduino CLI." : "Modo limitado para sketches Arduino.", iconName: "circuit-board", run: () => this.showPanel("arduino") },
      { id: "notes", label: "Abrir Notes", detail: platform.isMobile ? "Abrir ou criar Documents/NPSharp/notes.nps.md." : "Abrir ou criar .npsharp/notes.nps.md.", iconName: "note", run: () => void this.openNotes() },
      { id: "theme-lab", label: "Abrir Theme Lab", detail: "Abrir o seletor de temas incluindo especiais.", iconName: "paintcan", run: () => void this.showThemePicker(true) },
      { id: "settings", label: "Configurações", detail: "Abrir ajustes do editor.", iconName: "settings-gear", run: () => this.showSettings() },
      { id: "run", label: "Rodar projeto", detail: hasRunnableTarget ? (platform.canUseNodeBackend ? "Executar o arquivo/projeto atual." : "Preview HTML ou fallback de runtime.") : "Abra um arquivo primeiro.", iconName: "play", disabled: !hasRunnableTarget, run: () => void this.runCurrentFile() },
      { id: "git-status", label: "Source Control", detail: platform.canUseGit ? (hasProject ? "Abrir Source Control do workspace." : "Abra um workspace primeiro.") : "Abrir Source Control em modo limitado.", iconName: "source-control", disabled: platform.canUseGit && !hasProject, run: () => this.showPanel("source") }
    ];
  }

  private commandCenterShortcuts(): CommandCenterShortcut[] {
    return [
      { label: "Command Palette", keys: "Ctrl+Shift+P" },
      { label: platform.isMobile ? "Workspace mobile" : "Abrir pasta", keys: "Ctrl+K Ctrl+O" },
      { label: "Quick Open", keys: "Ctrl+P" },
      { label: platform.canUseTerminal ? "Terminal" : "Output", keys: "Ctrl+`" },
      { label: "Configurações", keys: "Ctrl+," },
      { label: "Rodar", keys: "F5" }
    ];
  }

  private renderProblems(): void {
    this.problemsPanel.replaceChildren(el("div", { className: "panel-summary", text: `${this.diagnostics.length} problem(s)` }));
    for (const diagnostic of this.diagnostics) {
      const row = el("button", { className: `problem-row ${diagnostic.severity.toLowerCase()}` });
      row.append(el("strong", { text: diagnostic.severity }), el("span", { text: `${basename(diagnostic.filePath)} Ln ${diagnostic.line}, Col ${diagnostic.column}` }), el("span", { text: diagnostic.message }));
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
        ? "Terminal real Node nao esta disponivel no mobile. Output/Command Log ativo."
        : "Terminal real nao esta disponivel no modo web. Output/Command Log ativo.");
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
    this.updateStatus("Terminal hidden");
  }

  private setTerminalVisible(visible: boolean, persist = true): void {
    this.terminal.element.hidden = !visible;
    this.editorStack.classList.toggle("terminal-visible", visible);
    this.session.terminalVisible = visible;
    requestAnimationFrame(() => this.editor.layout());
    if (persist) this.persist();
  }

  private toggleSidebar(): void {
    this.sideBar.hidden = !this.sideBar.hidden;
    this.updateStatus(this.sideBar.hidden ? "Sidebar hidden" : panelTitle(this.activePanel));
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

if (isTyping && !["Ctrl+F", "Ctrl+H", "Ctrl+S", "Ctrl+Shift+P", "Ctrl+P"].includes(key)) {
  return;
}

  const chord = this.pendingChord ? `${this.pendingChord} ${key}` : key;

  const run = (action: () => void): void => {
    event.preventDefault();
    event.stopPropagation();
    this.pendingChord = undefined;
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
  run(() => this.updateStatus("Keyboard Shortcuts"));
  return;
  }

  if (key === "Ctrl+K") {
    event.preventDefault();
    event.stopPropagation();

    this.pendingChord = "Ctrl+K";
    this.updateStatus("Ctrl+K...");

    window.setTimeout(() => {
      if (this.pendingChord === "Ctrl+K") {
        this.pendingChord = undefined;
        this.updateStatus("Atalho cancelado");
      }
    }, 1600);

    return;
  }

  switch (key) {
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

    case "Shift+Alt+A":
      run(() => this.editor.toggleBlockComment());
      return;

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
      run(() => this.runCurrentFile());
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
      "file:closeAll": () => this.editor.closeAllTabs(),
      "workspace:openFolder": () => void this.explorer.openFolderFromDialog(),
      "editor:find": () => this.editor.find(),
      "editor:replace": () => this.editor.replace(),
      "editor:commentLine": () => this.editor.addLineComment(),
      "editor:uncommentLine": () => this.editor.removeLineComment(),
      "editor:commentBlock": () => this.editor.toggleBlockComment(),
      "editor:goToLine": () => this.editor.goToLine(),
      "editor:start": () => this.editor.goToStartOfFile(),
      "editor:end": () => this.editor.goToEndOfFile(),
      "editor:format": () => this.editor.formatDocument(),
      "view:explorer": () => this.showPanel("explorer"),
      "view:search": () => this.showPanel("search"),
      "view:source": () => this.showPanel("source"),
      "view:run": () => this.showPanel("run"),
      "view:arduino": () => this.showPanel("arduino"),
      "view:problems": () => this.showPanel("problems"),
      "view:debugConsole": () => this.terminal.showDebugConsole(),
      "view:commandPalette": () => this.palette.showCommands(),
      "view:settings": () => this.showSettings(),
      "view:terminal": () => this.toggleTerminal(),
      "terminal:new": () => this.showTerminal(true),
      "terminal:output": () => this.terminal.showOutputPanel(),
      "terminal:problems": () => this.terminal.showProblemsPanel(),
      "terminal:debug": () => this.terminal.showDebugConsole(),
      "terminal:ports": () => this.terminal.showPortsPanel(),
      "terminal:git": () => this.terminal.showGitPanel(),
      "terminal:clear": () => this.terminal.clearCurrentTerminal(),
      "tools:run": () => void this.runCurrentFile(),
      "tools:build": () => void this.buildProject(),
      "git:pull": () => void this.source.runOnFirstRepo(["pull"]),
      "git:push": () => void this.source.runOnFirstRepo(["push"]),
      "git:fetch": () => void this.source.runOnFirstRepo(["fetch"]),
      "preferences:theme": () => void this.showThemePicker(),
      "preferences:wallpaper": () => void this.chooseWallpaper(),
      "preferences:clearWallpaper": () => void this.clearWallpaper(),
      "preferences:errorLensToggle": () => this.toggleErrorLens(),
      "help:about": () => this.about(),
      "notes:open": () => void this.openNotes()
    };
    map[command]?.();
  }

  private updateStatus(text: string): void {
    this.statusLeft.textContent = text;
    this.statusRight.textContent = this.editor.getCurrentFile() ? basename(this.editor.getCurrentFile()!) : "NPSharp";
  }

  private commandLabel(): string {
    return this.explorer.workspace ? basename(this.explorer.workspace) : "Search files and commands";
  }

  private persist(): void {
    this.session.workspace = this.explorer.workspace;
    if (this.explorer.workspace) this.rememberWorkspace(this.explorer.workspace);
    this.session.openFiles = this.editor.getOpenFiles();
    this.session.activeFile = this.editor.getCurrentFile();
    this.session.sidePanel = this.activePanel;
    this.session.terminalVisible = !this.terminal.element.hidden;
    void api.settings.saveSession(this.session);
  }
private about(): void {
  alert(`NPSharp IDE
Version 1.0.2

Developed by CoreLabs.

Code without distractions.

NPSharp is a fast, modern and developer-first IDE created to provide a clean and efficient coding experience. Combining the power of Monaco Editor with Electron, it delivers a familiar environment enhanced with custom themes, integrated tools, source control, terminal support and a workflow built for real-world software development.

Designed by developers, for developers.

© ${new Date().getFullYear()} CoreLabs. All rights reserved.`);
}

  private renderFatalError(error: unknown): void {
    this.element.replaceChildren(
      el("section", {
        className: "fatal-screen",
        children: [
          el("img", { className: "welcome-logo", attrs: { src: "/logos/app.png", alt: "NPSharp" } }),
          el("h1", { text: "NPSharp failed to start" }),
          el("pre", { text: errorMessage(error) })
        ]
      })
    );
  }
}

function isAbsolutePath(filePath: string): boolean {
  return filePath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(filePath);
}

function cloneFolderName(url: string): string {
  const clean = url.replace(/[?#].*$/, "").replace(/\/+$/, "").replace(/\.git$/i, "");
  const match = clean.match(/([^/:]+)$/);
  return match?.[1] || "repository";
}

function sanitizeWorkspaceName(name: string): string {
  return name.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ") || "Main";
}

function isProjectRunFile(filePath: string): boolean {
  const name = basename(filePath).toLowerCase();
  return ["package.json", "pom.xml", "gradlew", "gradlew.bat", "cargo.toml", "go.mod"].includes(name);
}

function menuButton(label: string, items: Array<[string, string, MenuAction]>): HTMLButtonElement {
  const button = el("button", { className: "title-menu", text: label });
  button.addEventListener("click", event => {
    event.stopPropagation();
    document.querySelector(".context-menu")?.remove();
    const rect = button.getBoundingClientRect();
    const menu = el("div", { className: "context-menu title-context" });
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom}px`;
    for (const [text, shortcut, action] of items) {
      const row = el("button", { className: "menu-row" });
      row.append(el("span", { text }), el("span", { className: "menu-shortcut", text: shortcut }));
      row.addEventListener("click", event => {
        menu.remove();
        action(event);
      });
      menu.append(row);
    }
    document.body.append(menu);
    setTimeout(() => document.addEventListener("click", () => menu.remove(), { once: true }), 0);
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
    explorer: "EXPLORER",
    search: "SEARCH",
    source: "SOURCE CONTROL",
    run: "RUN AND DEBUG",
    remote: "REMOTE HOST",
    arduino: "ARDUINO",
    settings: "SETTINGS",
    problems: "PROBLEMS"
  };
  return titles[panel];
}

function settingsFooter(onReset: () => void, onSave: () => void): HTMLElement {
  const footer = el("div", { className: "settings-footer" });
  const path = el("span", { className: "settings-path", text: platform.isMobile ? "Documents/NPSharp/settings.json" : "~/.npsharp/settings.json" });
  const spacer = el("span", { className: "spacer" });
  const save = el("button", { className: "wide-action", text: "Save" });
  save.addEventListener("click", onSave);
  const reset = el("button", { className: "wide-action", text: "Reset" });
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
