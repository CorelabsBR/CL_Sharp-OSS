package br.com.corelabs.npsharpfx.frontend.ui.explorer;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Consumer;
import java.util.function.Supplier;

import br.com.corelabs.npsharpfx.frontend.ui.icons.Codicon;
import br.com.corelabs.npsharpfx.frontend.ui.icons.FileIconManager;
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
import javafx.scene.control.TextInputDialog;
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

public class FileExplorerPane {

    private final VBox view;
    private final TreeView<File> treeView;
    private final VBox emptyState;
    private final HBox toolbar;
    private final StackPane contentHost;
    private final Map<TreeItem<File>, String> compactLabels = new IdentityHashMap<>();
    private final Consumer<File> onFileOpen;
    private final Consumer<File> onFolderOpen;
    private final Stage stage;

    private File currentRootFolder;
    private Supplier<String> menuStyleSupplier;

    public FileExplorerPane(Stage stage, Consumer<File> onFileOpen, Consumer<File> onFolderOpen) {
        this.stage = stage;
        this.onFileOpen = onFileOpen;
        this.onFolderOpen = onFolderOpen;

        this.treeView = new TreeView<>();
        this.treeView.getStyleClass().add("file-tree");
        this.treeView.setShowRoot(true);
        this.treeView.setMinWidth(0);
        this.treeView.setContextMenu(createWorkspaceContextMenu());
        VBox.setVgrow(treeView, Priority.ALWAYS);

        this.treeView.setCellFactory(tv -> new TreeCell<>() {
            @Override
            protected void updateItem(File file, boolean empty) {
                super.updateItem(file, empty);

                if (empty || file == null) {
                    setText(null);
                    setGraphic(null);
                    setContextMenu(null);
                    return;
                }

                TreeItem<File> currentItem = getTreeItem();
                boolean expanded = currentItem != null && currentItem.isExpanded();
                String name = currentItem == null ? null : compactLabels.get(currentItem);
                if (name == null || name.isBlank()) {
                    name = file.getName();
                }
                setText(name == null || name.isBlank() ? file.getAbsolutePath() : name);

                try {
                    setGraphic(FileIconManager.getIcon(file, expanded));
                } catch (Exception e) {
                    setGraphic(null);
                }

                setContextMenu(createContextMenu(file));
            }
        });

        this.treeView.setOnMouseClicked(event -> {
            if (event.getButton() != MouseButton.PRIMARY || event.getClickCount() != 2) {
                return;
            }

            TreeItem<File> selected = treeView.getSelectionModel().getSelectedItem();
            if (selected == null) {
                return;
            }

            File file = selected.getValue();
            if (file != null && file.isFile() && onFileOpen != null) {
                onFileOpen.accept(file);
            }
        });

        this.treeView.setOnKeyPressed(event -> {
            if (event.getCode() == KeyCode.ENTER) {
                openSelectedItem();
                event.consume();
            } else if (event.getCode() == KeyCode.F2) {
                TreeItem<File> selected = treeView.getSelectionModel().getSelectedItem();
                if (selected != null) {
                    promptRename(selected.getValue());
                    event.consume();
                }
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

        currentRootFolder = folder;
        if (onFolderOpen != null) {
            onFolderOpen.accept(folder);
        }

        compactLabels.clear();
        TreeItem<File> rootItem = createNode(folder);
        rootItem.setExpanded(true);
        treeView.setRoot(rootItem);
        treeView.getSelectionModel().clearSelection();
        refreshVisibility();
    }

    public void clearFolder() {
        currentRootFolder = null;
        compactLabels.clear();
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

        compactLabels.clear();
        TreeItem<File> rootItem = createNode(currentRootFolder);
        rootItem.setExpanded(true);
        treeView.setRoot(rootItem);
        restoreExpandedPaths(rootItem, expandedPaths);

        if (selectedFile != null) {
            selectFile(selectedFile);
        }

        refreshVisibility();
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
        newFile.setOnAction(event -> promptCreatePath(baseDir, false));

        MenuItem newFolder = new MenuItem("Nova pasta");
        newFolder.setOnAction(event -> promptCreatePath(baseDir, true));

        MenuItem open = new MenuItem(file.isDirectory() ? "Abrir pasta" : "Abrir arquivo");
        open.setOnAction(event -> {
            if (file.isDirectory()) {
                openFolder(file);
            } else if (onFileOpen != null) {
                onFileOpen.accept(file);
            }
        });

        MenuItem rename = new MenuItem("Renomear");
        rename.setOnAction(event -> promptRename(file));

        MenuItem delete = new MenuItem("Excluir");
        delete.setOnAction(event -> confirmDelete(file));

        MenuItem copyPath = new MenuItem("Copiar caminho");
        copyPath.setOnAction(event -> copyToClipboard(file.getAbsolutePath()));

        MenuItem copyRelativePath = new MenuItem("Copiar caminho relativo");
        copyRelativePath.setOnAction(event -> copyToClipboard(relativePath(file)));

        MenuItem refresh = new MenuItem("Atualizar");
        refresh.setOnAction(event -> refresh());

        menu.getItems().addAll(open, newFile, newFolder, rename, delete, copyPath, copyRelativePath, refresh);
        return menu;
    }

    private ContextMenu createWorkspaceContextMenu() {
        ContextMenu menu = new ContextMenu();
        applyMenuStyle(menu);

        MenuItem newFile = new MenuItem("Novo arquivo");
        newFile.setOnAction(event -> promptCreatePath(currentRootFolder, false));

        MenuItem newFolder = new MenuItem("Nova pasta");
        newFolder.setOnAction(event -> promptCreatePath(currentRootFolder, true));

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

        TextInputDialog dialog = new TextInputDialog();
        dialog.setTitle(folder ? "Nova pasta" : "Novo arquivo");
        dialog.setHeaderText(null);
        dialog.setContentText(folder ? "Caminho da pasta:" : "Caminho do arquivo:");
        dialog.getDialogPane().getStyleClass().add("themed-dialog");
        applyDialogStyle(dialog);

        Optional<String> result = dialog.showAndWait();
        if (result.isEmpty()) {
            return;
        }

        String rawPath = result.get().trim().replace('\\', '/');
        if (rawPath.isBlank()) {
            return;
        }

        try {
            Path root = currentRootFolder.toPath().toRealPath().normalize();
            Path base = baseDir.toPath().toRealPath().normalize();
            Path target = base.resolve(rawPath).normalize();

            if (!base.startsWith(root) || !target.startsWith(root)) {
                showError("Caminho fora do workspace.");
                return;
            }

            if (folder) {
                if (Files.exists(target) && !Files.isDirectory(target)) {
                    showError("Ja existe um arquivo com esse nome.");
                    return;
                }
                Files.createDirectories(target);
            } else {
                Path parent = target.getParent();
                if (parent != null) {
                    Files.createDirectories(parent);
                }
                if (Files.exists(target)) {
                    showError("Ja existe um item com esse nome.");
                    return;
                }
                Files.createFile(target);
            }

            refresh();
            selectFile(target.toFile());

            if (!folder && onFileOpen != null) {
                onFileOpen.accept(target.toFile());
            }
        } catch (IOException | SecurityException e) {
            showError("Nao foi possivel criar: " + e.getMessage());
        }
    }

    private void promptRename(File file) {
        if (file == null || currentRootFolder == null) {
            return;
        }

        TextInputDialog dialog = new TextInputDialog(file.getName());
        dialog.setTitle("Renomear");
        dialog.setHeaderText(null);
        dialog.setContentText("Novo nome:");
        applyDialogStyle(dialog);

        Optional<String> result = dialog.showAndWait();
        if (result.isEmpty()) {
            return;
        }

        String newName = result.get().trim();
        if (newName.isBlank()) {
            return;
        }

        try {
            Path root = currentRootFolder.toPath().toRealPath().normalize();
            Path target = file.toPath().getParent().resolve(newName).normalize();
            if (!target.startsWith(root)) {
                showError("Caminho fora do workspace.");
                return;
            }
            if (Files.exists(target)) {
                showError("Ja existe um item com esse nome.");
                return;
            }

            Files.move(file.toPath(), target);
            refresh();
            selectFile(target.toFile());
        } catch (IOException | SecurityException e) {
            showError("Nao foi possivel renomear: " + e.getMessage());
        }
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
        return createNode(file, false);
    }

    private TreeItem<File> createNode(File file, boolean allowCompactFolders) {
        File displayFile = file;
        String compactLabel = null;

        if (allowCompactFolders && file.isDirectory()) {
            CompactFolder compactFolder = compactFolder(file);
            displayFile = compactFolder.file();
            compactLabel = compactFolder.label();
        }

        TreeItem<File> item = new TreeItem<>(displayFile);
        item.setExpanded(false);
        item.setGraphic(FileIconManager.getIcon(displayFile, false));

        if (compactLabel != null) {
            compactLabels.put(item, compactLabel);
        }

        if (displayFile.isDirectory()) {
            File directory = displayFile;
            item.expandedProperty().addListener((obs, oldVal, expanded) ->
                    item.setGraphic(FileIconManager.getIcon(directory, expanded)));
            item.getChildren().setAll(buildChildren(directory));
        }

        return item;
    }

    @SuppressWarnings("unchecked")
    private TreeItem<File>[] buildChildren(File directory) {
        File[] files = visibleChildren(directory);
        if (files == null) {
            return new TreeItem[0];
        }

        Arrays.sort(files, Comparator
                .comparing(File::isFile)
                .thenComparing(File::getName, String.CASE_INSENSITIVE_ORDER));

        TreeItem<File>[] items = new TreeItem[files.length];
        for (int i = 0; i < files.length; i++) {
            items[i] = createNode(files[i], true);
        }
        return items;
    }

    private CompactFolder compactFolder(File start) {
        StringBuilder label = new StringBuilder(nameOrPath(start));
        File current = start;

        while (true) {
            File[] children = visibleChildren(current);

            if (children == null || children.length != 1 || !children[0].isDirectory()) {
                break;
            }

            current = children[0];
            label.append('/').append(nameOrPath(current));
        }

        return new CompactFolder(current, label.toString());
    }

    private File[] visibleChildren(File directory) {
        return directory.listFiles(file -> !file.isHidden());
    }

    private String nameOrPath(File file) {
        String name = file.getName();
        return name == null || name.isBlank() ? file.getAbsolutePath() : name;
    }

    private record CompactFolder(File file, String label) {
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
        if (found != null) {
            expandParents(found);
            treeView.getSelectionModel().select(found);
            treeView.scrollTo(treeView.getRow(found));
        }
    }

    private TreeItem<File> findItem(TreeItem<File> item, File file) {
        if (item.getValue().equals(file)) {
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
            expanded.add(file.toPath().toAbsolutePath().normalize());
        }

        for (TreeItem<File> child : item.getChildren()) {
            collectExpandedPaths(child, expanded);
        }
    }

    private void restoreExpandedPaths(TreeItem<File> item, Set<Path> expanded) {
        File file = item.getValue();
        if (file != null && expanded.contains(file.toPath().toAbsolutePath().normalize())) {
            item.setExpanded(true);
        }

        for (TreeItem<File> child : item.getChildren()) {
            restoreExpandedPaths(child, expanded);
        }
    }
}
