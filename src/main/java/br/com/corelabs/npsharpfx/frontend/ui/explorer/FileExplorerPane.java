/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.frontend.ui.explorer;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;
import java.util.function.Supplier;

import br.com.corelabs.npsharpfx.frontend.ui.icons.Codicon;
import br.com.corelabs.npsharpfx.frontend.ui.icons.FileIconManager;
import javafx.animation.PauseTransition;
import javafx.application.Platform;
import javafx.event.EventTarget;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Alert;
import javafx.scene.control.Button;
import javafx.scene.control.ButtonBar;
import javafx.scene.control.ButtonType;
import javafx.scene.control.ContextMenu;
import javafx.scene.control.Dialog;
import javafx.scene.control.Label;
import javafx.scene.control.MenuItem;
import javafx.scene.control.TextField;
import javafx.scene.control.TreeCell;
import javafx.scene.control.TreeItem;
import javafx.scene.control.TreeView;
import javafx.scene.input.Clipboard;
import javafx.scene.input.ClipboardContent;
import javafx.scene.input.KeyCode;
import javafx.scene.input.MouseButton;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;
import javafx.stage.DirectoryChooser;
import javafx.stage.Stage;
import javafx.util.Duration;

public class FileExplorerPane {

    private static final Set<String> IGNORED_DIRECTORY_NAMES = Set.of(
            ".git",
            ".hg",
            ".svn",
            ".idea",
            ".gradle",
            ".settings",
            "node_modules",
            "target",
            "build",
            "dist",
            "out",
            "bin",
            "obj",
            "vendor",
            "coverage"
    );

    private final VBox view;
    private final TreeView<File> treeView;
    private final VBox emptyState;
    private final HBox toolbar;
    private final StackPane contentHost;
    private final Map<TreeItem<File>, PendingCreate> pendingCreates = new IdentityHashMap<>();
    private final Map<Path, DirectorySnapshot> directoryCache = new ConcurrentHashMap<>();
    private final ExecutorService directoryLoader = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "npsharp-worktree-loader");
        thread.setDaemon(true);
        return thread;
    });
    private final Consumer<File> onFileOpen;
    private final Consumer<File> onFolderOpen;
    private final Stage stage;
    private boolean renameRequestedFromMenu;
    private final Consumer<File> onLiveServerOpen;
    private File currentRootFolder;
    private Supplier<String> menuStyleSupplier;
    private Set<Path> expandedPathsToRestore = Collections.emptySet();

public FileExplorerPane(Stage stage, Consumer<File> onFileOpen, Consumer<File> onFolderOpen, Consumer<File> onLiveServerOpen) {
        this.stage = stage;
        this.onFileOpen = onFileOpen;
        this.onFolderOpen = onFolderOpen;

        this.treeView = new TreeView<>();
        this.treeView.getStyleClass().add("file-tree");
        this.treeView.setShowRoot(true);
        this.treeView.setEditable(true);
        this.treeView.setMinWidth(0);
        this.onLiveServerOpen = onLiveServerOpen;
        this.treeView.setContextMenu(createWorkspaceContextMenu());
        VBox.setVgrow(treeView, Priority.ALWAYS);

        this.treeView.setCellFactory(tv -> new ExplorerTreeCell());

        this.treeView.setOnKeyPressed(event -> {
            if (event.getCode() == KeyCode.ENTER) {
                if (treeView.getEditingItem() != null) {
                    return;
                }
                openSelectedItem();
                event.consume();
            } else if (event.getCode() == KeyCode.DELETE) {
                TreeItem<File> selected = treeView.getSelectionModel().getSelectedItem();
                if (selected != null) {
                    confirmDelete(selected.getValue());
                    event.consume();
                }
            } else if (event.getCode() == KeyCode.F5) {
                refresh();
                event.consume();
            }
        });

        this.toolbar = createToolbar();
        this.emptyState = createEmptyState();
        this.contentHost = new StackPane(treeView, emptyState);
        this.contentHost.getStyleClass().add("explorer-content-host");
        VBox.setVgrow(contentHost, Priority.ALWAYS);

        this.view = new VBox(toolbar, contentHost);
        this.view.getStyleClass().add("explorer-pane");
        this.view.setMinWidth(180);
        this.view.setPrefWidth(280);
        this.view.setMaxWidth(Double.MAX_VALUE);
        this.view.setFillWidth(true);

        refreshVisibility();
    }

    public Node getView() {
        return view;
    }

    public File getCurrentRootFolder() {
        return currentRootFolder;
    }

    public void setMenuStyleSupplier(Supplier<String> menuStyleSupplier) {
        this.menuStyleSupplier = menuStyleSupplier;
        applyMenuStyle(treeView.getContextMenu());
    }

    public void openFolderFromDialog() {
        DirectoryChooser chooser = new DirectoryChooser();
        chooser.setTitle("Selecionar pasta");

        File initial = currentRootFolder != null && currentRootFolder.exists()
                ? currentRootFolder
                : new File(System.getProperty("user.home"));
        if (initial.exists()) {
            chooser.setInitialDirectory(initial);
        }

        File selectedFolder = chooser.showDialog(stage);
        if (selectedFolder != null && selectedFolder.isDirectory()) {
            openFolder(selectedFolder);
        }
    }

    public void openFolder(File folder) {
        if (folder == null || !folder.exists() || !folder.isDirectory()) {
            return;
        }

        currentRootFolder = normalizeFile(folder);
        if (onFolderOpen != null) {
            onFolderOpen.accept(currentRootFolder);
        }

        pendingCreates.clear();
        directoryCache.clear();
        expandedPathsToRestore = Collections.emptySet();
        TreeItem<File> rootItem = createNode(currentRootFolder);
        treeView.setRoot(rootItem);
        rootItem.setExpanded(true);
        ensureChildrenLoaded(rootItem);
        treeView.getSelectionModel().clearSelection();
        refreshVisibility();
    }

    public void clearFolder() {
        currentRootFolder = null;
        pendingCreates.clear();
        directoryCache.clear();
        expandedPathsToRestore = Collections.emptySet();
        treeView.setRoot(null);
        refreshVisibility();
    }

    public void refresh() {
        TreeItem<File> selected = treeView.getSelectionModel().getSelectedItem();
        File selectedFile = selected == null ? null : selected.getValue();
        Set<Path> expandedPaths = collectExpandedPaths();

        if (currentRootFolder == null) {
            refreshVisibility();
            return;
        }

        pendingCreates.clear();
        directoryCache.clear();
        expandedPathsToRestore = expandedPaths;
        TreeItem<File> rootItem = createNode(currentRootFolder);
        treeView.setRoot(rootItem);
        rootItem.setExpanded(true);
        ensureChildrenLoaded(rootItem);
        restoreExpandedPaths(rootItem, expandedPaths);

        if (selectedFile != null) {
            selectFile(selectedFile);
        }

        refreshVisibility();
    }

    private void refreshDirectory(File directory) {
        if (directory == null || !directory.isDirectory()) {
            refresh();
            return;
        }

        TreeItem<File> item = findItem(treeView.getRoot(), directory);
        if (!(item instanceof ExplorerTreeItem explorerItem)) {
            refresh();
            return;
        }

        Path key = normalizedPath(directory);
        if (key != null) {
            directoryCache.remove(key);
        }

        explorerItem.childrenLoaded = false;
        explorerItem.loading = false;
        explorerItem.getChildren().setAll(List.of(createLoadingPlaceholder()));

        if (explorerItem.isExpanded()) {
            ensureChildrenLoaded(explorerItem);
        }
    }

    public void collapseAll() {
        TreeItem<File> root = treeView.getRoot();
        if (root == null) {
            return;
        }

        collapseChildren(root);
        root.setExpanded(true);
    }

    public void promptCreateFile() {
        File baseDir = getSelectedDirectory();
        promptCreatePath(baseDir == null ? currentRootFolder : baseDir, false);
    }

    public void promptCreateFolder() {
        File baseDir = getSelectedDirectory();
        promptCreatePath(baseDir == null ? currentRootFolder : baseDir, true);
    }

    public void revealFile(File file) {
        if (file == null || currentRootFolder == null) {
            return;
        }

        selectFile(file);
    }

    private HBox createToolbar() {
        Label newFile = createToolbarButton("/icons/codicons/new-file.svg", "Novo arquivo");
        newFile.setOnMouseClicked(event -> promptCreateFile());

        Label newFolder = createToolbarButton("/icons/codicons/new-folder.svg", "Nova pasta");
        newFolder.setOnMouseClicked(event -> promptCreateFolder());

        Label refresh = createToolbarButton("/icons/codicons/refresh.svg", "Atualizar");
        refresh.setOnMouseClicked(event -> refresh());

        Label collapse = createToolbarButton("/icons/codicons/collapse-all.svg", "Recolher tudo");
        collapse.setOnMouseClicked(event -> collapseAll());

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        HBox box = new HBox(4, spacer, newFile, newFolder, refresh, collapse);
        box.getStyleClass().add("explorer-toolbar");
        box.setAlignment(Pos.CENTER_RIGHT);
        return box;
    }

    private Label createToolbarButton(String iconPath, String tooltipText) {
        Label label = new Label();
        label.getStyleClass().add("explorer-toolbar-button");
        label.setTooltip(new javafx.scene.control.Tooltip(tooltipText));

        try {
            label.setGraphic(Codicon.icon(iconPath));
        } catch (Exception e) {
            label.setText(tooltipText.substring(0, 1));
        }

        return label;
    }

    private VBox createEmptyState() {
        Button openFolderButton = new Button("Open Folder");
        openFolderButton.getStyleClass().addAll("welcome-action", "button-primary");
        openFolderButton.setOnAction(event -> openFolderFromDialog());

        Label emptyTitle = new Label("Nenhuma pasta aberta");
        emptyTitle.getStyleClass().addAll("welcome-title", "explorer-empty-title");

        Label emptySubtitle = new Label("Abra uma pasta para exibir os arquivos no Explorer.");
        emptySubtitle.getStyleClass().addAll("welcome-subtitle", "explorer-empty-subtitle");
        emptySubtitle.setWrapText(true);
        emptySubtitle.setMaxWidth(220);

        VBox state = new VBox(12, emptyTitle, emptySubtitle, openFolderButton);
        state.getStyleClass().add("explorer-empty-state");
        state.setAlignment(Pos.CENTER);
        state.setPadding(new Insets(24));
        return state;
    }

    private ContextMenu createContextMenu(File file) {
        ContextMenu menu = new ContextMenu();
        applyMenuStyle(menu);

        File baseDir = file.isDirectory() ? file : file.getParentFile();

        MenuItem newFile = new MenuItem("Novo arquivo");
        newFile.setOnAction(event -> startInlineCreate(baseDir, false));

        MenuItem newFolder = new MenuItem("Nova pasta");
        newFolder.setOnAction(event -> startInlineCreate(baseDir, true));

        MenuItem open = new MenuItem(file.isDirectory() ? "Abrir pasta" : "Abrir arquivo");
        open.setOnAction(event -> {
            if (file.isDirectory()) {
                openFolder(file);
            } else if (onFileOpen != null) {
                onFileOpen.accept(file);
            }
        });
        MenuItem openWithLiveServer = new MenuItem("Open with Live Server");
        openWithLiveServer.setOnAction(event -> {
            if (onLiveServerOpen != null) {
            onLiveServerOpen.accept(file);
            }
        });

        boolean liveServerSupported = file.isFile() && isLiveServerSupported(file);
        openWithLiveServer.setDisable(!liveServerSupported);

        MenuItem rename = new MenuItem("Renomear");
        rename.setOnAction(event -> startInlineRenameForFile(file));

        MenuItem delete = new MenuItem("Excluir");
        delete.setOnAction(event -> confirmDelete(file));

        MenuItem copyPath = new MenuItem("Copiar caminho");
        copyPath.setOnAction(event -> copyToClipboard(file.getAbsolutePath()));

        MenuItem copyRelativePath = new MenuItem("Copiar caminho relativo");
        copyRelativePath.setOnAction(event -> copyToClipboard(relativePath(file)));

        MenuItem refresh = new MenuItem("Atualizar");
        refresh.setOnAction(event -> refreshDirectory(file.isDirectory() ? file : file.getParentFile()));

        menu.getItems().addAll(open, openWithLiveServer, newFile, newFolder, rename, delete, copyPath, copyRelativePath, refresh);
        return menu;
    }

    private ContextMenu createWorkspaceContextMenu() {
        ContextMenu menu = new ContextMenu();
        applyMenuStyle(menu);

        MenuItem newFile = new MenuItem("Novo arquivo");
        newFile.setOnAction(event -> startInlineCreate(currentRootFolder, false));

        MenuItem newFolder = new MenuItem("Nova pasta");
        newFolder.setOnAction(event -> startInlineCreate(currentRootFolder, true));

        MenuItem refresh = new MenuItem("Atualizar");
        refresh.setOnAction(event -> refresh());

        menu.getItems().addAll(newFile, newFolder, refresh);
        return menu;
    }

    private void applyMenuStyle(ContextMenu menu) {
        if (menuStyleSupplier == null) {
            return;
        }

        String style = menuStyleSupplier.get();
        if (style != null && !style.isBlank()) {
            menu.setStyle(style);
        }
    }

    private void promptCreatePath(File baseDir, boolean folder) {
        if (baseDir == null || currentRootFolder == null) {
            return;
        }
        startInlineCreate(baseDir, folder);
    }

    private void startInlineCreate(File baseDir, boolean folder) {
        if (baseDir == null || currentRootFolder == null) {
            return;
        }

        File directory = baseDir.isDirectory() ? baseDir : baseDir.getParentFile();
        if (directory == null || !directory.isDirectory()) {
            return;
        }

        TreeItem<File> parent = findItem(treeView.getRoot(), directory);
        if (parent == null) {
            parent = treeView.getRoot();
            directory = currentRootFolder;
        }

        loadChildrenNow(parent);
        parent.setExpanded(true);

        String defaultName = nextAvailableName(directory.toPath(), folder ? "New Folder" : "untitled");
        File draftFile = directory.toPath().resolve(defaultName).toFile();
        TreeItem<File> draftItem = new TreeItem<>(draftFile);
        draftItem.setGraphic(FileIconManager.getIcon(draftFile, false));

        pendingCreates.put(draftItem, new PendingCreate(directory, folder));
        parent.getChildren().add(0, draftItem);
        treeView.getSelectionModel().select(draftItem);
        treeView.scrollTo(treeView.getRow(draftItem));

        Platform.runLater(() -> treeView.edit(draftItem));
    }

    private void startInlineRenameForFile(File file) {
        TreeItem<File> item = findItem(treeView.getRoot(), file);
        if (item != null) {
            startInlineRename(item);
        }
    }

    private void startInlineRename(TreeItem<File> item) {
        if (item == null || pendingCreates.containsKey(item)) {
            return;
        }

        treeView.getSelectionModel().select(item);
        treeView.scrollTo(treeView.getRow(item));
        renameRequestedFromMenu = true;
        Platform.runLater(() -> {
            treeView.edit(item);
            renameRequestedFromMenu = false;
        });
    }

    private boolean commitInlineName(TreeItem<File> item, String rawName) {
        if (item == null) {
            return false;
        }

        String name = rawName == null ? "" : rawName.trim().replace('\\', '/');
        if (name.isBlank()) {
            cancelPendingCreate(item);
            return false;
        }

        PendingCreate pendingCreate = pendingCreates.remove(item);
        if (pendingCreate != null) {
            return commitPendingCreate(item, pendingCreate, name);
        }

        return commitRename(item, name);
    }

    private boolean commitPendingCreate(TreeItem<File> item, PendingCreate pendingCreate, String name) {
        try {
            Path root = currentRootFolder.toPath().toRealPath().normalize();
            Path base = pendingCreate.baseDir().toPath().toRealPath().normalize();
            Path target = base.resolve(name).normalize();

            if (!base.startsWith(root) || !target.startsWith(root)) {
                showError("Caminho fora do workspace.");
                cancelPendingCreate(item);
                return false;
            }

            if (Files.exists(target)) {
                showError("Ja existe um item com esse nome.");
                cancelPendingCreate(item);
                return false;
            }

            Path parent = target.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }

            if (pendingCreate.folder()) {
                Files.createDirectories(target);
            } else {
                Files.createFile(target);
            }

            refresh();
            selectFile(target.toFile());

            if (!pendingCreate.folder() && onFileOpen != null) {
                onFileOpen.accept(target.toFile());
            }

            return true;
        } catch (IOException | SecurityException e) {
            showError("Nao foi possivel criar: " + e.getMessage());
            cancelPendingCreate(item);
            return false;
        }
    }

    private boolean commitRename(TreeItem<File> item, String name) {
        File file = item.getValue();
        if (file == null || currentRootFolder == null || file.getName().equals(name)) {
            return false;
        }

        try {
            Path root = currentRootFolder.toPath().toRealPath().normalize();
            Path target = file.toPath().getParent().resolve(name).normalize();

            if (!target.startsWith(root)) {
                showError("Caminho fora do workspace.");
                return false;
            }
            if (Files.exists(target)) {
                showError("Ja existe um item com esse nome.");
                return false;
            }

            Files.move(file.toPath(), target);
            refresh();
            selectFile(target.toFile());
            return true;
        } catch (IOException | SecurityException e) {
            showError("Nao foi possivel renomear: " + e.getMessage());
            return false;
        }
    }

    private void cancelPendingCreate(TreeItem<File> item) {
        if (item == null || !pendingCreates.containsKey(item)) {
            return;
        }

        pendingCreates.remove(item);
        TreeItem<File> parent = item.getParent();
        if (parent != null) {
            parent.getChildren().remove(item);
        }
    }

    private String nextAvailableName(Path baseDir, String baseName) {
        Path candidate = baseDir.resolve(baseName);
        if (!Files.exists(candidate)) {
            return baseName;
        }

        for (int i = 1; i < 1000; i++) {
            String candidateName = baseName + "-" + i;
            if (!Files.exists(baseDir.resolve(candidateName))) {
                return candidateName;
            }
        }

        return baseName + "-" + System.currentTimeMillis();
    }

    private void confirmDelete(File file) {
        if (file == null || currentRootFolder == null) {
            return;
        }

        Alert alert = new Alert(Alert.AlertType.CONFIRMATION);
        alert.setTitle("Excluir");
        alert.setHeaderText(null);
        alert.setContentText("Excluir \"" + file.getName() + "\"?");
        ButtonType delete = new ButtonType("Excluir", ButtonBar.ButtonData.OK_DONE);
        alert.getButtonTypes().setAll(ButtonType.CANCEL, delete);
        applyDialogStyle(alert);

        Optional<ButtonType> result = alert.showAndWait();
        if (result.isEmpty() || result.get() != delete) {
            return;
        }

        try {
            deleteRecursively(file.toPath());
            refresh();
        } catch (IOException | SecurityException e) {
            showError("Nao foi possivel excluir: " + e.getMessage());
        }
    }

    private void deleteRecursively(Path path) throws IOException {
        if (!Files.exists(path)) {
            return;
        }

        if (Files.isDirectory(path)) {
            try (var children = Files.list(path)) {
                for (Path child : children.toList()) {
                    deleteRecursively(child);
                }
            }
        }

        Files.deleteIfExists(path);
    }

    private void showError(String message) {
        Alert alert = new Alert(Alert.AlertType.ERROR);
        alert.setTitle("Explorer");
        alert.setHeaderText(null);
        alert.setContentText(message);
        applyDialogStyle(alert);
        alert.showAndWait();
    }

    private void applyDialogStyle(Dialog<?> dialog) {
        if (dialog == null || menuStyleSupplier == null) {
            return;
        }

        String style = menuStyleSupplier.get();
        if (style != null && !style.isBlank()) {
            dialog.getDialogPane().setStyle(style);
        }
    }

    private void openSelectedItem() {
        TreeItem<File> selected = treeView.getSelectionModel().getSelectedItem();
        if (selected == null) {
            return;
        }

        openTreeItem(selected);
    }

    private void openTreeItem(TreeItem<File> selected) {
        if (selected == null) {
            return;
        }

        File file = selected.getValue();
        if (file == null) {
            return;
        }

        if (file.isDirectory()) {
            selected.setExpanded(!selected.isExpanded());
        } else if (onFileOpen != null) {
            onFileOpen.accept(file);
        }
    }

    private void copyToClipboard(String text) {
        if (text == null || text.isBlank()) {
            return;
        }

        ClipboardContent content = new ClipboardContent();
        content.putString(text);
        Clipboard.getSystemClipboard().setContent(content);
    }

    private String relativePath(File file) {
        if (file == null || currentRootFolder == null) {
            return "";
        }

        try {
            return currentRootFolder.toPath()
                    .toAbsolutePath()
                    .normalize()
                    .relativize(file.toPath().toAbsolutePath().normalize())
                    .toString()
                    .replace('\\', '/');
        } catch (Exception e) {
            return file.getName();
        }
    }

    private File getSelectedDirectory() {
        TreeItem<File> selected = treeView.getSelectionModel().getSelectedItem();
        File file = selected == null ? null : selected.getValue();
        if (file == null) {
            return null;
        }

        return file.isDirectory() ? file : file.getParentFile();
    }

    private void refreshVisibility() {
        boolean hasFolder = currentRootFolder != null && treeView.getRoot() != null;
        toolbar.setVisible(hasFolder);
        toolbar.setManaged(hasFolder);
        treeView.setVisible(hasFolder);
        treeView.setManaged(hasFolder);
        emptyState.setVisible(!hasFolder);
        emptyState.setManaged(!hasFolder);
    }

    private TreeItem<File> createNode(File file) {
        File nodeFile = normalizeFile(file);
        ExplorerTreeItem item = new ExplorerTreeItem(nodeFile);
        item.setExpanded(false);
        item.setGraphic(FileIconManager.getIcon(nodeFile, false));

        if (nodeFile.isDirectory()) {
            File directory = nodeFile;
            item.expandedProperty().addListener((obs, oldVal, expanded) ->
                    item.setGraphic(FileIconManager.getIcon(directory, expanded)));
            item.getChildren().setAll(List.of(createLoadingPlaceholder()));
            item.expandedProperty().addListener((obs, oldVal, expanded) -> {
                if (expanded) {
                    ensureChildrenLoaded(item);
                }
            });
        }

        return item;
    }

    private TreeItem<File> createLoadingPlaceholder() {
        return new TreeItem<>((File) null);
    }

    private void ensureChildrenLoaded(TreeItem<File> item) {
        if (!(item instanceof ExplorerTreeItem explorerItem)
                || explorerItem.childrenLoaded
                || explorerItem.loading) {
            return;
        }

        File directory = explorerItem.getValue();
        if (directory == null || !directory.isDirectory()) {
            return;
        }

        explorerItem.loading = true;

        directoryLoader.submit(() -> {
            List<File> children = loadVisibleChildren(directory);

            Platform.runLater(() -> {
                if (!explorerItem.loading) {
                    return;
                }
                explorerItem.loading = false;
                populateChildren(explorerItem, children);
                restoreExpandedPaths(explorerItem, expandedPathsToRestore);
            });
        });
    }

    private void loadChildrenNow(TreeItem<File> item) {
        if (!(item instanceof ExplorerTreeItem explorerItem) || explorerItem.childrenLoaded) {
            return;
        }

        File directory = explorerItem.getValue();
        if (directory == null || !directory.isDirectory()) {
            return;
        }

        explorerItem.loading = false;
        populateChildren(explorerItem, loadVisibleChildren(directory));
    }

    private void populateChildren(ExplorerTreeItem item, List<File> children) {
        List<TreeItem<File>> childItems = new ArrayList<>(children.size());
        for (File child : children) {
            childItems.add(createNode(child));
        }

        item.getChildren().setAll(childItems);
        item.childrenLoaded = true;
    }

    private List<File> loadVisibleChildren(File directory) {
        Path key = normalizedPath(directory);
        long lastModified = lastModifiedMillis(directory);
        DirectorySnapshot cached = directoryCache.get(key);

        if (cached != null && cached.lastModifiedMillis() == lastModified) {
            return cached.children();
        }

        List<File> children = new ArrayList<>();
        try (var stream = Files.list(directory.toPath())) {
            stream
                    .filter(this::isVisibleExplorerPath)
                    .map(Path::toFile)
                    .map(this::normalizeFile)
                    .forEach(children::add);
        } catch (IOException | SecurityException e) {
            return List.of();
        }

        children.sort(Comparator
                .comparing(File::isFile)
                .thenComparing(File::getName, String.CASE_INSENSITIVE_ORDER));

        List<File> snapshotChildren = List.copyOf(children);
        directoryCache.put(key, new DirectorySnapshot(lastModified, snapshotChildren));
        return snapshotChildren;
    }

    private boolean isVisibleExplorerPath(Path path) {
        try {
            if (Files.isHidden(path)) {
                return false;
            }
        } catch (IOException | SecurityException e) {
            return false;
        }

        if (Files.isDirectory(path)) {
            Path fileName = path.getFileName();
            String name = fileName == null ? "" : fileName.toString();
            return !isIgnoredDirectoryName(name);
        }

        return true;
    }

    private boolean isIgnoredDirectoryName(String name) {
        return name != null && IGNORED_DIRECTORY_NAMES.contains(name.toLowerCase(Locale.ROOT));
    }

    private long lastModifiedMillis(File file) {
        try {
            return Files.getLastModifiedTime(file.toPath()).toMillis();
        } catch (IOException | SecurityException e) {
            return -1;
        }
    }

    private final class ExplorerTreeCell extends TreeCell<File> {

        private final PauseTransition openDelay = new PauseTransition(Duration.millis(230));
        private TextField editor;

        private ExplorerTreeCell() {
            setOnMouseClicked(event -> {
                if (event.getButton() != MouseButton.PRIMARY
                        || isEmpty()
                        || getTreeItem() == null
                        || isDisclosureClick(event.getTarget())) {
                    return;
                }

                TreeItem<File> item = getTreeItem();
                treeView.getSelectionModel().select(item);

                if (event.getClickCount() >= 1) {
                    openTreeItem(item);
                    event.consume();
                }
            });
        }

        @Override
        public void startEdit() {
            TreeItem<File> item = getTreeItem();
            if (item == null || getItem() == null) {
                return;
            }
            if (!renameRequestedFromMenu && !pendingCreates.containsKey(item)) {
                return;
            }

            super.startEdit();

            editor = new TextField(initialEditText(item, getItem()));
            editor.getStyleClass().add("explorer-inline-editor");
            editor.setOnAction(event -> finishEdit());
            editor.setOnKeyPressed(event -> {
                if (event.getCode() == KeyCode.ESCAPE) {
                    cancelEdit();
                    event.consume();
                }
            });
            editor.focusedProperty().addListener((obs, wasFocused, focused) -> {
                if (!focused && isEditing()) {
                    finishEdit();
                }
            });

            setText(null);
            setGraphic(editor);
            Platform.runLater(() -> {
                editor.requestFocus();
                editor.selectAll();
            });
        }

        @Override
        public void cancelEdit() {
            TreeItem<File> item = getTreeItem();
            super.cancelEdit();
            cancelPendingCreate(item);
            render(getItem(), isEmpty());
        }

        @Override
        protected void updateItem(File file, boolean empty) {
            super.updateItem(file, empty);
            render(file, empty);
        }

        private void finishEdit() {
            TreeItem<File> item = getTreeItem();
            String value = editor == null ? "" : editor.getText();
            boolean committed = commitInlineName(item, value);

            if (!committed) {
                super.cancelEdit();
                render(getItem(), isEmpty());
                return;
            }

            super.cancelEdit();
        }

        private void render(File file, boolean empty) {
            if (empty || file == null) {
                setText(null);
                setGraphic(null);
                setContextMenu(null);
                return;
            }

            if (isEditing() && editor != null) {
                setText(null);
                setGraphic(editor);
                return;
            }

            TreeItem<File> currentItem = getTreeItem();
            boolean expanded = currentItem != null && currentItem.isExpanded();
            String name = displayName(file);
            setText(name);

            try {
                setGraphic(FileIconManager.getIcon(file, expanded));
            } catch (Exception e) {
                setGraphic(null);
            }

            setContextMenu(createContextMenu(file));
        }

        private String initialEditText(TreeItem<File> item, File file) {
            PendingCreate pendingCreate = pendingCreates.get(item);
            if (pendingCreate != null) {
                return file.getName();
            }

            return file.getName() == null || file.getName().isBlank()
                    ? file.getAbsolutePath()
                    : file.getName();
        }
    }

    private String displayName(File file) {
        String name = file.getName();
        return name == null || name.isBlank() ? file.getAbsolutePath() : name;
    }

    private boolean isLiveServerSupported(File file) {
    if (file == null || !file.isFile()) {
        return false;
    }

    String name = file.getName().toLowerCase(Locale.ROOT);
    return name.endsWith(".html")
            || name.endsWith(".htm")
            || name.endsWith(".php");
}

    private record PendingCreate(File baseDir, boolean folder) {
    }

    private static final class ExplorerTreeItem extends TreeItem<File> {
        private boolean childrenLoaded;
        private boolean loading;

        private ExplorerTreeItem(File file) {
            super(file);
        }
    }

    private record DirectorySnapshot(long lastModifiedMillis, List<File> children) {
    }

    private void collapseChildren(TreeItem<File> item) {
        for (TreeItem<File> child : item.getChildren()) {
            collapseChildren(child);
            child.setExpanded(false);
        }
    }

    private void selectFile(File file) {
        TreeItem<File> root = treeView.getRoot();
        if (root == null || file == null) {
            return;
        }

        TreeItem<File> found = findItem(root, file);
        if (found == null) {
            found = loadPathToFile(root, file);
        }

        if (found != null) {
            expandParents(found);
            treeView.getSelectionModel().select(found);
            treeView.scrollTo(treeView.getRow(found));
        }
    }

    private TreeItem<File> loadPathToFile(TreeItem<File> root, File file) {
        File rootFile = root.getValue();
        Path rootPath = normalizedPath(rootFile);
        Path targetPath = normalizedPath(file);

        if (rootPath == null || targetPath == null || !targetPath.startsWith(rootPath)) {
            return null;
        }

        if (rootPath.equals(targetPath)) {
            return root;
        }

        TreeItem<File> currentItem = root;
        Path currentPath = rootPath;
        Path relative = rootPath.relativize(targetPath);

        for (Path part : relative) {
            currentItem.setExpanded(true);
            loadChildrenNow(currentItem);
            currentPath = currentPath.resolve(part).normalize();

            TreeItem<File> nextItem = findDirectChild(currentItem, currentPath);
            if (nextItem == null) {
                return null;
            }

            currentItem = nextItem;
        }

        return currentItem;
    }

    private TreeItem<File> findDirectChild(TreeItem<File> item, Path childPath) {
        if (item == null || childPath == null) {
            return null;
        }

        for (TreeItem<File> child : item.getChildren()) {
            File value = child.getValue();
            if (value != null && childPath.equals(normalizedPath(value))) {
                return child;
            }
        }

        return null;
    }

    private TreeItem<File> findItem(TreeItem<File> item, File file) {
        if (item == null || file == null) {
            return null;
        }

        File itemFile = item.getValue();
        if (itemFile != null && samePath(itemFile, file)) {
            return item;
        }

        for (TreeItem<File> child : item.getChildren()) {
            TreeItem<File> found = findItem(child, file);
            if (found != null) {
                return found;
            }
        }

        return null;
    }

    private void expandParents(TreeItem<File> item) {
        TreeItem<File> parent = item.getParent();
        while (parent != null) {
            parent.setExpanded(true);
            parent = parent.getParent();
        }
    }

    private Set<Path> collectExpandedPaths() {
        Set<Path> expanded = new HashSet<>();
        TreeItem<File> root = treeView.getRoot();
        if (root != null) {
            collectExpandedPaths(root, expanded);
        }
        return expanded;
    }

    private void collectExpandedPaths(TreeItem<File> item, Set<Path> expanded) {
        File file = item.getValue();
        if (file != null && item.isExpanded()) {
            expanded.add(normalizedPath(file));
        }

        for (TreeItem<File> child : item.getChildren()) {
            collectExpandedPaths(child, expanded);
        }
    }

    private void restoreExpandedPaths(TreeItem<File> item, Set<Path> expanded) {
        File file = item.getValue();
        if (file != null && expanded.contains(normalizedPath(file))) {
            item.setExpanded(true);
        }

        for (TreeItem<File> child : item.getChildren()) {
            restoreExpandedPaths(child, expanded);
        }
    }

    private boolean isDisclosureClick(EventTarget target) {
        if (!(target instanceof Node node)) {
            return false;
        }

        while (node != null) {
            if (node.getStyleClass().contains("tree-disclosure-node")) {
                return true;
            }
            if (node instanceof TreeCell<?>) {
                return false;
            }
            node = node.getParent();
        }

        return false;
    }

    private boolean samePath(File left, File right) {
        Path leftPath = normalizedPath(left);
        Path rightPath = normalizedPath(right);
        return leftPath != null && leftPath.equals(rightPath);
    }

    private Path normalizedPath(File file) {
        if (file == null) {
            return null;
        }

        try {
            return file.toPath().toRealPath().normalize();
        } catch (IOException | SecurityException e) {
            return file.toPath().toAbsolutePath().normalize();
        }
    }

    private File normalizeFile(File file) {
        if (file == null) {
            return null;
        }

        try {
            return file.getCanonicalFile();
        } catch (IOException | SecurityException e) {
            return file.getAbsoluteFile();
        }
    }
}
