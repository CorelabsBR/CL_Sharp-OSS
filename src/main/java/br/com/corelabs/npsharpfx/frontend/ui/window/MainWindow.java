package br.com.corelabs.npsharpfx.frontend.ui.window;

import java.io.File;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.prefs.Preferences;

import br.com.corelabs.npsharpfx.backend.debugger.DebuggerService;
import br.com.corelabs.npsharpfx.backend.portugol.runtime.PortugolInterpreter;
import br.com.corelabs.npsharpfx.backend.runtime.LanguageRuntime;
import br.com.corelabs.npsharpfx.backend.runtime.RuntimePaths;
import br.com.corelabs.npsharpfx.backend.runtime.RuntimeRegistry;
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
import javafx.scene.control.ListCell;
import javafx.scene.control.ListView;
import javafx.scene.control.Separator;
import javafx.scene.control.SplitPane;
import javafx.scene.control.TextField;
import javafx.scene.image.Image;
import javafx.scene.input.KeyCode;
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
    private SplitPane horizontalSplit;
    private SplitPane verticalSplit;

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
    private Popup commandPalettePopup;
    private TextField commandPaletteInput;
    private ListView<CommandAction> commandPaletteList;

    private EditorManager editorManager;
    private FileExplorerPane explorerPane;
    private SearchPane searchPane;
    private TitleBar titleBar;
    private VBox sourceControlList;
    private Label sourceControlBranchLabel;
    private Label sourceControlSummaryLabel;
    private TextField sourceControlCommitField;

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
        if (titleBar != null) {
            titleBar.updateWorkspaceNameInCommandBar();
        }
        statusBarManager.updateStatusLeft("Workspace salvo: " + workspace.getName());
        refreshSourceControlPanel();
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
                    buildSourceControlPanel(),
                    () -> sidePanelManager.hideSidePanel(this::updateStatusOnPanelChange)));
        gitBtn.setOnAction(event -> {
            sidePanelManager.toggleActivityPanel("git", this::updateStatusOnPanelChange);
            refreshSourceControlPanel();
        });

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
            if (!"settings".equals(id) && !"git".equals(id)) {
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

    private Node buildSourceControlPanel() {
        VBox panel = new VBox(8);
        panel.setPadding(new Insets(10));
        panel.getStyleClass().add("settings-panel");

        sourceControlBranchLabel = new Label("Repositorio nao detectado");
        sourceControlBranchLabel.getStyleClass().add("settings-title");

        sourceControlSummaryLabel = new Label("Abra uma pasta com Git para ver alteracoes.");
        sourceControlSummaryLabel.setWrapText(true);
        sourceControlSummaryLabel.getStyleClass().add("settings-description");

        sourceControlCommitField = new TextField();
        sourceControlCommitField.setPromptText("Mensagem de commit");
        sourceControlCommitField.getStyleClass().add("search-input");

        Button refreshButton = createSourceControlButton("Refresh");
        refreshButton.setOnAction(event -> refreshSourceControlPanel());

        Button stageAllButton = createSourceControlButton("Stage All");
        stageAllButton.setOnAction(event -> {
            GitResult result = runGitCommand("add", "-A");
            statusBarManager.updateStatusLeft(result.success() ? "Alteracoes adicionadas ao stage" : firstLine(result.output()));
            refreshSourceControlPanel();
        });

        Button commitButton = createSourceControlButton("Commit");
        commitButton.setOnAction(event -> {
            String message = sourceControlCommitField.getText() == null
                    ? ""
                    : sourceControlCommitField.getText().trim();
            if (message.isBlank()) {
                statusBarManager.updateStatusLeft("Informe uma mensagem de commit");
                return;
            }

            GitResult result = runGitCommand("commit", "-m", message);
            statusBarManager.updateStatusLeft(result.output().isBlank() ? "Commit executado" : firstLine(result.output()));
            if (result.success()) {
                sourceControlCommitField.clear();
            }
            refreshSourceControlPanel();
        });

        sourceControlList = new VBox(4);
        sourceControlList.getStyleClass().add("source-control-list");

        panel.getChildren().addAll(
                sourceControlBranchLabel,
                sourceControlSummaryLabel,
                sourceControlCommitField,
                refreshButton,
                stageAllButton,
                commitButton,
                new Separator(),
                sourceControlList
        );

        return panel;
    }

    private Button createSourceControlButton(String text) {
        Button button = new Button(text);
        button.setMaxWidth(Double.MAX_VALUE);
        button.getStyleClass().add("terminal-control-button");
        return button;
    }

    private void refreshSourceControlPanel() {
        if (sourceControlList == null || sourceControlBranchLabel == null || sourceControlSummaryLabel == null) {
            return;
        }

        File workspace = explorerPane == null ? null : explorerPane.getCurrentRootFolder();
        if (workspace == null || !workspace.isDirectory()) {
            sourceControlBranchLabel.setText("Repositorio nao detectado");
            sourceControlSummaryLabel.setText("Abra uma pasta com Git para ver alteracoes.");
            sourceControlList.getChildren().clear();
            statusBarManager.updateGitStatus("$(git) sem repo");
            return;
        }

        GitResult branch = runGitCommand("branch", "--show-current");
        GitResult status = runGitCommand("status", "--porcelain=v1", "-b");

        if (!branch.success() && !status.success()) {
            sourceControlBranchLabel.setText("Repositorio nao detectado");
            sourceControlSummaryLabel.setText(firstLine(status.output().isBlank() ? branch.output() : status.output()));
            sourceControlList.getChildren().clear();
            statusBarManager.updateGitStatus("$(git) sem repo");
            return;
        }

        String branchName = branch.output().trim();
        if (branchName.isBlank()) {
            branchName = "detached";
        }

        java.util.List<String> lines = status.output().lines().toList();
        java.util.List<String> changes = lines.stream()
                .filter(line -> !line.startsWith("##"))
                .toList();

        sourceControlBranchLabel.setText("Branch: " + branchName);
        sourceControlSummaryLabel.setText(changes.isEmpty()
                ? "Sem alteracoes"
                : changes.size() + " arquivo(s) alterado(s)");
        statusBarManager.updateGitStatus("$(git) " + branchName + (changes.isEmpty() ? "" : " *" + changes.size()));

        sourceControlList.getChildren().clear();
        if (changes.isEmpty()) {
            Label clean = new Label("Working tree clean");
            clean.getStyleClass().add("settings-description");
            sourceControlList.getChildren().add(clean);
            return;
        }

        for (String change : changes) {
            Label row = new Label(formatGitChange(change));
            row.getStyleClass().add("source-control-file");
            sourceControlList.getChildren().add(row);
        }
    }

    private String formatGitChange(String line) {
        if (line == null || line.length() < 4) {
            return line == null ? "" : line;
        }

        String status = line.substring(0, 2).trim();
        String path = line.substring(3).trim();
        if (status.isBlank()) {
            status = "M";
        }
        return status + "  " + path;
    }

    private GitResult runGitCommand(String... args) {
        File workspace = explorerPane == null ? null : explorerPane.getCurrentRootFolder();
        if (workspace == null || !workspace.isDirectory()) {
            return new GitResult(false, "Nenhum workspace aberto");
        }

        java.util.List<String> command = new java.util.ArrayList<>();
        command.add(resolveGitExecutable());
        command.addAll(java.util.List.of(args));

        try {
            ProcessBuilder builder = new ProcessBuilder(command);
            builder.directory(workspace);
            builder.redirectErrorStream(true);
            Process process = builder.start();
            String output;
            try (InputStream input = process.getInputStream()) {
                output = new String(input.readAllBytes(), java.nio.charset.Charset.defaultCharset()).trim();
            }
            int exit = process.waitFor();
            return new GitResult(exit == 0, output);
        } catch (Exception e) {
            return new GitResult(false, e.getMessage() == null ? "Falha ao executar git" : e.getMessage());
        }
    }

    private void runGitAndReport(String... args) {
        GitResult result = runGitCommand(args);
        statusBarManager.updateStatusLeft(result.output().isBlank()
                ? (result.success() ? "Git executado" : "Falha ao executar Git")
                : firstLine(result.output()));
        refreshSourceControlPanel();
    }

    private String resolveGitExecutable() {
        try {
            RuntimeRegistry registry = new RuntimeRegistry(RuntimePaths.appDataDir());
            registry.load();
            return registry.get(LanguageRuntime.GIT)
                    .map(runtime -> runtime.executablePath().toString())
                    .orElse("git");
        } catch (Exception e) {
            return "git";
        }
    }

    private String firstLine(String text) {
        if (text == null || text.isBlank()) {
            return "";
        }
        return text.lines().findFirst().orElse(text);
    }

    private record GitResult(boolean success, String output) {
    }

    private void buildLayout() {

        root = new BorderPane();

        root.getStyleClass().add("root-pane");

        /*
        ========================================
        TITLE BAR
        ========================================
        */

        TitleBar titleBar = buildTitleBar();

        /*
        ========================================
        ACTIVITY BAR
        ========================================
        */

        VBox activityBar =
                activityBarManager.createActivityBar();

        // ========================================
        // SIDE PANEL
        // ========================================

        StackPane sidePanelHost =
                sidePanelManager.getSidePanelHost();

        sidePanelHost.setMinWidth(0); 

        sidePanelHost.setMaxWidth(Double.MAX_VALUE);

        HBox.setHgrow(
                sidePanelHost,
                Priority.ALWAYS
        );

        activityBar.setMinWidth(48);

        activityBar.setPrefWidth(48);

        activityBar.setMaxWidth(48);

        leftSidebarArea =
                new HBox(
                        activityBar,
                        sidePanelHost
                );

        leftSidebarArea.setFillHeight(true);

        leftSidebarArea.setMinWidth(0);

        leftSidebarArea.setMaxWidth(Double.MAX_VALUE);

        HBox.setHgrow(
                leftSidebarArea,
                Priority.ALWAYS
        );

        HBox.setHgrow(
                sidePanelHost,
                Priority.ALWAYS
        );

        leftSidebarArea.getStyleClass()
                .add("left-sidebar-area");

        /*
        ========================================
        IMPORTANTISSIMO
        ========================================
        */

        ((Region) editorManager.getView()).setMinSize(0, 0);

        /*
        ========================================
        SPLIT HORIZONTAL
        ========================================
        */

        horizontalSplit =
                new SplitPane();

        horizontalSplit.getStyleClass()
                .add("main-horizontal-split");

        horizontalSplit.getItems().addAll(

                leftSidebarArea,

                editorManager.getView()
        );

        horizontalSplit.setDividerPositions(0.18);

        horizontalSplit.getDividers().get(0).positionProperty().addListener(
        (obs, oldVal, newVal) -> {

            double max = 0.30;

            if (newVal.doubleValue() > max) {

                horizontalSplit.setDividerPositions(max);
            }
        }
);


        horizontalSplit.setMinSize(0, 0);

        horizontalSplit.setMaxSize(
                Double.MAX_VALUE,
                Double.MAX_VALUE
        );

        HBox.setHgrow(
                horizontalSplit,
                Priority.ALWAYS
        );

        VBox.setVgrow(
                horizontalSplit,
                Priority.ALWAYS
        );

        ((Region) editorManager.getView()).setMinWidth(0);

        SplitPane.setResizableWithParent(
                leftSidebarArea,
                true
        );

        SplitPane.setResizableWithParent(
                editorManager.getView(),
                true
        );

        /*
        ========================================
        TERMINAL
        ========================================
        */

        terminalPane =
                new IntegratedTerminalPane();

        terminalPane.setMinHeight(120);

        terminalPane.setPrefHeight(220);

        terminalPane.setMaxHeight(Double.MAX_VALUE);

        terminalPane.setVisible(false);

        terminalPane.setManaged(false);

        /*
        ========================================
        SPLIT VERTICAL
        ========================================
        */

        verticalSplit =
                new SplitPane();

        verticalSplit.getStyleClass()
                .add("main-vertical-split");

        verticalSplit.setOrientation(
                javafx.geometry.Orientation.VERTICAL
        );

        /*
        ========================================
        IMPORTANTISSIMO
        ========================================
        */

        horizontalSplit.setMinSize(0, 0);

        terminalPane.setMinSize(0, 120);

        verticalSplit.getItems().add(horizontalSplit);

        verticalSplit.setDividerPositions(0.78);

        SplitPane.setResizableWithParent(
                horizontalSplit,
                true
        );

        SplitPane.setResizableWithParent(
                terminalPane,
                true
        );

        sidePanelHost.visibleProperty().addListener((obs, oldValue, newValue) -> updateSidebarLayout());
        horizontalSplit.widthProperty().addListener((obs, oldValue, newValue) -> updateSidebarLayout());
        terminalPane.visibleProperty().addListener((obs, oldValue, visible) -> {
            if (!visible) {
                hideTerminalPane();
            }
        });
        updateSidebarLayout();

        /*
        ========================================
        STATUS BAR
        ========================================
        */

        bottomContainer =
                new VBox(
                        statusBarManager.createStatusBar()
                );
        configureStatusBarActions();

        /*
        ========================================
        ROOT
        ========================================
        */

        root.setTop(titleBar);

        root.setCenter(verticalSplit);

        root.setBottom(bottomContainer);

        /*
        ========================================
        WALLPAPER
        ========================================
        */

        wallpaperLayer = new StackPane();

        wallpaperLayer.getStyleClass()
                .add("wallpaper-layer");

        wallpaperLayer.setMouseTransparent(true);

        wallpaperOverlay = new Rectangle();

        wallpaperOverlay.setMouseTransparent(true);

        wallpaperOverlay.widthProperty()
                .bind(root.widthProperty());

        wallpaperOverlay.heightProperty()
                .bind(root.heightProperty());

        appRoot = new StackPane();

        appRoot.getChildren().addAll(

                wallpaperLayer,

                wallpaperOverlay,

                root
        );

        explorerPane.setMenuStyleSupplier(() -> appRoot == null ? "" : appRoot.getStyle());
    }

    private void configureStatusBarActions() {
        statusBarManager.setGitAction(() -> {
            sidePanelManager.showSidePanel("git", this::updateStatusOnPanelChange);
            refreshSourceControlPanel();
        });
        statusBarManager.setDebugAction(() -> sidePanelManager.showSidePanel("debug", this::updateStatusOnPanelChange));
        statusBarManager.setTerminalAction(() -> {
            showTerminalPane();
            if (!terminalPane.hasTerminal()) {
                terminalPane.newTerminal();
            } else {
                terminalPane.focusCurrentTerminal();
            }
        });
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
        titleBar.setShowCommandPaletteAction(this::showCommandPalette);
        titleBar.setNewWindowAction(() -> new MainWindow(new Stage()).show());
        titleBar.setShowAboutAction(() -> statusBarManager.updateStatusLeft("NPSharpFX - CoreLabs"));
        titleBar.setStatusUpdater(statusBarManager::updateStatusLeft);
        titleBar.setMenuStyleSupplier(() -> appRoot == null ? "" : appRoot.getStyle());
        titleBar.setWorkspaceNameSupplier(() -> {
            File workspace = explorerPane == null ? null : explorerPane.getCurrentRootFolder();
            return workspace == null ? "Nenhuma pasta aberta" : workspace.getAbsolutePath();
        });
        titleBar.setWorkspaceRootSupplier(() -> explorerPane == null ? null : explorerPane.getCurrentRootFolder());
        titleBar.setWorkspaceFilesSupplier(this::listWorkspaceFilesForQuickOpen);
        titleBar.setQuickOpenFileAction(this::openQuickOpenFile);

        titleBar.setNewTerminalAction(() -> {
            showTerminalPane();
            terminalPane.newTerminal();
            statusBarManager.updateStatusLeft("Novo terminal");
            statusBarManager.updateStatusRight("Terminal");
            statusBarManager.updateTerminalStatus("Terminal ativo");
        });

        titleBar.setSplitTerminalAction(() -> {
            showTerminalPane();
            terminalPane.splitTerminal();
            statusBarManager.updateStatusLeft("Terminal dividido");
            statusBarManager.updateStatusRight("Terminal");
            statusBarManager.updateTerminalStatus("Terminal ativo");
        });

        titleBar.setKillTerminalAction(() -> {
            terminalPane.killCurrentTerminal();
            if (!terminalPane.hasTerminal()) {
                hideTerminalPane();
            }
            statusBarManager.updateStatusLeft("Terminal encerrado");
            statusBarManager.updateStatusRight("Terminal");
            statusBarManager.updateTerminalStatus(terminalPane.hasTerminal() ? "Terminal ativo" : "Terminal");
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
            statusBarManager.updateTerminalStatus("Terminal ativo");
        });

        return titleBar;
    }

    private void openQuickOpenFile(File file) {
        if (file == null || !file.isFile()) {
            return;
        }

        editorManager.openFileInTab(file);
        sidePanelManager.showSidePanel("explorer", this::updateStatusOnPanelChange);
        explorerPane.revealFile(file);
        statusBarManager.updateStatusLeft("Arquivo aberto: " + file.getName());
        statusBarManager.updateStatusRight("Explorer");
    }

    private List<File> listWorkspaceFilesForQuickOpen() {
        File workspace = explorerPane == null ? null : explorerPane.getCurrentRootFolder();

        if (workspace == null || !workspace.exists() || !workspace.isDirectory()) {
            return List.of();
        }

        try (var stream = java.nio.file.Files.walk(workspace.toPath())) {
            return stream
                    .filter(java.nio.file.Files::isRegularFile)
                    .filter(path -> isQuickOpenPathAllowed(workspace.toPath(), path))
                    .map(java.nio.file.Path::toFile)
                    .limit(5000)
                    .toList();
        } catch (Exception e) {
            return List.of();
        }
    }

    private boolean isQuickOpenPathAllowed(java.nio.file.Path workspace, java.nio.file.Path path) {
        String normalized;

        try {
            normalized = workspace.toAbsolutePath().normalize()
                    .relativize(path.toAbsolutePath().normalize())
                    .toString()
                    .replace("\\", "/")
                    .toLowerCase(java.util.Locale.ROOT);
        } catch (Exception e) {
            normalized = path.toString().replace("\\", "/").toLowerCase(java.util.Locale.ROOT);
        }

        return !normalized.contains("/.git/")
                && !normalized.startsWith(".git/")
                && !normalized.contains("/node_modules/")
                && !normalized.startsWith("node_modules/")
                && !normalized.contains("/target/")
                && !normalized.startsWith("target/")
                && !normalized.contains("/build/")
                && !normalized.startsWith("build/")
                && !normalized.contains("/dist/")
                && !normalized.startsWith("dist/")
                && !normalized.contains("/out/")
                && !normalized.startsWith("out/");
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
                    @Override
                    public void showCommandPalette() { MainWindow.this.showCommandPalette(); }
                    @Override
                    public void showQuickOpen() { MainWindow.this.focusQuickOpen(); }
                     
                });
    }
    private DebuggerService debuggerService =
        new DebuggerService();
    

    private File currentFile;

    private void showCommandPalette() {
        if (commandPalettePopup != null && commandPalettePopup.isShowing()) {
            commandPalettePopup.hide();
            return;
        }

        commandPaletteInput = new TextField();
        commandPaletteInput.getStyleClass().add("command-palette-input");
        commandPaletteInput.setPromptText("> Digite um comando");

        commandPaletteList = new ListView<>();
        commandPaletteList.getStyleClass().add("command-palette-list");
        commandPaletteList.setPrefHeight(330);
        commandPaletteList.setCellFactory(list -> new ListCell<>() {
            @Override
            protected void updateItem(CommandAction item, boolean empty) {
                super.updateItem(item, empty);

                if (empty || item == null) {
                    setText(null);
                    return;
                }

                setText(item.label() + (item.shortcut().isBlank() ? "" : "    " + item.shortcut()));
            }
        });

        commandPaletteInput.textProperty().addListener((obs, oldValue, newValue) -> updateCommandPaletteResults(newValue));
        commandPaletteInput.setOnKeyPressed(event -> {
            if (event.getCode() == KeyCode.ENTER) {
                runSelectedCommand();
                event.consume();
            } else if (event.getCode() == KeyCode.ESCAPE) {
                commandPalettePopup.hide();
                event.consume();
            } else if (event.getCode() == KeyCode.DOWN) {
                commandPaletteList.requestFocus();
                commandPaletteList.getSelectionModel().selectNext();
                event.consume();
            }
        });
        commandPaletteList.setOnMouseClicked(event -> {
            if (event.getClickCount() >= 2) {
                runSelectedCommand();
            }
        });
        commandPaletteList.setOnKeyPressed(event -> {
            if (event.getCode() == KeyCode.ENTER) {
                runSelectedCommand();
                event.consume();
            } else if (event.getCode() == KeyCode.ESCAPE) {
                commandPalettePopup.hide();
                event.consume();
            }
        });

        VBox content = new VBox(commandPaletteInput, commandPaletteList);
        content.getStyleClass().add("command-palette");
        content.setStyle(appRoot == null ? "" : appRoot.getStyle());
        content.setPrefWidth(Math.min(720, Math.max(520, stage.getWidth() * 0.55)));

        commandPalettePopup = new Popup();
        commandPalettePopup.setAutoHide(true);
        commandPalettePopup.setHideOnEscape(true);
        commandPalettePopup.getContent().add(content);

        updateCommandPaletteResults("");
        commandPalettePopup.show(
                stage,
                stage.getX() + (stage.getWidth() - content.getPrefWidth()) / 2,
                stage.getY() + 58
        );
        commandPaletteInput.requestFocus();
    }

    private void updateCommandPaletteResults(String query) {
        if (commandPaletteList == null) {
            return;
        }

        String normalizedQuery = normalizeCommandText(query);
        List<CommandAction> filtered = commandActions().stream()
                .filter(command -> normalizedQuery.isBlank()
                        || normalizeCommandText(command.label()).contains(normalizedQuery)
                        || normalizeCommandText(command.keywords()).contains(normalizedQuery))
                .sorted(Comparator.comparing(command -> scoreCommand(command, normalizedQuery)))
                .limit(60)
                .toList();

        commandPaletteList.getItems().setAll(filtered);
        if (!filtered.isEmpty()) {
            commandPaletteList.getSelectionModel().select(0);
        }
    }

    private int scoreCommand(CommandAction command, String query) {
        if (query == null || query.isBlank()) {
            return 100;
        }

        String label = normalizeCommandText(command.label());
        if (label.equals(query)) {
            return 0;
        }
        if (label.startsWith(query)) {
            return 10;
        }
        return label.contains(query) ? 20 : 50;
    }

    private void runSelectedCommand() {
        CommandAction selected = commandPaletteList == null
                ? null
                : commandPaletteList.getSelectionModel().getSelectedItem();

        if (selected == null) {
            return;
        }

        if (commandPalettePopup != null) {
            commandPalettePopup.hide();
        }

        selected.action().run();
        statusBarManager.updateStatusLeft(selected.label());
    }

    private List<CommandAction> commandActions() {
        List<CommandAction> commands = new ArrayList<>();

        commands.add(new CommandAction("File: New File", "Ctrl+N", "novo arquivo", editorManager::newTab));
        commands.add(new CommandAction("File: Open File...", "Ctrl+O", "abrir arquivo", editorManager::openFileFromDialog));
        commands.add(new CommandAction("File: Open Folder...", "Ctrl+Shift+O", "abrir pasta workspace explorer", this::openFolderInExplorer));
        commands.add(new CommandAction("File: Save", "Ctrl+S", "salvar", editorManager::saveCurrentFile));
        commands.add(new CommandAction("File: Save As...", "Ctrl+Shift+S", "salvar como", editorManager::saveCurrentFileAs));
        commands.add(new CommandAction("File: Save All", "", "salvar todos", editorManager::saveAll));
        commands.add(new CommandAction("File: Close Editor", "Ctrl+W", "fechar aba", editorManager::closeCurrentTab));
        commands.add(new CommandAction("File: Close Others", "", "fechar outras abas", editorManager::closeOtherTabs));
        commands.add(new CommandAction("File: Close All Editors", "Ctrl+Shift+W", "fechar todas abas", editorManager::closeAllTabs));
        commands.add(new CommandAction("File: Close Folder", "", "fechar pasta workspace", this::closeFolderFromExplorer));
        commands.add(new CommandAction("File: Revert File", "", "reverter arquivo", editorManager::revertCurrentFile));

        commands.add(new CommandAction("Edit: Undo", "Ctrl+Z", "desfazer", editorManager::undo));
        commands.add(new CommandAction("Edit: Redo", "Ctrl+Y", "refazer", editorManager::redo));
        commands.add(new CommandAction("Edit: Cut", "Ctrl+X", "recortar", editorManager::cut));
        commands.add(new CommandAction("Edit: Copy", "Ctrl+C", "copiar", editorManager::copy));
        commands.add(new CommandAction("Edit: Paste", "Ctrl+V", "colar", editorManager::paste));
        commands.add(new CommandAction("Edit: Select All", "Ctrl+A", "selecionar tudo", editorManager::selectAll));
        commands.add(new CommandAction("Edit: Duplicate Line", "Shift+Alt+Down", "duplicar linha", editorManager::duplicateCurrentLine));
        commands.add(new CommandAction("Edit: Delete Line", "Ctrl+Shift+K", "deletar linha excluir linha", editorManager::deleteCurrentLine));

        commands.add(new CommandAction("View: Explorer", "Ctrl+Shift+E", "painel explorer arquivos", () -> sidePanelManager.showSidePanel("explorer", this::updateStatusOnPanelChange)));
        commands.add(new CommandAction("View: Search", "Ctrl+Shift+F", "painel busca pesquisar", () -> sidePanelManager.showSidePanel("search", this::updateStatusOnPanelChange)));
        commands.add(new CommandAction("View: Source Control", "Ctrl+Shift+G", "git scm source control", () -> {
            sidePanelManager.showSidePanel("git", this::updateStatusOnPanelChange);
            refreshSourceControlPanel();
        }));
        commands.add(new CommandAction("View: Run and Debug", "Ctrl+Shift+D", "debug rodar", () -> sidePanelManager.showSidePanel("debug", this::updateStatusOnPanelChange)));
        commands.add(new CommandAction("View: Extensions", "Ctrl+Shift+X", "extensoes plugins", () -> sidePanelManager.showSidePanel("extensions", this::updateStatusOnPanelChange)));
        commands.add(new CommandAction("View: Toggle Sidebar", "Ctrl+B", "sidebar barra lateral", () -> sidePanelManager.toggleSidebarVisibility(this::updateStatusOnPanelChange)));
        commands.add(new CommandAction("View: Focus Editor", "Ctrl+Tab", "editor foco", this::focusEditor));
        commands.add(new CommandAction("View: Quick Open", "Ctrl+P", "arquivo rapido quick open", this::focusQuickOpen));

        commands.add(new CommandAction("Terminal: New Terminal", "Ctrl+Shift+`", "terminal novo", () -> {
            showTerminalPane();
            terminalPane.newTerminal();
        }));
        commands.add(new CommandAction("Terminal: Split Terminal", "Ctrl+Shift+5", "terminal dividir", () -> {
            showTerminalPane();
            terminalPane.splitTerminal();
        }));
        commands.add(new CommandAction("Terminal: Kill Current Terminal", "", "terminal matar fechar", terminalPane::killCurrentTerminal));
        commands.add(new CommandAction("Terminal: Clear Current Terminal", "", "terminal limpar", terminalPane::clearCurrentTerminal));
        commands.add(new CommandAction("Terminal: Toggle Panel", "", "terminal painel", () -> {
            if (terminalPane.isVisible()) {
                hideTerminalPane();
            } else {
                showTerminalPane();
                terminalPane.showTerminalPanel();
            }
        }));

        commands.add(new CommandAction("Run: Start Debugging", "F5", "rodar executar debug", this::runSelectedCode));
        commands.add(new CommandAction("Run: Open Debug Console", "", "debug console", () -> {
            showTerminalPane();
            terminalPane.showDebugConsolePanel();
        }));

        commands.add(new CommandAction("Preferences: Color Theme", "", "tema cores", this::openThemeChooser));
        commands.add(new CommandAction("Preferences: Choose Wallpaper", "", "papel parede wallpaper", this::chooseWallpaper));
        commands.add(new CommandAction("Preferences: Toggle Wallpaper", "", "wallpaper habilitar desabilitar", this::toggleWallpaper));
        commands.add(new CommandAction("Preferences: Wallpaper Opacity +", "", "wallpaper opacidade aumentar", () -> adjustWallpaperOpacity(0.08)));
        commands.add(new CommandAction("Preferences: Wallpaper Opacity -", "", "wallpaper opacidade diminuir", () -> adjustWallpaperOpacity(-0.08)));
        commands.add(new CommandAction("Preferences: Remove Wallpaper", "", "wallpaper remover", this::clearWallpaper));

        commands.add(new CommandAction("Git: Refresh", "", "git atualizar", this::refreshSourceControlPanel));
        commands.add(new CommandAction("Git: Stage All", "", "git add stage", () -> {
            runGitCommand("add", "-A");
            refreshSourceControlPanel();
        }));
        commands.add(new CommandAction("Git: Pull", "", "git pull", () -> runGitAndReport("pull")));
        commands.add(new CommandAction("Git: Push", "", "git push", () -> runGitAndReport("push")));

        return commands;
    }

    private String normalizeCommandText(String text) {
        return text == null
                ? ""
                : text.toLowerCase(java.util.Locale.ROOT).replace(':', ' ').trim();
    }

    private void focusQuickOpen() {
        if (titleBar != null) {
            titleBar.showQuickOpen();
        }
        statusBarManager.updateStatusLeft("Quick Open");
    }

    private record CommandAction(String label, String shortcut, String keywords, Runnable action) {
    }

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
    statusBarManager.updateDebugStatus("Debug iniciando");
    statusBarManager.updateTerminalStatus("Debug Console");

    if (file == null) {
        terminalPane.appendDebugOutput("[ERRO] Nenhum arquivo aberto.");
        statusBarManager.updateDebugStatus("Debug erro");
        return;
    }

    if (!debuggerService.supports(file.toPath())) {
        terminalPane.appendDebugOutput("[ERRO] Nenhum debugger registrado para " + file.getName());
        statusBarManager.updateDebugStatus("Debug indisponivel");
        sidePanelManager.showSidePanel("debug", this::updateStatusOnPanelChange);
        return;
    }

    debuggerService.debug(
            file.toPath(),
            terminalPane::appendDebugOutput,
            terminalPane::waitInput
    );
    statusBarManager.updateDebugStatus("Debug ativo");
    statusBarManager.updateStatusLeft("Debug iniciado: " + file.getName());
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
                createPopupMenuItem("Command Palette...", "Ctrl+Shift+P", () -> {
                    settingsPopup.hide();
                    showCommandPalette();
                }),
                createPopupMenuItem("Settings", "Ctrl+,", () -> statusBarManager.updateStatusLeft("Settings aberto")),
                createPopupMenuItem("Keyboard Shortcuts", "Ctrl+K Ctrl+S", () -> statusBarManager.updateStatusLeft("Atalhos principais ativos")),
                createPopupMenuItem("Snippets", null, () -> statusBarManager.updateStatusLeft("Snippets ainda usam templates de novo arquivo")),
                createPopupMenuItem("Tarefas", null, () -> {
                    settingsPopup.hide();
                    showTerminalPane();
                    terminalPane.showTerminalPanel();
                }),
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
                createPopupMenuItem("Ativar/Desativar Wallpaper", null, () -> {
                    settingsPopup.hide();
                    toggleWallpaper();
                }),
                createPopupMenuItem("Remover Wallpaper", null, () -> {
                    settingsPopup.hide();
                    clearWallpaper();
                }),
                createPopupMenuItem("Perfis", null, () -> statusBarManager.updateStatusLeft("Perfil atual: Default"))
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

    private void toggleWallpaper() {
        boolean enabled = !themeManager.getPreferences().isWallpaperEnabled();
        themeManager.setWallpaperEnabled(enabled, wallpaperLayer, wallpaperOverlay, appRoot);
        statusBarManager.updateStatusLeft(enabled ? "Wallpaper ativado" : "Wallpaper desativado");
    }

    private void adjustWallpaperOpacity(double delta) {
        double current = themeManager.getPreferences().getWallpaperOpacity();
        double next = Math.max(0.0, Math.min(0.85, current + delta));
        themeManager.setWallpaperOpacity(next, wallpaperLayer, wallpaperOverlay, appRoot);
        statusBarManager.updateStatusLeft("Opacidade do wallpaper: " + (int) Math.round(next * 100) + "%");
    }

    private void openFolderInExplorer() {
        sidePanelManager.showSidePanel("explorer", this::updateStatusOnPanelChange);
        explorerPane.openFolderFromDialog();
        
        // Atualizar workspace root para a busca
        java.io.File rootFolder = explorerPane.getCurrentRootFolder();
        if (rootFolder != null) {
            searchPane.setWorkspaceRoot(rootFolder);
            titleBar.updateWorkspaceNameInCommandBar();
            refreshSourceControlPanel();
        }
        
        statusBarManager.updateStatusRight("Explorer");
    }

private void closeFolderFromExplorer() {
    explorerPane.clearFolder();
    searchPane.setWorkspaceRoot(null);
    titleBar.updateWorkspaceNameInCommandBar();

    prefs.remove(PREF_WORKSPACE);
    refreshSourceControlPanel();

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
        if (verticalSplit != null && terminalPane != null && !verticalSplit.getItems().contains(terminalPane)) {
            verticalSplit.getItems().add(terminalPane);
            verticalSplit.setDividerPositions(0.72);
        }
        terminalPane.setManaged(true);
        terminalPane.setVisible(true);
    }

    private void hideTerminalPane() {
        if (verticalSplit != null && terminalPane != null) {
            verticalSplit.getItems().remove(terminalPane);
            verticalSplit.setDividerPositions(1.0);
        }
        terminalPane.setManaged(false);
        terminalPane.setVisible(false);
        statusBarManager.updateTerminalStatus("Terminal");
    }

    private void updateSidebarLayout() {
        if (leftSidebarArea == null || horizontalSplit == null) {
            return;
        }

        boolean panelVisible = sidePanelManager != null
                && sidePanelManager.getSidePanelHost().isVisible()
                && sidePanelManager.getSidePanelHost().isManaged();

        if (panelVisible) {
            leftSidebarArea.setMinWidth(260);
            leftSidebarArea.setPrefWidth(300);
            leftSidebarArea.setMaxWidth(Double.MAX_VALUE);
            if (horizontalSplit.getDividers().size() > 0) {
                horizontalSplit.setDividerPositions(0.18);
            }
        } else {
            leftSidebarArea.setMinWidth(48);
            leftSidebarArea.setPrefWidth(48);
            leftSidebarArea.setMaxWidth(48);
            if (horizontalSplit.getDividers().size() > 0 && horizontalSplit.getWidth() > 0) {
                double divider = 48 / horizontalSplit.getWidth();
                horizontalSplit.setDividerPositions(Math.max(0.01, Math.min(0.12, divider)));
            }
        }
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

