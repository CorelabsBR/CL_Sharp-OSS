package br.com.corelabs.npsharpfx.frontend.ui.window;

import java.io.File;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Supplier;

import br.com.corelabs.npsharpfx.frontend.ui.editor.EditorManager;
import br.com.corelabs.npsharpfx.frontend.ui.icons.Codicon;
import br.com.corelabs.npsharpfx.frontend.ui.theme.ThemeIconHelper;
import javafx.application.Platform;
import javafx.geometry.Bounds;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.geometry.Rectangle2D;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.control.ListView;
import javafx.scene.control.Separator;
import javafx.scene.control.TextField;
import javafx.scene.image.Image;
import javafx.scene.image.ImageView;
import javafx.scene.input.KeyCode;
import javafx.scene.input.MouseButton;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.stage.Popup;
import javafx.stage.Screen;
import javafx.stage.Stage;
import javafx.stage.StageStyle;

/*
========================================================
TITLE BAR
Barra de titulo customizada da janela principal
========================================================
*/

public class TitleBar extends HBox {

    private static final String DEFAULT_THEME = "np-dark";
    private static final String DEFAULT_ICON_COLOR = null;

    private static final double TITLEBAR_HEIGHT = 34;
    private static final double DEFAULT_RESTORE_WIDTH = 1280;
    private static final double DEFAULT_RESTORE_HEIGHT = 720;

    private static final int MAX_RECENT_ITEMS_IN_MENU = 12;

    private final Stage stage;
    private final EditorManager editorManager;

    private double dragOffsetX;
    private double dragOffsetY;

    private boolean maximized = false;
    private double restoreX = Double.NaN;
    private double restoreY = Double.NaN;
    private double restoreWidth = DEFAULT_RESTORE_WIDTH;
    private double restoreHeight = DEFAULT_RESTORE_HEIGHT;

    private String themeName = DEFAULT_THEME;
    private String iconColorValue = DEFAULT_ICON_COLOR;

    private Label btnMax;

    private Label fileMenu;
    private Label editMenu;
    private Label selectionMenu;
    private Label viewMenu;
    private Label goMenu;
    private Label moreMenu;
    private Supplier<String> workspaceNameSupplier;

    private Label backButton;
    private Label forwardButton;

    private TextField commandBar;

    private Popup activeMenuPopup;
    private Popup activeSubmenuPopup;
    private Popup quickOpenPopup;
    private ListView<File> quickOpenList;

    private Runnable openFolderAction;
    private Runnable closeFolderAction;
    private Runnable openPreferencesAction;
    private Runnable toggleSidebarAction;
    private Runnable showSearchAction;
    private Runnable showExplorerAction;
    private Runnable showCommandPaletteAction;
    private Runnable newWindowAction;
    private Runnable showAboutAction;
    private Supplier<File> workspaceRootSupplier;
    private Supplier<List<File>> workspaceFilesSupplier;
    private Consumer<File> quickOpenFileAction;

    private Runnable newTerminalAction;
    private Runnable splitTerminalAction;
    private Runnable killTerminalAction;
    private Runnable focusTerminalAction;

    private Consumer<String> statusUpdater;
    private Runnable runCurrentFileAction;
    private java.util.function.Supplier<String> menuStyleSupplier;
    public void setRunCurrentFileAction(Runnable runCurrentFileAction) {
    this.runCurrentFileAction = runCurrentFileAction;
}

    public TitleBar(Stage stage, EditorManager editorManager) {
        this.stage = Objects.requireNonNull(stage);
        this.editorManager = Objects.requireNonNull(editorManager);

        getStyleClass().add("title-bar");
        setAlignment(Pos.CENTER_LEFT);
        setSpacing(8);
        setPadding(new Insets(0, 0, 0, 8));

        setPrefHeight(TITLEBAR_HEIGHT);
        setMinHeight(TITLEBAR_HEIGHT);
        setMaxHeight(TITLEBAR_HEIGHT);

        build();
        configureDrag();
        configureWindowStateTracking();
        configureCommandBar();
        applyCurrentIconTheme();
    }

    public static void prepareStage(Stage stage) {
        stage.initStyle(StageStyle.UNDECORATED);
    }

    public void setOpenFolderAction(Runnable openFolderAction) {
        this.openFolderAction = openFolderAction;
    }

    public void setCloseFolderAction(Runnable closeFolderAction) {
        this.closeFolderAction = closeFolderAction;
    }

    public void setOpenPreferencesAction(Runnable openPreferencesAction) {
        this.openPreferencesAction = openPreferencesAction;
    }

    public void setToggleSidebarAction(Runnable toggleSidebarAction) {
        this.toggleSidebarAction = toggleSidebarAction;
    }

    public void setShowSearchAction(Runnable showSearchAction) {
        this.showSearchAction = showSearchAction;
    }

    public void setShowExplorerAction(Runnable showExplorerAction) {
        this.showExplorerAction = showExplorerAction;
    }

    public void setShowCommandPaletteAction(Runnable showCommandPaletteAction) {
        this.showCommandPaletteAction = showCommandPaletteAction;
    }

    public void setNewWindowAction(Runnable newWindowAction) {
        this.newWindowAction = newWindowAction;
    }

    public void setShowAboutAction(Runnable showAboutAction) {
        this.showAboutAction = showAboutAction;
    }

    public void setNewTerminalAction(Runnable newTerminalAction) {
        this.newTerminalAction = newTerminalAction;
    }

    public void setSplitTerminalAction(Runnable splitTerminalAction) {
        this.splitTerminalAction = splitTerminalAction;
    }

    public void setKillTerminalAction(Runnable killTerminalAction) {
        this.killTerminalAction = killTerminalAction;
    }

    public void setFocusTerminalAction(Runnable focusTerminalAction) {
        this.focusTerminalAction = focusTerminalAction;
    }

    public void setStatusUpdater(Consumer<String> statusUpdater) {
        this.statusUpdater = statusUpdater;
    }

    public void applyThemeConfig(String themeValue, String iconColorValue) {
        this.themeName = ThemeIconHelper.normalizeTheme(themeValue);
        this.iconColorValue = ThemeIconHelper.normalizeIconColor(iconColorValue);
        applyCurrentIconTheme();
    }

    public void setWorkspaceNameSupplier(Supplier<String> workspaceNameSupplier) {
    this.workspaceNameSupplier = workspaceNameSupplier;
    updateWorkspaceNameInCommandBar();
}

public void updateWorkspaceNameInCommandBar() {
    if (commandBar != null) {
        commandBar.setPromptText(getWorkspaceNameForBar());
    }
}

private String getWorkspaceNameForBar() {
    if (workspaceNameSupplier == null) {
        return "Nenhuma pasta aberta";
    }

    String name = workspaceNameSupplier.get();

    if (name == null || name.isBlank()) {
        return "Nenhuma pasta aberta";
    }

    return name;
}

    public void setWorkspaceRootSupplier(Supplier<File> workspaceRootSupplier) {
        this.workspaceRootSupplier = workspaceRootSupplier;
        updateWorkspaceNameInCommandBar();
    }

    public void setWorkspaceFilesSupplier(Supplier<List<File>> workspaceFilesSupplier) {
        this.workspaceFilesSupplier = workspaceFilesSupplier;
    }

    public void setQuickOpenFileAction(Consumer<File> quickOpenFileAction) {
        this.quickOpenFileAction = quickOpenFileAction;
    }

    public void showQuickOpen() {
        openQuickOpen();
    }

    private void build() {

        ImageView logo = new ImageView(
                new Image(Objects.requireNonNull(getClass().getResourceAsStream("/icons/app.png")))
        );
        logo.setFitWidth(18);
        logo.setFitHeight(18);
        logo.setPreserveRatio(true);

        fileMenu = createMenuLabel("File", this::openFileMenu);
        editMenu = createMenuLabel("Edit", this::openEditMenu);
        selectionMenu = createMenuLabel("Selection", this::openSelectionMenu);
        viewMenu = createMenuLabel("View", this::openViewMenu);
        goMenu = createMenuLabel("Go To", this::openGoMenu);
        moreMenu = createMenuLabel("More", this::openMoreMenu);

        backButton = createToolbarButton(null, "/icons/codicons/arrow-left.svg");
        forwardButton = createToolbarButton(null, "/icons/codicons/arrow-right.svg");

        backButton.getStyleClass().add("title-toolbar-button-disabled");
        forwardButton.getStyleClass().add("title-toolbar-button-disabled");
        commandBar = new TextField();
        commandBar.setPromptText(getWorkspaceNameForBar());
        commandBar.getStyleClass().add("command-bar");
        commandBar.setPrefWidth(420);
        commandBar.setMinWidth(220);

        Region centerSpacerLeft = new Region();
        Region centerSpacerRight = new Region();
        HBox.setHgrow(centerSpacerLeft, Priority.ALWAYS);
        HBox.setHgrow(centerSpacerRight, Priority.ALWAYS);

        Label split1 = createToolbarButton(null, "/icons/codicons/split-vertical.svg");
        Label split2 = createToolbarButton(null, "/icons/codicons/layout.svg");
        Label split3 = createToolbarButton(null, "/icons/codicons/layout-panel-off.svg");
        Label split4 = createToolbarButton(null, "/icons/codicons/split-horizontal.svg");

        split1.setOnMouseClicked(e -> updateStatus("Split editor (vertical)"));
        split2.setOnMouseClicked(e -> updateStatus("Editor layout"));
        split3.setOnMouseClicked(e -> runAction(toggleSidebarAction, "Toggle sidebar"));
        split4.setOnMouseClicked(e -> updateStatus("Split editor (horizontal)"));

        Region pushRight = new Region();
        HBox.setHgrow(pushRight, Priority.ALWAYS);

        Label btnMin = createWindowButton(createThemedWindowIcon("/icons/codicons/chrome-minimize.svg"));
        btnMin.setOnMouseClicked(e -> stage.setIconified(true));

        btnMax = createWindowButton(createThemedWindowIcon("/icons/codicons/chrome-maximize.svg"));
        btnMax.setOnMouseClicked(e -> toggleMaximize());

        Label btnClose = createWindowButton(createThemedWindowIcon("/icons/codicons/chrome-close.svg"));
        btnClose.getStyleClass().add("window-button-close");
        btnClose.setOnMouseClicked(e -> stage.close());

        getChildren().addAll(
                logo,

                fileMenu,
                editMenu,
                selectionMenu,
                viewMenu,
                goMenu,
                moreMenu,

                backButton,
                forwardButton,

                centerSpacerLeft,
                commandBar,
                centerSpacerRight,

                split1,
                split2,
                split3,
                split4,

                pushRight,

                btnMin,
                btnMax,
                btnClose
        );
    }

    private void configureCommandBar() {
        commandBar.setOnMouseClicked(event -> {
            if (event.getClickCount() >= 1) {
                openQuickOpen();
            }
        });

        commandBar.textProperty().addListener((obs, oldValue, newValue) -> {
            if (quickOpenPopup != null && quickOpenPopup.isShowing()) {
                updateQuickOpenResults(newValue);
            }
        });

        commandBar.setOnKeyPressed(event -> {
            if (event.getCode() == KeyCode.ENTER) {
                openSelectedQuickOpenItem();
                event.consume();
            } else if (event.getCode() == KeyCode.DOWN) {
                selectQuickOpenRelative(1);
                event.consume();
            } else if (event.getCode() == KeyCode.UP) {
                selectQuickOpenRelative(-1);
                event.consume();
            } else if (event.getCode() == KeyCode.PAGE_DOWN) {
                selectQuickOpenRelative(10);
                event.consume();
            } else if (event.getCode() == KeyCode.PAGE_UP) {
                selectQuickOpenRelative(-10);
                event.consume();
            } else if (event.getCode() == KeyCode.HOME) {
                selectQuickOpenIndex(0);
                event.consume();
            } else if (event.getCode() == KeyCode.END) {
                selectQuickOpenIndex(quickOpenList == null ? -1 : quickOpenList.getItems().size() - 1);
                event.consume();
            } else if (event.getCode() == KeyCode.ESCAPE) {
                closeQuickOpen();
                getParent().requestFocus();
                event.consume();
            }
        });
    }

    private void configureWindowStateTracking() {
        stage.maximizedProperty().addListener((obs, oldValue, newValue) -> {
            maximized = Boolean.TRUE.equals(newValue);
            updateMaximizeIcon();
        });
    }

    private Label createMenuLabel(String text, Runnable action) {
        Label label = new Label(text);
        label.getStyleClass().add("title-menu");

        if (action != null) {
            label.setOnMouseClicked(e -> {
                closeAllMenus();
                action.run();
            });
        }

        return label;
    }

    private Label createToolbarButton(String text, String iconPath) {
        Label label = new Label();

        if (text != null) {
            label.setText(text);
        }

        if (iconPath != null) {
            label.setGraphic(createThemedWindowIcon(iconPath));
        }

        label.getStyleClass().add("title-toolbar-button");
        label.setAlignment(Pos.CENTER);
        return label;
    }

    private Label createWindowButton(Node icon) {
        Label label = new Label();
        label.setGraphic(icon);
        label.getStyleClass().add("window-button");
        label.setAlignment(Pos.CENTER);

        label.setMinWidth(46);
        label.setPrefWidth(46);
        label.setMaxWidth(46);

        label.setMinHeight(38);
        label.setPrefHeight(38);
        label.setMaxHeight(38);

        return label;
    }

    private Node createThemedWindowIcon(String iconPath) {
        Node icon = Codicon.icon(iconPath);
        icon.getStyleClass().add("themed-icon");
        icon.getStyleClass().add("titlebar-icon");
        return icon;
    }

    private HBox createMenuItem(String text, String shortcut, Runnable action) {
        Label label = new Label(text);
        label.getStyleClass().add("context-menu-item");

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        HBox row = new HBox();
        row.getStyleClass().add("context-menu-row");
        row.setAlignment(Pos.CENTER_LEFT);
        row.setPadding(new Insets(6, 12, 6, 12));

        row.getChildren().add(label);
        row.getChildren().add(spacer);

        if (shortcut != null && !shortcut.isBlank()) {
            Label shortcutLabel = new Label(shortcut);
            shortcutLabel.getStyleClass().add("context-menu-shortcut");
            row.getChildren().add(shortcutLabel);
        }

        if (action != null) {
            row.setOnMouseClicked(e -> {
                closeAllMenus();
                action.run();
            });
        }

        return row;
    }

    private HBox createSubmenuItem(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("context-menu-item");

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        Label arrow = new Label(">");
        arrow.getStyleClass().add("context-menu-shortcut");

        HBox row = new HBox(label, spacer, arrow);
        row.getStyleClass().add("context-menu-row");
        row.setAlignment(Pos.CENTER_LEFT);
        row.setPadding(new Insets(6, 12, 6, 12));
        return row;
    }

    private VBox createMenuBox() {
        VBox menu = new VBox();
        menu.getStyleClass().add("context-menu");
        applyCurrentThemeStyle(menu);
        return menu;
    }

    public void setMenuStyleSupplier(java.util.function.Supplier<String> supplier) {
        this.menuStyleSupplier = supplier;
    }

    private void applyCurrentThemeStyle(Node node) {
        if (node == null || menuStyleSupplier == null) {
            return;
        }

        String style = menuStyleSupplier.get();
        if (style != null && !style.isBlank()) {
            node.setStyle(style);
        }
    }

    private void bindSubmenu(HBox sourceRow, VBox submenu) {
        sourceRow.setOnMouseEntered(e -> showSubmenuBeside(sourceRow, submenu));
        sourceRow.setOnMouseClicked(e -> showSubmenuBeside(sourceRow, submenu));
    }

    private void showMenuBelow(Node anchor, VBox menuContent) {
        closeSubmenuOnly();

        Popup popup = new Popup();
        popup.setAutoHide(true);
        popup.setHideOnEscape(true);
        popup.getContent().add(menuContent);

        popup.setOnHidden(e -> {
            if (activeMenuPopup == popup) {
                activeMenuPopup = null;
            }
            closeSubmenuOnly();
        });

        Bounds bounds = anchor.localToScreen(anchor.getBoundsInLocal());
        popup.show(stage, bounds.getMinX(), bounds.getMaxY() + 2);
        activeMenuPopup = popup;
    }

    private void showSubmenuBeside(Node anchor, VBox submenuContent) {
        closeSubmenuOnly();

        Popup popup = new Popup();
        popup.setAutoHide(false);
        popup.setHideOnEscape(true);
        popup.getContent().add(submenuContent);

        popup.setOnHidden(e -> {
            if (activeSubmenuPopup == popup) {
                activeSubmenuPopup = null;
            }
        });

        Bounds bounds = anchor.localToScreen(anchor.getBoundsInLocal());
        popup.show(stage, bounds.getMaxX() - 1, bounds.getMinY());
        activeSubmenuPopup = popup;
    }

    private void closeSubmenuOnly() {
        if (activeSubmenuPopup != null) {
            activeSubmenuPopup.hide();
            activeSubmenuPopup = null;
        }
    }

    private void closeAllMenus() {
        if (activeSubmenuPopup != null) {
            activeSubmenuPopup.hide();
            activeSubmenuPopup = null;
        }
        if (activeMenuPopup != null) {
            activeMenuPopup.hide();
            activeMenuPopup = null;
        }
        closeQuickOpen();
    }

    private void openQuickOpen() {
        closeAllMenusExceptQuickOpen();

        if (quickOpenPopup == null) {
            quickOpenPopup = new Popup();
            quickOpenPopup.setAutoHide(true);
            quickOpenPopup.setHideOnEscape(true);

            quickOpenList = new ListView<>();
            quickOpenList.getStyleClass().add("quick-open-list");
            applyCurrentThemeStyle(quickOpenList);
            quickOpenList.setPrefWidth(Math.max(commandBar.getWidth(), 420));
            quickOpenList.setPrefHeight(320);
            Label placeholder = new Label("Nenhum arquivo encontrado");
            placeholder.getStyleClass().add("quick-open-placeholder");
            quickOpenList.setPlaceholder(placeholder);
            quickOpenList.setCellFactory(list -> {
                ListCell<File> cell = new ListCell<>() {
                    @Override
                    protected void updateItem(File file, boolean empty) {
                        super.updateItem(file, empty);

                        if (empty || file == null) {
                            setText(null);
                            setGraphic(null);
                            return;
                        }

                        setText(formatQuickOpenItem(file));
                    }
                };

                cell.setOnMousePressed(event -> {
                    if (cell.isEmpty() || cell.getItem() == null) {
                        return;
                    }

                    quickOpenList.getSelectionModel().select(cell.getIndex());
                    quickOpenList.getFocusModel().focus(cell.getIndex());

                    if (event.getButton() == MouseButton.PRIMARY && event.getClickCount() >= 2) {
                        openSelectedQuickOpenItem();
                        event.consume();
                    }
                });

                return cell;
            });
            quickOpenList.setOnKeyPressed(event -> {
                if (event.getCode() == KeyCode.ENTER) {
                    openSelectedQuickOpenItem();
                    event.consume();
                } else if (event.getCode() == KeyCode.UP && quickOpenList.getSelectionModel().getSelectedIndex() <= 0) {
                    commandBar.requestFocus();
                    event.consume();
                } else if (event.getCode() == KeyCode.ESCAPE) {
                    closeQuickOpen();
                    commandBar.requestFocus();
                    event.consume();
                }
            });
            quickOpenPopup.getContent().add(quickOpenList);
        }

        applyCurrentThemeStyle(quickOpenList);
        updateQuickOpenResults(commandBar.getText());

        if (!quickOpenPopup.isShowing()) {
            Bounds bounds = commandBar.localToScreen(commandBar.getBoundsInLocal());
            quickOpenPopup.show(stage, bounds.getMinX(), bounds.getMaxY() + 4);
        }

        commandBar.requestFocus();
    }

    private void closeAllMenusExceptQuickOpen() {
        if (activeSubmenuPopup != null) {
            activeSubmenuPopup.hide();
            activeSubmenuPopup = null;
        }
        if (activeMenuPopup != null) {
            activeMenuPopup.hide();
            activeMenuPopup = null;
        }
    }

    private void closeQuickOpen() {
        if (quickOpenPopup != null) {
            quickOpenPopup.hide();
        }
    }

    private void selectQuickOpenRelative(int delta) {
        if (quickOpenList == null || quickOpenList.getItems().isEmpty()) {
            return;
        }

        int current = quickOpenList.getSelectionModel().getSelectedIndex();
        int next = current < 0 ? 0 : current + delta;
        selectQuickOpenIndex(next);
    }

    private void selectQuickOpenIndex(int index) {
        if (quickOpenList == null || quickOpenList.getItems().isEmpty()) {
            return;
        }

        int max = quickOpenList.getItems().size() - 1;
        int bounded = Math.max(0, Math.min(max, index));
        quickOpenList.getSelectionModel().select(bounded);
        quickOpenList.getFocusModel().focus(bounded);
        quickOpenList.scrollTo(bounded);
    }

    private void updateQuickOpenResults(String rawQuery) {
        if (quickOpenList == null) {
            return;
        }

        String query = rawQuery == null ? "" : rawQuery.trim();

        if (query.startsWith(">")) {
            quickOpenList.getItems().setAll(List.of());
        updateStatus("Command Palette");
            return;
        }

        List<File> files = workspaceFilesSupplier == null
                ? List.of()
                : workspaceFilesSupplier.get();

        List<File> filtered = new ArrayList<>(files);
        File previousSelection = quickOpenList.getSelectionModel().getSelectedItem();
        if (!query.isBlank()) {
            String normalizedQuery = normalizeQuickOpenText(query);
            filtered.removeIf(file -> !normalizeQuickOpenText(relativeWorkspacePath(file)).contains(normalizedQuery)
                    && !normalizeQuickOpenText(file.getName()).contains(normalizedQuery));
        }

        filtered.sort(Comparator
                .comparingInt((File file) -> scoreQuickOpen(file, query))
                .thenComparing(this::relativeWorkspacePath, String.CASE_INSENSITIVE_ORDER));

        if (filtered.size() > 100) {
            filtered = new ArrayList<>(filtered.subList(0, 100));
        }

        quickOpenList.getItems().setAll(filtered);
        if (filtered.isEmpty()) {
            return;
        }

        int previousIndex = previousSelection == null ? -1 : filtered.indexOf(previousSelection);
        if (previousIndex >= 0) {
            quickOpenList.getSelectionModel().select(previousIndex);
        } else {
            quickOpenList.getSelectionModel().select(0);
        }
    }

    private void openSelectedQuickOpenItem() {
        File selected = quickOpenList == null ? null : quickOpenList.getSelectionModel().getSelectedItem();

        if (selected == null || !selected.isFile()) {
            return;
        }

        closeQuickOpen();
        commandBar.clear();

        if (quickOpenFileAction != null) {
            quickOpenFileAction.accept(selected);
        }
    }

    private int scoreQuickOpen(File file, String query) {
        if (query == null || query.isBlank()) {
            return 1000;
        }

        String q = normalizeQuickOpenText(query);
        String name = normalizeQuickOpenText(file.getName());
        String path = normalizeQuickOpenText(relativeWorkspacePath(file));

        if (name.equals(q)) {
            return 0;
        }
        if (name.startsWith(q)) {
            return 10;
        }
        if (path.startsWith(q)) {
            return 20;
        }
        if (name.contains(q)) {
            return 30;
        }
        return 50;
    }

    private String formatQuickOpenItem(File file) {
        String relative = relativeWorkspacePath(file);
        String name = file.getName();

        if (relative.equals(name)) {
            return name;
        }

        int idx = relative.lastIndexOf(File.separatorChar);
        String parent = idx <= 0 ? "" : relative.substring(0, idx);
        return name + "    " + parent;
    }

    private String relativeWorkspacePath(File file) {
        File root = workspaceRootSupplier == null ? null : workspaceRootSupplier.get();

        if (root == null || file == null) {
            return file == null ? "" : file.getAbsolutePath();
        }

        try {
            return root.toPath().toAbsolutePath().normalize()
                    .relativize(file.toPath().toAbsolutePath().normalize())
                    .toString();
        } catch (Exception e) {
            return file.getAbsolutePath();
        }
    }

    private String normalizeQuickOpenText(String value) {
        return value == null
                ? ""
                : value.replace('\\', '/').toLowerCase(java.util.Locale.ROOT);
    }

    private void openFileMenu() {
        VBox menu = createMenuBox();

        HBox newFileRow = createSubmenuItem("New File");
        VBox newFileMenu = createMenuBox();
        newFileMenu.getChildren().addAll(
                createMenuItem("Text File", "Ctrl+N", this::newTextFile),
                createMenuItem("Java File", null, () -> editorManager.newFileWithExtension("java")),
                createMenuItem("Kotlin File", null, () -> editorManager.newFileWithExtension("kt")),
                createMenuItem("HTML File", null, () -> editorManager.newFileWithExtension("html")),
                createMenuItem("CSS File", null, () -> editorManager.newFileWithExtension("css")),
                createMenuItem("JavaScript File", null, () -> editorManager.newFileWithExtension("js")),
                createMenuItem("JSON File", null, () -> editorManager.newFileWithExtension("json")),
                createMenuItem("Markdown File", null, () -> editorManager.newFileWithExtension("md")),
                createMenuItem("Custom Extension...", null, this::promptNewFileWithExtension)
        );
        bindSubmenu(newFileRow, newFileMenu);

        HBox recentRow = createSubmenuItem("Open Recent");
        VBox recentMenu = createRecentFilesMenu();
        bindSubmenu(recentRow, recentMenu);

        menu.getChildren().addAll(
                newFileRow,
                createMenuItem("New Window", null, this::openNewWindow),
                createMenuItem("Open File...", "Ctrl+O", this::openFile),
                createMenuItem("Open Folder...", "Ctrl+Shift+O", this::openFolder),
                recentRow,
                createMenuItem("Save", "Ctrl+S", this::saveFile),
                createMenuItem("Save As...", "Ctrl+Shift+S", this::saveFileAs),
                createMenuItem("Revert File", null, this::revertFile),
                new Separator(),
                createMenuItem("Close Editor", "Ctrl+W", this::closeEditor),
                createMenuItem("Close Folder", null, this::closeFolder),
                new Separator(),
                createMenuItem("Preferences", "Ctrl+,", this::openPreferences)
        );

        showMenuBelow(fileMenu, menu);
    }

    private VBox createRecentFilesMenu() {
        VBox menu = createMenuBox();
        List<File> recentFiles = editorManager.getRecentFiles();

        if (recentFiles.isEmpty()) {
            menu.getChildren().add(createMenuItem("No recent files", null, null));
            return menu;
        }

        int count = Math.min(MAX_RECENT_ITEMS_IN_MENU, recentFiles.size());

        for (int i = 0; i < count; i++) {
            File file = recentFiles.get(i);
            menu.getChildren().add(
                    createMenuItem(
                            file.getName(),
                            abbreviatePath(file.getAbsolutePath(), 55),
                            () -> openRecentFile(file)
                    )
            );
        }

        return menu;
    }

    private void openEditMenu() {
        VBox menu = createMenuBox();
        menu.getChildren().addAll(
                createMenuItem("Desfazer", "Ctrl+Z", editorManager::undo),
                createMenuItem("Refazer", "Ctrl+Y", editorManager::redo),
                new Separator(),
                createMenuItem("Copiar", "Ctrl+C", editorManager::copy),
                createMenuItem("Colar", "Ctrl+V", editorManager::paste),
                createMenuItem("Selecionar Tudo", "Ctrl+A", editorManager::selectAll)
        );
        showMenuBelow(editMenu, menu);
    }

    private void openSelectionMenu() {
        VBox menu = createMenuBox();
        menu.getChildren().addAll(
                createMenuItem("Selecionar Tudo", "Ctrl+A", editorManager::selectAll),
                createMenuItem("Duplicar Linha", "Shift+Alt+Down", this::duplicateLineSafe),
                createMenuItem("Excluir Linha", "Ctrl+Shift+K", this::deleteLineSafe)
        );
        showMenuBelow(selectionMenu, menu);
    }

    private void openViewMenu() {
        VBox menu = createMenuBox();
        menu.getChildren().addAll(
                createMenuItem("Paleta de Comandos", "Ctrl+Shift+P", this::openCommandPalette),
                createMenuItem("Explorer", "Ctrl+Shift+E", () -> runAction(showExplorerAction, "Explorer")),
                createMenuItem("Pesquisar", "Ctrl+Shift+F", () -> runAction(showSearchAction, "Search")),
                createMenuItem("Desativar Barra Lateral", "Ctrl+B", () -> runAction(toggleSidebarAction, "Toggle sidebar"))
        );
        showMenuBelow(viewMenu, menu);
    }

    private void openGoMenu() {
        VBox menu = createMenuBox();
        menu.getChildren().addAll(
                createMenuItem("Ir para Arquivo...", "Ctrl+P", this::openCommandPalette),
                createMenuItem("Ir para Símbolo...", "Ctrl+Shift+O", this::openCommandPalette),
                createMenuItem("Ir para Linha/Coluna...", "Ctrl+G", this::openCommandPalette)
        );
        showMenuBelow(goMenu, menu);
    }
    private void openMoreMenu() {
        VBox menu = createMenuBox();

        HBox runRow = createSubmenuItem("Rodar");
        VBox runMenu = createMenuBox();
        runMenu.getChildren().addAll(
               createMenuItem("Rodar", "F5", () -> runAction(runCurrentFileAction, "Rodar")),
                createMenuItem("Rodar sem Debuggar", "Ctrl+F5", () -> updateStatus("Run without debugging")),
                createMenuItem("Parar", "Shift+F5", () -> updateStatus("Stop debugging"))
        );
        bindSubmenu(runRow, runMenu);

        HBox terminalRow = createSubmenuItem("Terminal");
        VBox terminalMenu = createMenuBox();
        terminalMenu.getChildren().addAll(
                createMenuItem("Novo Terminal", "Ctrl+Shift+`", () -> runAction(newTerminalAction, "New terminal")),
                createMenuItem("Dividir Terminal", "Ctrl+Shift+5", () -> runAction(splitTerminalAction, "Split terminal")),
                createMenuItem("Matar Terminal", null, () -> runAction(killTerminalAction, "Kill terminal")),
                new Separator(),
                createMenuItem("Focus Terminal", null, () -> runAction(focusTerminalAction, "Focus terminal"))
        );
        bindSubmenu(terminalRow, terminalMenu);

        HBox helpRow = createSubmenuItem("Help");
        VBox helpMenu = createMenuBox();
        helpMenu.getChildren().addAll(
                createMenuItem("Welcome", null, () -> updateStatus("Welcome")),
                createMenuItem("Show All Commands", "Ctrl+Shift+P", this::openCommandPalette),
                createMenuItem("About NPSharp", null, this::showAbout)
        );
        bindSubmenu(helpRow, helpMenu);

        menu.getChildren().addAll(runRow, terminalRow, helpRow);
        showMenuBelow(moreMenu, menu);
    }

    private void newTextFile() {
        editorManager.newTextFile();
    }

    private void promptNewFileWithExtension() {
        closeAllMenus();

        Popup popup = new Popup();
        popup.setAutoHide(true);
        popup.setHideOnEscape(true);

        VBox box = new VBox(8);
        box.getStyleClass().add("context-menu");
        applyCurrentThemeStyle(box);
        box.setPadding(new Insets(10));
        box.setPrefWidth(240);

        Label title = new Label("Nova extensao");
        title.getStyleClass().add("context-menu-item");

        TextField extensionField = new TextField();
        extensionField.setPromptText("Ex: java, js, txt");
        extensionField.getStyleClass().add("command-bar");

        HBox actions = new HBox(8);
        actions.setAlignment(Pos.CENTER_RIGHT);

        Label ok = createToolbarButton("OK", null);
        ok.getStyleClass().add("context-menu-item");
        ok.setOnMouseClicked(e -> {
            popup.hide();

            String ext = extensionField.getText() == null ? "" : extensionField.getText().trim();

            if (ext.startsWith(".")) {
                ext = ext.substring(1);
            }

            if (!ext.isBlank()) {
                editorManager.newFileWithExtension(ext);
            }
        });

        Label cancel = createToolbarButton("Cancel", null);
        cancel.getStyleClass().add("context-menu-item");
        cancel.setOnMouseClicked(e -> popup.hide());

        actions.getChildren().addAll(cancel, ok);
        box.getChildren().addAll(title, extensionField, actions);

        popup.getContent().add(box);

        Bounds bounds = commandBar.localToScreen(commandBar.getBoundsInLocal());
        popup.show(stage, bounds.getMinX(), bounds.getMaxY() + 4);

        Platform.runLater(extensionField::requestFocus);
    }

    private void openNewWindow() {
        if (newWindowAction != null) {
            newWindowAction.run();
            return;
        }

        Platform.runLater(() -> new MainWindow(new Stage()).show());
    }

    private void openFile() {
        editorManager.openFileFromDialog();
    }

    private void openFolder() {
        runAction(openFolderAction, "Open folder");
    }

    private void openRecentFile(File file) {
        if (file == null || !file.exists() || !file.isFile()) {
            updateStatus("Recent file is missing");
            return;
        }

        editorManager.openFileInTab(file);
    }

    private void saveFile() {
        editorManager.saveCurrentFile();
    }

    private void saveFileAs() {
        editorManager.saveCurrentFileAs();
    }

    private void openPreferences() {
        if (openPreferencesAction != null) {
            openPreferencesAction.run();
            return;
        }

        updateStatus("Preferences");
    }

    private void revertFile() {
        editorManager.revertCurrentFile();
    }

    private void closeEditor() {
        editorManager.closeCurrentTab();
    }

    private void closeFolder() {
        runAction(closeFolderAction, "Close folder");
    }

    private void duplicateLineSafe() {
        try {
            editorManager.getClass().getMethod("duplicateCurrentLine").invoke(editorManager);
        } catch (ReflectiveOperationException e) {
            updateStatus("Duplicate line not available yet");
        }
    }

    private void deleteLineSafe() {
        try {
            editorManager.getClass().getMethod("deleteCurrentLine").invoke(editorManager);
        } catch (ReflectiveOperationException e) {
            updateStatus("Delete line not available yet");
        }
    }

    private void openCommandPalette() {
        closeAllMenus();

        if (showCommandPaletteAction != null) {
            showCommandPaletteAction.run();
            updateStatus("Command palette");
            return;
        }

        updateStatus("Command palette");
        commandBar.selectAll();
        commandBar.requestFocus();
        openQuickOpen();
    }

    private void showAbout() {
        if (showAboutAction != null) {
            showAboutAction.run();
            return;
        }

        updateStatus("About NPSharp");
    }

    private void runAction(Runnable action, String fallbackStatus) {
        if (action != null) {
            action.run();
        } else {
            updateStatus(fallbackStatus);
        }
    }

    private void toggleMaximize() {
        if (!maximized) {
            saveRestoreBounds();

            Rectangle2D bounds = Screen.getScreensForRectangle(
                    stage.getX(),
                    stage.getY(),
                    Math.max(stage.getWidth(), 1),
                    Math.max(stage.getHeight(), 1)
            ).stream()
                    .findFirst()
                    .orElse(Screen.getPrimary())
                    .getVisualBounds();

            stage.setX(bounds.getMinX());
            stage.setY(bounds.getMinY());
            stage.setWidth(bounds.getWidth());
            stage.setHeight(bounds.getHeight());

            maximized = true;
        } else {
            restoreWindowBounds();
            maximized = false;
        }

        updateMaximizeIcon();
        applyCurrentIconTheme();
    }

    private void saveRestoreBounds() {
        if (!maximized) {
            restoreX = stage.getX();
            restoreY = stage.getY();
            restoreWidth = stage.getWidth();
            restoreHeight = stage.getHeight();
        }
    }

    private void restoreWindowBounds() {
        if (Double.isNaN(restoreX) || Double.isNaN(restoreY)) {
            stage.setWidth(DEFAULT_RESTORE_WIDTH);
            stage.setHeight(DEFAULT_RESTORE_HEIGHT);
            stage.centerOnScreen();
            return;
        }

        stage.setX(restoreX);
        stage.setY(restoreY);
        stage.setWidth(restoreWidth);
        stage.setHeight(restoreHeight);
    }

    private void updateMaximizeIcon() {
        if (btnMax == null) {
            return;
        }

        btnMax.setGraphic(
                createThemedWindowIcon(
                        maximized
                                ? "/icons/codicons/chrome-restore.svg"
                                : "/icons/codicons/chrome-maximize.svg"
                )
        );
    }

    private void configureDrag() {
        setOnMousePressed(event -> {
            if (event.getButton() != MouseButton.PRIMARY) {
                return;
            }

            if (isInteractiveTarget(event.getTarget())) {
                return;
            }

            dragOffsetX = event.getSceneX();
            dragOffsetY = event.getSceneY();
        });

        setOnMouseDragged(event -> {
            if (event.getButton() != MouseButton.PRIMARY) {
                return;
            }

            if (isInteractiveTarget(event.getTarget())) {
                return;
            }

            if (maximized) {
                double ratioX = event.getSceneX() / Math.max(getWidth(), 1);

                restoreWindowBounds();
                maximized = false;
                updateMaximizeIcon();

                dragOffsetX = restoreWidth * ratioX;
                dragOffsetY = Math.min(event.getSceneY(), TITLEBAR_HEIGHT);
            }

            stage.setX(event.getScreenX() - dragOffsetX);
            stage.setY(event.getScreenY() - dragOffsetY);
        });

        setOnMouseClicked(event -> {
            if (event.getButton() == MouseButton.PRIMARY && event.getClickCount() == 2) {
                if (!isInteractiveTarget(event.getTarget())) {
                    toggleMaximize();
                }
            }
        });
    }

    private boolean isInteractiveTarget(Object target) {
        if (!(target instanceof Node node)) {
            return false;
        }

        while (node != null) {
            if (node == commandBar) {
                return true;
            }

            if (node instanceof Label label) {
                if (label.getStyleClass().contains("title-menu")
                        || label.getStyleClass().contains("title-toolbar-button")
                        || label.getStyleClass().contains("window-button")) {
                    return true;
                }
            }

            node = node.getParent();
        }

        return false;
    }

    private void applyCurrentIconTheme() {
        String effectiveTheme = ThemeIconHelper.normalizeTheme(themeName);
        String effectiveColor = ThemeIconHelper.normalizeIconColor(iconColorValue);
        applyIconThemeToNode(this, effectiveTheme, effectiveColor);
    }

    private void applyIconThemeToNode(Node root, String effectiveTheme, String effectiveColor) {
        if (root == null) {
            return;
        }

        if (root.getStyleClass().contains("themed-icon")) {
            String cssColor = ThemeIconHelper.resolveIconColorCss(effectiveTheme, effectiveColor);
            root.setStyle("-fx-fill: " + cssColor + ";");
        }

        if (root instanceof HBox hbox) {
            for (Node child : hbox.getChildren()) {
                applyIconThemeToNode(child, effectiveTheme, effectiveColor);
            }
            return;
        }

        if (root instanceof VBox vbox) {
            for (Node child : vbox.getChildren()) {
                applyIconThemeToNode(child, effectiveTheme, effectiveColor);
            }
        }
    }

    private String abbreviatePath(String path, int maxLength) {
        if (path == null || path.length() <= maxLength) {
            return path;
        }

        int keep = Math.max(10, (maxLength - 3) / 2);
        return path.substring(0, keep) + "..." + path.substring(path.length() - keep);
    }

    private void updateStatus(String text) {
        if (statusUpdater != null) {
            statusUpdater.accept(text);
        }
    }
}

