package br.com.corelabs.npsharpfx.frontend.ui.explorer;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Optional;
import java.util.function.Consumer;

import br.com.corelabs.npsharpfx.frontend.ui.icons.FileIconManager;
import br.com.corelabs.npsharpfx.frontend.ui.icons.Codicon;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Alert;
import javafx.scene.control.Button;
import javafx.scene.control.ButtonType;
import javafx.scene.control.ContextMenu;
import javafx.scene.control.Label;
import javafx.scene.control.MenuItem;
import javafx.scene.control.TextInputDialog;
import javafx.scene.control.TreeCell;
import javafx.scene.control.TreeItem;
import javafx.scene.control.TreeView;
import javafx.scene.input.MouseButton;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;
import javafx.stage.DirectoryChooser;
import javafx.stage.Stage;

public class FileExplorerPane {

    private final VBox view;
    private final TreeView<File> treeView;
    private final VBox emptyState;
    private final StackPane contentHost;
    private final HBox toolbar;

    private final Consumer<File> onFileOpen;
    private final Consumer<File> onFolderOpen;

    private final Stage stage;

    private File currentRootFolder;

    public FileExplorerPane(
            Stage stage,
            Consumer<File> onFileOpen,
            Consumer<File> onFolderOpen
    ) {
        this.stage = stage;
        this.onFileOpen = onFileOpen;
        this.onFolderOpen = onFolderOpen;

        this.treeView = new TreeView<>();
        this.treeView.getStyleClass().add("file-tree");
        this.treeView.setShowRoot(true);

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

                String name = file.getName();

                if (name == null || name.isBlank()) {
                    name = file.getAbsolutePath();
                }

                setText(name);

                try {
                    setGraphic(FileIconManager.getIcon(file, expanded));
                } catch (Exception e) {
                    System.err.println("Cannot load icon for " + name + ": " + e.getMessage());
                    setGraphic(null);
                }

                setContextMenu(createContextMenu(file));
            }
        });

        this.treeView.setOnMouseClicked(event -> {
            if (event.getButton() == MouseButton.PRIMARY && event.getClickCount() == 2) {
                TreeItem<File> selected = treeView.getSelectionModel().getSelectedItem();

                if (selected == null) {
                    return;
                }

                File file = selected.getValue();

                if (file != null && file.isFile() && onFileOpen != null) {
                    onFileOpen.accept(file);
                }
            }
        });

        Button openFolderButton = new Button("Open Folder");
        openFolderButton.getStyleClass().addAll("welcome-action", "button-primary");
        openFolderButton.setOnAction(event -> openFolderFromDialog());

        Label emptyTitle = new Label("Nenhuma pasta aberta");
        emptyTitle.getStyleClass().add("welcome-title");
        emptyTitle.setStyle("-fx-font-size: 18px;");

        Label emptySubtitle = new Label("Abra uma pasta para exibir os arquivos no Explorer.");
        emptySubtitle.getStyleClass().add("welcome-subtitle");
        emptySubtitle.setWrapText(true);
        emptySubtitle.setMaxWidth(220);

        this.emptyState = new VBox(12, emptyTitle, emptySubtitle, openFolderButton);
        this.emptyState.getStyleClass().add("explorer-empty-state");
        this.emptyState.setAlignment(Pos.CENTER);
        this.emptyState.setPadding(new Insets(24));

        this.toolbar = createToolbar();

        this.contentHost = new StackPane(treeView, emptyState);
        this.contentHost.getStyleClass().add("explorer-content-host");

        this.view = new VBox(toolbar, contentHost);
        this.view.getStyleClass().add("explorer-pane");

        VBox.setVgrow(contentHost, Priority.ALWAYS);

        refreshVisibility();
    }

    public Node getView() {
        return view;
    }

    public File getCurrentRootFolder() {
        return currentRootFolder;
    }

    public void openFolderFromDialog() {
        DirectoryChooser chooser = new DirectoryChooser();
        chooser.setTitle("Selecionar pasta");

        if (currentRootFolder != null && currentRootFolder.exists()) {
            chooser.setInitialDirectory(currentRootFolder);
        } else {
            File home = new File(System.getProperty("user.home"));

            if (home.exists()) {
                chooser.setInitialDirectory(home);  
            }
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

        TreeItem<File> rootItem = createNode(folder);
        rootItem.setExpanded(true);

        treeView.setRoot(rootItem);
        treeView.getSelectionModel().clearSelection();

        refreshVisibility();
    }

    public void clearFolder() {
        currentRootFolder = null;
        treeView.setRoot(null);
        refreshVisibility();
    }

    public void refresh() {
        TreeItem<File> selected = treeView.getSelectionModel().getSelectedItem();
        File selectedFile = selected == null ? null : selected.getValue();

        if (currentRootFolder == null) {
            refreshVisibility();
            return;
        }

        TreeItem<File> rootItem = createNode(currentRootFolder);
        rootItem.setExpanded(true);
        treeView.setRoot(rootItem);

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
        if (baseDir == null) {
            baseDir = currentRootFolder;
        }

        promptCreatePath(baseDir, false);
    }

    public void promptCreateFolder() {
        File baseDir = getSelectedDirectory();
        if (baseDir == null) {
            baseDir = currentRootFolder;
        }

        promptCreatePath(baseDir, true);
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

    private HBox createToolbar() {
        Button newFile = createToolbarButton("/icons/codicons/new-file.svg", "Novo arquivo");
        newFile.setOnAction(event -> promptCreateFile());

        Button newFolder = createToolbarButton("/icons/codicons/new-folder.svg", "Nova pasta");
        newFolder.setOnAction(event -> promptCreateFolder());

        Button refresh = createToolbarButton("/icons/codicons/refresh.svg", "Atualizar");
        refresh.setOnAction(event -> refresh());

        Button collapse = createToolbarButton("/icons/codicons/collapse-all.svg", "Recolher tudo");
        collapse.setOnAction(event -> collapseAll());

        HBox box = new HBox(4, newFile, newFolder, refresh, collapse);
        box.getStyleClass().add("explorer-toolbar");
        box.setAlignment(Pos.CENTER_RIGHT);
        box.setPadding(new Insets(6, 8, 4, 8));
        return box;
    }

    private Button createToolbarButton(String iconPath, String tooltipText) {
        Button button = new Button();
        button.getStyleClass().add("explorer-toolbar-button");
        button.setGraphic(Codicon.icon(iconPath));
        button.setMinSize(26, 26);
        button.setPrefSize(26, 26);
        button.setMaxSize(26, 26);
        button.setAccessibleText(tooltipText);
        return button;
    }

    private ContextMenu createContextMenu(File file) {
        ContextMenu menu = new ContextMenu();

        MenuItem newFile = new MenuItem("Novo Arquivo...");
        newFile.setOnAction(event -> promptCreatePath(file != null && file.isDirectory() ? file : getParentDirectory(file), false));

        MenuItem newFolder = new MenuItem("Nova Pasta...");
        newFolder.setOnAction(event -> promptCreatePath(file != null && file.isDirectory() ? file : getParentDirectory(file), true));

        MenuItem rename = new MenuItem("Renomear...");
        rename.setDisable(file == null || file.equals(currentRootFolder));
        rename.setOnAction(event -> promptRename(file));

        MenuItem delete = new MenuItem("Excluir");
        delete.setDisable(file == null || file.equals(currentRootFolder));
        delete.setOnAction(event -> confirmDelete(file));

        MenuItem refresh = new MenuItem("Atualizar");
        refresh.setOnAction(event -> refresh());

        menu.getItems().addAll(newFile, newFolder, rename, delete, refresh);
        return menu;
    }

    private void promptCreatePath(File baseDir, boolean folderOnly) {
        if (currentRootFolder == null || baseDir == null) {
            return;
        }

        TextInputDialog dialog = new TextInputDialog();
        dialog.initOwner(stage);
        dialog.setTitle(folderOnly ? "Nova pasta" : "Novo arquivo");
        dialog.setHeaderText(folderOnly ? "Criar pasta no Explorer" : "Criar arquivo no Explorer");
        dialog.setContentText(folderOnly
                ? "Caminho da pasta:"
                : "Caminho do arquivo:");

        Optional<String> result = dialog.showAndWait();
        result.map(String::trim)
                .filter(value -> !value.isBlank())
                .ifPresent(value -> createPath(baseDir, value, folderOnly));
    }

    private void createPath(File baseDir, String rawPath, boolean folderOnly) {
        try {
            Path base = baseDir.toPath().toAbsolutePath().normalize();
            Path root = currentRootFolder.toPath().toAbsolutePath().normalize();
            String normalizedInput = rawPath.replace('\\', '/');
            boolean explicitFolder = normalizedInput.endsWith("/");
            Path target = base.resolve(normalizedInput).normalize();

            if (!target.startsWith(root)) {
                showError("Caminho fora do workspace.");
                return;
            }

            if (folderOnly || explicitFolder) {
                Files.createDirectories(target);
                refresh();
                selectFile(target.toFile());
                return;
            }

            Path parent = target.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }

            if (!Files.exists(target)) {
                Files.createFile(target);
            }

            refresh();
            selectFile(target.toFile());

            if (onFileOpen != null) {
                onFileOpen.accept(target.toFile());
            }
        } catch (IOException | IllegalArgumentException e) {
            showError("Nao foi possivel criar: " + e.getMessage());
        }
    }

    private void promptRename(File file) {
        if (file == null || file.equals(currentRootFolder)) {
            return;
        }

        TextInputDialog dialog = new TextInputDialog(file.getName());
        dialog.initOwner(stage);
        dialog.setTitle("Renomear");
        dialog.setHeaderText("Renomear item");
        dialog.setContentText("Novo nome:");

        dialog.showAndWait()
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .ifPresent(value -> renameFile(file, value));
    }

    private void renameFile(File file, String newName) {
        try {
            Path source = file.toPath().toAbsolutePath().normalize();
            Path target = source.resolveSibling(newName).normalize();
            Path root = currentRootFolder.toPath().toAbsolutePath().normalize();

            if (!target.startsWith(root)) {
                showError("Caminho fora do workspace.");
                return;
            }

            Files.move(source, target);
            refresh();
            selectFile(target.toFile());
        } catch (IOException | IllegalArgumentException e) {
            showError("Nao foi possivel renomear: " + e.getMessage());
        }
    }

    private void confirmDelete(File file) {
        if (file == null || file.equals(currentRootFolder)) {
            return;
        }

        Alert alert = new Alert(Alert.AlertType.CONFIRMATION);
        alert.initOwner(stage);
        alert.setTitle("Excluir");
        alert.setHeaderText("Excluir " + file.getName() + "?");
        alert.setContentText("Esta acao remove o item do disco.");

        Optional<ButtonType> result = alert.showAndWait();
        if (result.isEmpty() || result.get() != ButtonType.OK) {
            return;
        }

        try {
            Path target = file.toPath().toAbsolutePath().normalize();
            Path root = currentRootFolder.toPath().toAbsolutePath().normalize();

            if (!target.startsWith(root)) {
                showError("Caminho fora do workspace.");
                return;
            }

            if (Files.isDirectory(target)) {
                try (var stream = Files.walk(target)) {
                    stream.sorted(Comparator.reverseOrder())
                            .forEach(path -> {
                                try {
                                    Files.deleteIfExists(path);
                                } catch (IOException ignored) {
                                }
                            });
                }
            } else {
                Files.deleteIfExists(target);
            }

            refresh();
        } catch (IOException | IllegalArgumentException e) {
            showError("Nao foi possivel excluir: " + e.getMessage());
        }
    }

    private File getSelectedDirectory() {
        TreeItem<File> selected = treeView.getSelectionModel().getSelectedItem();
        if (selected == null || selected.getValue() == null) {
            return currentRootFolder;
        }

        File file = selected.getValue();
        return file.isDirectory() ? file : file.getParentFile();
    }

    private File getParentDirectory(File file) {
        if (file == null) {
            return currentRootFolder;
        }

        return file.isDirectory() ? file : file.getParentFile();
    }

    private void collapseChildren(TreeItem<File> item) {
        for (TreeItem<File> child : item.getChildren()) {
            collapseChildren(child);
            child.setExpanded(false);
        }
    }

    private void selectFile(File file) {
        TreeItem<File> item = findItem(treeView.getRoot(), file);
        if (item != null) {
            TreeItem<File> parent = item.getParent();
            while (parent != null) {
                parent.setExpanded(true);
                parent = parent.getParent();
            }
            treeView.getSelectionModel().select(item);
            treeView.scrollTo(treeView.getRow(item));
        }
    }

    private TreeItem<File> findItem(TreeItem<File> item, File file) {
        if (item == null || file == null) {
            return null;
        }

        if (item.getValue() != null && item.getValue().equals(file)) {
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

    private void showError(String message) {
        Alert alert = new Alert(Alert.AlertType.ERROR);
        alert.initOwner(stage);
        alert.setTitle("Explorer");
        alert.setHeaderText("Operacao nao concluida");
        alert.setContentText(message);
        alert.showAndWait();
    }

    private TreeItem<File> createNode(File file) {
        TreeItem<File> item = new TreeItem<>(file);
        item.setExpanded(false);

        if (file.isDirectory()) {
            item.expandedProperty().addListener((obs, oldVal, expanded) -> {
                item.setGraphic(FileIconManager.getIcon(file, expanded));
            });

            item.setGraphic(FileIconManager.getIcon(file, false));
            item.getChildren().setAll(buildChildren(file));
        } else {
            item.setGraphic(FileIconManager.getIcon(file, false));
        }

        return item;
    }

    @SuppressWarnings("unchecked")
    private TreeItem<File>[] buildChildren(File directory) {
        File[] files = directory.listFiles(file -> !file.isHidden());

        if (files == null) {
            return new TreeItem[0];
        }

        Arrays.sort(files, Comparator
                .comparing(File::isFile)
                .thenComparing(File::getName, String.CASE_INSENSITIVE_ORDER));

        TreeItem<File>[] items = new TreeItem[files.length];

        for (int i = 0; i < files.length; i++) {
            items[i] = createNode(files[i]);
        }

        return items;
    }
}
