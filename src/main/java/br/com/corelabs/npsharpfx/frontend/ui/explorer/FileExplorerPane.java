package br.com.corelabs.npsharpfx.frontend.ui.explorer;

import java.io.File;
import java.util.Arrays;
import java.util.Comparator;
import java.util.function.Consumer;

import br.com.corelabs.npsharpfx.frontend.ui.icons.FileIconManager;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TreeCell;
import javafx.scene.control.TreeItem;
import javafx.scene.control.TreeView;
import javafx.scene.input.MouseButton;
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

        this.contentHost = new StackPane(treeView, emptyState);
        this.contentHost.getStyleClass().add("explorer-content-host");

        this.view = new VBox(contentHost);
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

    private void refreshVisibility() {
        boolean hasFolder = currentRootFolder != null && treeView.getRoot() != null;

        treeView.setVisible(hasFolder);
        treeView.setManaged(hasFolder);

        emptyState.setVisible(!hasFolder);
        emptyState.setManaged(!hasFolder);
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