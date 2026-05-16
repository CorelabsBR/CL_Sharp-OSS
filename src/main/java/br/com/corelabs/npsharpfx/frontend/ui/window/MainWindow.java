package br.com.corelabs.npsharpfx.frontend.ui.window;

import java.io.File;
import java.io.InputStream;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.prefs.Preferences;

import br.com.corelabs.npsharpfx.backend.portugol.runtime.PortugolInterpreter;
import br.com.corelabs.npsharpfx.backend.debugger.DebuggerService;
import br.com.corelabs.npsharpfx.frontend.ui.editor.EditorManager;
import br.com.corelabs.npsharpfx.frontend.ui.explorer.FileExplorerPane;
import br.com.corelabs.npsharpfx.frontend.ui.icons.Codicon;
import br.com.corelabs.npsharpfx.frontend.ui.search.SearchPane;
import br.com.corelabs.npsharpfx.frontend.ui.search.SearchPane.SearchQuery;
import br.com.corelabs.npsharpfx.frontend.ui.search.SearchResult;
import br.com.corelabs.npsharpfx.frontend.ui.terminal.IntegratedTerminalPane;
import br.com.corelabs.npsharpfx.frontend.ui.theme.ThemeManager;
import br.com.corelabs.npsharpfx.frontend.ui.window.layout.ActivityBarManager;
import br.com.corelabs.npsharpfx.frontend.ui.window.layout.ActivityBarManager.ActivityItem;
import br.com.corelabs.npsharpfx.frontend.ui.window.layout.SidePanelManager;
import br.com.corelabs.npsharpfx.frontend.ui.window.layout.StatusBarManager;
import br.com.corelabs.npsharpfx.frontend.ui.window.panels.SearchHelper;
import br.com.corelabs.npsharpfx.frontend.ui.window.panels.SettingsPanelBuilder;
import br.com.corelabs.npsharpfx.frontend.ui.window.panels.ThemeChooserPanel;
import br.com.corelabs.npsharpfx.frontend.ui.window.shortcuts.ShortcutManager;
import br.com.corelabs.npsharpfx.frontend.ui.window.shortcuts.ShortcutManager.EditorActions;
import br.com.corelabs.npsharpfx.frontend.ui.window.shortcuts.ShortcutManager.WindowActions;
import javafx.geometry.Bounds;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.Separator;
import javafx.scene.image.Image;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;
import javafx.scene.shape.Rectangle;
import javafx.stage.FileChooser;
import javafx.stage.Popup;
import javafx.stage.Stage;

public class MainWindow {

private static final double DEFAULT_WIDTH = 900;
private static final double DEFAULT_HEIGHT = 560;
private static final double MIN_WIDTH = 800;
private static final double MIN_HEIGHT = 520;

    private final Stage stage;
    private Scene scene;
    private BorderPane root;
    private BorderPane centerArea;
    private HBox leftSidebarArea;

    private StackPane appRoot;
    private StackPane wallpaperLayer;
    private Rectangle wallpaperOverlay;

    // Managers and components
    private final ThemeManager themeManager;
    private final ActivityBarManager activityBarManager;
    private final SidePanelManager sidePanelManager;
    private final StatusBarManager statusBarManager;
    private final ShortcutManager shortcutManager;
    private final SearchHelper searchHelper;
    private final SettingsPanelBuilder settingsPanelBuilder;
    private final ThemeChooserPanel themeChooserPanel;

    private IntegratedTerminalPane terminalPane;
    private VBox bottomContainer;
    private Popup settingsPopup;

    private EditorManager editorManager;
    private FileExplorerPane explorerPane;
    private SearchPane searchPane;
    private TitleBar titleBar;

    private static final String PREF_WORKSPACE = "workspace";
    private static final String PREF_OPEN_FILES = "openFiles";

    private final Preferences prefs =
        Preferences.userNodeForPackage(MainWindow.class);

    // Activity items storage
    private final java.util.Map<String, ActivityItem> activityItems = new java.util.LinkedHashMap<>();

    public MainWindow(Stage stage) {
        this.stage = Objects.requireNonNull(stage);
        // Initialize managers
        this.themeManager = new ThemeManager();
        this.activityBarManager = new ActivityBarManager(activityItems);
        this.sidePanelManager = new SidePanelManager(activityItems);
        this.statusBarManager = new StatusBarManager();
        this.shortcutManager = new ShortcutManager();
        this.searchHelper = new SearchHelper();
        this.settingsPanelBuilder = new SettingsPanelBuilder();
        this.themeChooserPanel = new ThemeChooserPanel(themeManager);
        configureStage();
    }

    private void saveSession() {
    File workspace = explorerPane.getCurrentRootFolder();

    if (workspace != null && workspace.exists() && workspace.isDirectory()) {
        prefs.put(PREF_WORKSPACE, workspace.getAbsolutePath());
    } else {
        prefs.remove(PREF_WORKSPACE);
    }

    String openFiles = editorManager.getOpenFiles()
            .stream()
            .filter(File::exists)
            .filter(File::isFile)
            .map(File::getAbsolutePath)
            .reduce((a, b) -> a + File.pathSeparator + b)
            .orElse("");

    prefs.put(PREF_OPEN_FILES, openFiles);
}

private void restoreSession() {
    String workspacePath = prefs.get(PREF_WORKSPACE, "");

    if (!workspacePath.isBlank()) {
        File workspace = new File(workspacePath);

        if (workspace.exists() && workspace.isDirectory()) {
            explorerPane.openFolder(workspace);
            searchPane.setWorkspaceRoot(workspace);
            statusBarManager.updateStatusLeft("Workspace restaurado: " + workspace.getName());
        }
    }

    String openFilesRaw = prefs.get(PREF_OPEN_FILES, "");

    if (!openFilesRaw.isBlank()) {
        Arrays.stream(openFilesRaw.split(java.util.regex.Pattern.quote(File.pathSeparator)))
                .map(File::new)
                .filter(File::exists)
                .filter(File::isFile)
                .forEach(editorManager::openFileInTab);
    }
}

    public void show() {
        stage.show();
    }

    private void configureStage() {
        prepareStage();
        createManagers();
        createPanels();
        buildLayout();
        configureScene();
        configureShortcuts();
        restoreDefaultLayout();
        themeManager.applyTheme(wallpaperLayer, wallpaperOverlay, appRoot);
        restoreSession();
        stage.setOnCloseRequest(event -> saveSession());
    }
    private void flushPrefs() {
    try {
        prefs.flush();
    } catch (Exception e) {
        e.printStackTrace();
    }
}

private final PortugolInterpreter portugolInterpreter =
        new PortugolInterpreter();

    private void setWorkspaceAndPersist(File workspace) {
    searchPane.setWorkspaceRoot(workspace);

    if (workspace != null && workspace.exists() && workspace.isDirectory()) {
        prefs.put(PREF_WORKSPACE, workspace.getAbsolutePath());
        flushPrefs();
        statusBarManager.updateStatusLeft("Workspace salvo: " + workspace.getName());
    }
}
    private void prepareStage() {
        TitleBar.prepareStage(stage);

        stage.setTitle("NPSharp");
        stage.setWidth(DEFAULT_WIDTH);
        stage.setHeight(DEFAULT_HEIGHT);
        stage.setMinWidth(MIN_WIDTH);
        stage.setMinHeight(MIN_HEIGHT);

        InputStream appIconStream = getClass().getResourceAsStream("/icons/app.png");
        if (appIconStream != null) {
            stage.getIcons().add(new Image(appIconStream));
        }
    }

    private void createManagers() {

    editorManager = new EditorManager(
            stage,
            this::updateEditorStatus
    );

    /*
    ========================================
    SEARCH PANE PRIMEIRO
    ========================================
    */

    searchPane = new SearchPane(
            this::searchInOpenTabs,
            this::openSearchResult
    );

    /*
    ========================================
    EXPLORER DEPOIS
    ========================================
    */

    explorerPane = new FileExplorerPane(
            stage,
            editorManager::openFileInTab,
            this::setWorkspaceAndPersist
    );
}

    private void createPanels() {
        System.out.println("[MainWindow] Creating panels with icons...");
        
        Button explorerBtn = activityBarManager.createActivityButton();
        Node explorerIcon = Codicon.icon("/icons/codicons/files.svg");
        explorerBtn.setGraphic(explorerIcon);
        System.out.println("[MainWindow] Explorer icon loaded: " + explorerIcon);
        
        registerActivity("explorer",
                explorerBtn,
                sidePanelManager.wrapSidePanel("EXPLORER", explorerPane.getView(), 
                    () -> sidePanelManager.hideSidePanel(this::updateStatusOnPanelChange)));

        Button searchBtn = activityBarManager.createActivityButton();
        Node searchIcon = Codicon.icon("/icons/codicons/search.svg");
        searchBtn.setGraphic(searchIcon);
        System.out.println("[MainWindow] Search icon loaded: " + searchIcon);
        
        registerActivity("search",
                searchBtn,
                sidePanelManager.wrapSidePanel("SEARCH", searchPane.getView(),
                    () -> sidePanelManager.hideSidePanel(this::updateStatusOnPanelChange)));

        Button gitBtn = activityBarManager.createActivityButton();
        Node gitIcon = Codicon.icon("/icons/codicons/source-control.svg");
        gitBtn.setGraphic(gitIcon);
        System.out.println("[MainWindow] Git icon loaded: " + gitIcon);
        
        registerActivity("git",
                gitBtn,
                sidePanelManager.wrapSidePanel("SOURCE CONTROL",
                    settingsPanelBuilder.buildPlaceholderPanel("SOURCE CONTROL", "Controle de versão virá depois."),
                    () -> sidePanelManager.hideSidePanel(this::updateStatusOnPanelChange)));

        Button debugBtn = activityBarManager.createActivityButton();
        Node debugIcon = Codicon.icon("/icons/codicons/debug-alt.svg");
        debugBtn.setGraphic(debugIcon);
        System.out.println("[MainWindow] Debug icon loaded: " + debugIcon);
        
registerActivity("debug",
        debugBtn,
        sidePanelManager.wrapSidePanel(
                "RUN AND DEBUG",
                buildRunAndDebugPanel(),
                () -> sidePanelManager.hideSidePanel(this::updateStatusOnPanelChange)
        )
);

        Button extBtn = activityBarManager.createActivityButton();
        Node extIcon = Codicon.icon("/icons/codicons/extensions.svg");
        extBtn.setGraphic(extIcon);
        System.out.println("[MainWindow] Extensions icon loaded: " + extIcon);
        
        registerActivity("extensions",
                extBtn,
                sidePanelManager.wrapSidePanel("EXTENSIONS",
                    settingsPanelBuilder.buildPlaceholderPanel("EXTENSIONS", "Sistema de extensões virá depois."),
                    () -> sidePanelManager.hideSidePanel(this::updateStatusOnPanelChange)));

        Button settingsBtn = activityBarManager.createActivityButton();
        Node settingsIcon = Codicon.icon("/icons/codicons/settings-gear.svg");
        settingsBtn.setGraphic(settingsIcon);
        System.out.println("[MainWindow] Settings icon loaded: " + settingsIcon);
        
        registerActivity("settings", settingsBtn, new StackPane());

        activityItems.forEach((id, item) -> {
            if (!"settings".equals(id)) {
                item.button.setOnAction(
                        event -> sidePanelManager.toggleActivityPanel(id, this::updateStatusOnPanelChange));
            }
        });

        settingsBtn.setOnAction(event -> showSettingsPopup(settingsBtn));
        
        System.out.println("[MainWindow] Panels created successfully");
    }

    private Node buildRunAndDebugPanel() {
    VBox panel = new VBox(10);
    panel.setPadding(new Insets(12));
    panel.getStyleClass().add("settings-panel");

    Label title = new Label("Run and Debug");
    title.getStyleClass().add("settings-title");

    Button runButton = new Button("▶ Rodar arquivo atual");
    runButton.setMaxWidth(Double.MAX_VALUE);
    runButton.getStyleClass().add("terminal-control-button");
    runButton.setOnAction(event -> runSelectedCode());

    Button debugConsoleButton = new Button("▣ Abrir Debug Console");
    debugConsoleButton.setMaxWidth(Double.MAX_VALUE);
    debugConsoleButton.getStyleClass().add("terminal-control-button");
    debugConsoleButton.setOnAction(event -> {
        showTerminalPane();
        terminalPane.newDebuggerConsole();
        statusBarManager.updateStatusLeft("Debug Console aberto");
        statusBarManager.updateStatusRight("Debug");
    });

    Button clearButton = new Button("🧹 Limpar Console Atual");
    clearButton.setMaxWidth(Double.MAX_VALUE);
    clearButton.getStyleClass().add("terminal-control-button");
    clearButton.setOnAction(event -> {
        showTerminalPane();
        terminalPane.clearCurrentTerminal();
        statusBarManager.updateStatusLeft("Console limpo");
    });

    Label info = new Label(
            "F5 roda o arquivo atual.\n" +
            "Arquivos .gol, .por e .portugol usam o runtime Portugol.\n" +
            "O leia() usa o Debug Console, não o terminal CMD."
    );
    info.setWrapText(true);
    info.getStyleClass().add("settings-description");

    panel.getChildren().addAll(
            title,
            runButton,
            debugConsoleButton,
            clearButton,
            info
    );

    return panel;
}

    private void buildLayout() {
        root = new BorderPane();
        root.getStyleClass().add("root-pane");

        titleBar = buildTitleBar();
        titleBar.setWorkspaceNameSupplier(() -> {
    File root = explorerPane.getCurrentRootFolder();

    if (root == null) {
        return "Nenhuma pasta aberta";
    }

    return root.getName();
});

        VBox activityBar = activityBarManager.createActivityBar();
        StackPane sidePanelHost = sidePanelManager.getSidePanelHost();

        leftSidebarArea = new HBox(activityBar, sidePanelHost);
        leftSidebarArea.getStyleClass().add("left-sidebar-area");

        centerArea = new BorderPane();
        centerArea.getStyleClass().add("center-area");
        centerArea.setLeft(leftSidebarArea);
        centerArea.setCenter(editorManager.getView());

        terminalPane = new IntegratedTerminalPane();
        terminalPane.setVisible(false);
        terminalPane.setManaged(false);

        bottomContainer = new VBox();
        bottomContainer.getChildren().addAll(terminalPane, statusBarManager.createStatusBar());

        root.setTop(titleBar);
        root.setCenter(centerArea);
        root.setBottom(bottomContainer);

        wallpaperLayer = new StackPane();
        wallpaperLayer.getStyleClass().add("wallpaper-layer");
        wallpaperLayer.setMouseTransparent(true);

        wallpaperOverlay = new Rectangle();
        wallpaperOverlay.setMouseTransparent(true);
        wallpaperOverlay.widthProperty().bind(root.widthProperty());
        wallpaperOverlay.heightProperty().bind(root.heightProperty());

        appRoot = new StackPane();
        appRoot.getChildren().addAll(wallpaperLayer, wallpaperOverlay, root);
    }

    private TitleBar buildTitleBar() {
        TitleBar titleBar = new TitleBar(stage, editorManager);
        titleBar.setRunCurrentFileAction(this::runSelectedCode);
        titleBar.setOpenFolderAction(this::openFolderInExplorer);
        titleBar.setCloseFolderAction(this::closeFolderFromExplorer);
        titleBar.setOpenPreferencesAction(() -> showSettingsPopup(activityItems.get("settings").button));
        titleBar.setToggleSidebarAction(() -> sidePanelManager.toggleSidebarVisibility(this::updateStatusOnPanelChange));
        titleBar.setShowSearchAction(() -> sidePanelManager.showSidePanel("search", this::updateStatusOnPanelChange));
        titleBar.setShowExplorerAction(() -> sidePanelManager.showSidePanel("explorer", this::updateStatusOnPanelChange));
        titleBar.setShowCommandPaletteAction(() -> statusBarManager.updateStatusLeft("Command Palette ainda nÃƒÂ£o implementada"));
        titleBar.setNewWindowAction(() -> new MainWindow(new Stage()).show());
        titleBar.setShowAboutAction(() -> statusBarManager.updateStatusLeft("NPSharpFX - CoreLabs"));
        titleBar.setStatusUpdater(statusBarManager::updateStatusLeft);
        titleBar.setMenuStyleSupplier(() -> appRoot.getStyle());

        titleBar.setNewTerminalAction(() -> {
            showTerminalPane();
            terminalPane.newTerminal();
            statusBarManager.updateStatusLeft("Novo terminal");
            statusBarManager.updateStatusRight("Terminal");
        });

        titleBar.setSplitTerminalAction(() -> {
            showTerminalPane();
            terminalPane.splitTerminal();
            statusBarManager.updateStatusLeft("Terminal dividido");
            statusBarManager.updateStatusRight("Terminal");
        });

        titleBar.setKillTerminalAction(() -> {
            terminalPane.killCurrentTerminal();
            if (!terminalPane.hasTerminal()) {
                hideTerminalPane();
            }
            statusBarManager.updateStatusLeft("Terminal encerrado");
            statusBarManager.updateStatusRight("Terminal");
        });

        titleBar.setFocusTerminalAction(() -> {
            showTerminalPane();
            if (!terminalPane.hasTerminal()) {
                terminalPane.newTerminal();
            } else {
                terminalPane.focusCurrentTerminal();
            }
            statusBarManager.updateStatusLeft("Terminal focado");
            statusBarManager.updateStatusRight("Terminal");
        });

        return titleBar;
    }

    private void configureScene() {
        scene = new Scene(appRoot, DEFAULT_WIDTH, DEFAULT_HEIGHT);

        scene.getStylesheets().add(
                Objects.requireNonNull(
                        getClass().getResource("/css/app.css"),
                        "CSS /css/app.css nÃƒÂ£o encontrado"
                ).toExternalForm()
        );

        stage.setScene(scene);
        stage.centerOnScreen();
    }

    private void configureShortcuts() {
        shortcutManager.configureShortcuts(scene,
                new EditorActions() {
                    @Override
                    public void newTab() { editorManager.newTab(); }
                    @Override
                    public void openFileFromDialog() { editorManager.openFileFromDialog(); }
                    @Override
                    public void saveCurrentFile() { editorManager.saveCurrentFile(); }
                    @Override
                    public void saveCurrentFileAs() { editorManager.saveCurrentFileAs(); }
                    @Override
                    public void closeCurrentTab() { editorManager.closeCurrentTab(); }
                    @Override
                    public void closeAllTabs() { editorManager.closeAllTabs(); }
                },
                new WindowActions() {
                    @Override
                    public void openFolderInExplorer() { MainWindow.this.openFolderInExplorer(); }
                    @Override
                    public void toggleSidebarVisibility() { sidePanelManager.toggleSidebarVisibility(MainWindow.this::updateStatusOnPanelChange); }
                    @Override
                    public void toggleActivityPanel(String panelId) { sidePanelManager.toggleActivityPanel(panelId, MainWindow.this::updateStatusOnPanelChange); }
                    @Override
                    public void showTerminal() { showTerminalPane(); if (!terminalPane.hasTerminal()) { terminalPane.newTerminal(); } }
                    @Override
                    public void focusEditor() { MainWindow.this.focusEditor(); }
                    @Override
                    public void splitTerminal() { showTerminalPane(); terminalPane.splitTerminal(); }
                    @Override
                    public void runCurrentFile() { showTerminalPane();  MainWindow.this.runSelectedCode();; }
                     
                });
    }
    private DebuggerService debuggerService =
        new DebuggerService();
    

    private File currentFile;

    private void restoreDefaultLayout() {
        sidePanelManager.showSidePanel("explorer", this::updateStatusOnPanelChange);
        statusBarManager.updateStatusLeft("Pronto");
        statusBarManager.updateStatusRight("NPSharp");
    }

public void runSelectedCode() {
    showTerminalPane();

    File file = editorManager.getCurrentFile();

    terminalPane.showDebugConsolePanel();
    terminalPane.clearDebugConsole();

    if (file == null) {
        terminalPane.appendDebugOutput("[ERRO] Nenhum arquivo aberto.");
        return;
    }

    debuggerService.debug(
            file.toPath(),
            terminalPane::appendDebugOutput,
            terminalPane::waitInput
    );
}

    private void openThemeChooser() {
        javafx.scene.Node themeChooserContent = themeChooserPanel.buildThemeChooserPanel(
                wallpaperLayer,
                wallpaperOverlay,
                appRoot,
                () -> statusBarManager.updateStatusLeft("Tema aplicado")
        );

        StackPane sidePanelHost = sidePanelManager.getSidePanelHost();
        sidePanelHost.getChildren().setAll(sidePanelManager.wrapSidePanel("THEMES", themeChooserContent,
                () -> sidePanelManager.hideSidePanel(this::updateStatusOnPanelChange)));
        sidePanelHost.setManaged(true);
        sidePanelHost.setVisible(true);
    }

    private void showSettingsPopup(Node anchor) {
        if (settingsPopup != null && settingsPopup.isShowing()) {
            settingsPopup.hide();
            return;
        }

        VBox menu = new VBox();
        menu.getStyleClass().add("context-menu");
        menu.setStyle(appRoot.getStyle());

        menu.getChildren().addAll(
                createPopupMenuItem("Command Palette...", "Ctrl+Shift+P", null),
                createPopupMenuItem("Settings", "Ctrl+,", null),
                createPopupMenuItem("Keyboard Shortcuts", "Ctrl+K Ctrl+S", null),
                createPopupMenuItem("Snippets", null, null),
                createPopupMenuItem("Tarefas", null, null),
                createPopupMenuItem("Temas", "Escolher", () -> {
                    settingsPopup.hide();
                    openThemeChooser();
                }),
                new Separator(),
                createPopupMenuItem("Backup e sincronizar configurações", null, null),
                new Separator(),
                createPopupMenuItem("Wallpapers", "Escolher", () -> {
                    settingsPopup.hide();
                    chooseWallpaper();
                }),
                createPopupMenuItem("Remover Wallpaper", null, () -> {
                    settingsPopup.hide();
                    clearWallpaper();
                }),
                createPopupMenuItem("Perfis", null, null)
        );

        settingsPopup = new Popup();
        settingsPopup.setAutoHide(true);
        settingsPopup.setHideOnEscape(true);
        settingsPopup.getContent().add(menu);

        Bounds bounds = anchor.localToScreen(anchor.getBoundsInLocal());
        settingsPopup.show(stage, bounds.getMaxX() + 2, bounds.getMinY());
    }

    private HBox createPopupMenuItem(String text, String shortcut, Runnable action) {
        Label label = new Label(text);
        label.getStyleClass().add("context-menu-item");

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        HBox row = new HBox(label, spacer);
        row.getStyleClass().add("context-menu-row");
        row.setAlignment(Pos.CENTER_LEFT);
        row.setPadding(new Insets(6, 12, 6, 12));

        if (shortcut != null && !shortcut.isBlank()) {
            Label right = new Label(shortcut);
            right.getStyleClass().add("context-menu-shortcut");
            row.getChildren().add(right);
        }

        if (action != null) {
            row.setOnMouseClicked(e -> action.run());
        }

        return row;
    }

    private void chooseWallpaper() {
        FileChooser chooser = new FileChooser();
        chooser.setTitle("Escolher wallpaper");
        chooser.getExtensionFilters().addAll(
                new FileChooser.ExtensionFilter("Imagens", "*.png", "*.jpg", "*.jpeg", "*.webp")
        );

        var file = chooser.showOpenDialog(stage);
        if (file == null) {
            statusBarManager.updateStatusLeft("Escolha de wallpaper cancelada");
            return;
        }

        themeManager.setWallpaper(file, wallpaperLayer, wallpaperOverlay, appRoot);
        statusBarManager.updateStatusLeft("Wallpaper aplicado: " + file.getName());
    }

    private void clearWallpaper() {
        themeManager.clearWallpaper(wallpaperLayer, wallpaperOverlay, appRoot);
        statusBarManager.updateStatusLeft("Wallpaper removido");
    }

    private void openFolderInExplorer() {
        sidePanelManager.showSidePanel("explorer", this::updateStatusOnPanelChange);
        explorerPane.openFolderFromDialog();
        
        // Atualizar workspace root para a busca
        java.io.File rootFolder = explorerPane.getCurrentRootFolder();
        if (rootFolder != null) {
            searchPane.setWorkspaceRoot(rootFolder);
        }
        
        statusBarManager.updateStatusRight("Explorer");
    }

private void closeFolderFromExplorer() {
    explorerPane.clearFolder();
    searchPane.setWorkspaceRoot(null);

    prefs.remove(PREF_WORKSPACE);

    statusBarManager.updateStatusLeft("Pasta fechada");
    statusBarManager.updateStatusRight("Explorer");
}

    private void focusEditor() {
        if (editorManager != null && editorManager.getTabPane() != null) {
            editorManager.getTabPane().requestFocus();
            statusBarManager.updateStatusRight("Editor");
        }
    }

    private void showTerminalPane() {
        terminalPane.setManaged(true);
        terminalPane.setVisible(true);
    }

    private void hideTerminalPane() {
        terminalPane.setManaged(false);
        terminalPane.setVisible(false);
    }

    private void registerActivity(String id, Button button, Node content) {
        activityItems.put(id, new ActivityItem(id, button, content));
    }

    private List<SearchResult> searchInOpenTabs(SearchQuery query) {
        return searchHelper.searchInOpenTabs(editorManager, query);
    }

    private void openSearchResult(SearchResult result) {
    if (result == null) {
        return;
    }

    if (result.getTab() != null) {
        var tab = result.getTab();

        editorManager.selectTab(tab);
        editorManager.goToPosition(tab, result.getLine(), result.getColumn());

        statusBarManager.updateStatusLeft(
                "Navegando para: " + result.getFileName() + " Ln " + result.getLine()
        );

        return;
    }

    File file = new File(result.getFileName());

    if (!file.exists() || !file.isFile()) {
        statusBarManager.updateStatusLeft(
                "Arquivo nao encontrado: " + result.getFileName()
        );
        return;
    }

    editorManager.openFileInTab(file);

    var selectedTab = editorManager.getTabPane()
            .getSelectionModel()
            .getSelectedItem();

    if (selectedTab != null) {
        editorManager.goToPosition(
                selectedTab,
                result.getLine(),
                result.getColumn()
        );
    }

    statusBarManager.updateStatusLeft(
            "Navegando para: " + file.getName() + " Ln " + result.getLine()
    );
}

    private void updateEditorStatus(String text) {
        statusBarManager.updateStatusLeft(text);
    }

    private void updateStatusOnPanelChange() {
        String activePanelId = sidePanelManager.getActivePanelId();
        if (activePanelId != null) {
            statusBarManager.updateStatusLeft(getPanelStatusText(activePanelId));
            statusBarManager.updateStatusRight("Sidebar");
        } else {
            statusBarManager.updateStatusRight("NPSharp");
        }
    }

    private String getPanelStatusText(String panelId) {
        return switch (panelId) {
            case "explorer" -> "Explorer";
            case "search" -> "Busca";
            case "git" -> "Git";
            case "debug" -> "Debug";
            case "extensions" -> "Extensões";
            case "settings" -> "Configurações";     
            default -> "Painel";
        };
    }
}

