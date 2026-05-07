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

/*
========================================================
FILE EXPLORER PANE
Painel do explorador de arquivos da aplicaÃ§Ã£o
========================================================

Responsabilidades:

- Exibir estrutura de arquivos e pastas
- Permitir abrir uma pasta raiz
- Mostrar estado vazio quando nenhuma pasta estÃ¡ aberta
- Permitir abrir arquivo com duplo clique
- Mostrar Ã­cones apropriados para arquivo/pasta
- Atualizar Ã­cone da pasta quando expandida/recolhida

Estrutura visual:

FileExplorerPane
 â”œ contentHost (StackPane)
 â”‚   â”œ treeView    -> Ã¡rvore de arquivos
 â”‚   â”” emptyState  -> tela vazia
 â”” view (VBox)     -> container externo

Fluxo:

- usuÃ¡rio abre uma pasta
- Ã¡rvore Ã© montada recursivamente
- usuÃ¡rio dÃ¡ duplo clique em arquivo
- callback onFileOpen Ã© executado
========================================================
*/

public class FileExplorerPane {

    /* =========================================
       VIEW PRINCIPAL DO PAINEL
    ========================================= */

    private final VBox view;

    /* =========================================
       ÃRVORE DE ARQUIVOS
    ========================================= */

    private final TreeView<File> treeView;

    /* =========================================
       ESTADO VAZIO
       Exibido quando nenhuma pasta estÃ¡ aberta
    ========================================= */

    private final VBox emptyState;

    /* =========================================
       HOST QUE ALTERNARÃ ENTRE:
       - treeView
       - emptyState
    ========================================= */

    private final StackPane contentHost;

    /* =========================================
       CALLBACK PARA ABRIR ARQUIVO
       Recebe um File quando usuÃ¡rio dÃ¡ duplo clique
    ========================================= */

    @SuppressWarnings("unused")
    private final Consumer<File> onFileOpen;

    /* =========================================
       REFERÃŠNCIA DA JANELA
       NecessÃ¡ria para DirectoryChooser
    ========================================= */

    private final Stage stage;

    /* =========================================
       PASTA RAIZ ATUAL ABERTA NO EXPLORER
    ========================================= */

    private File currentRootFolder;

    /* =========================================
       CONSTRUTOR
    ========================================= */

    public FileExplorerPane(Stage stage, Consumer<File> onFileOpen) {
        this.stage = stage;
        this.onFileOpen = onFileOpen;

        /* -----------------------------------------
           CRIA TREEVIEW
        ----------------------------------------- */

        this.treeView = new TreeView<>();
        this.treeView.getStyleClass().add("file-tree");
        this.treeView.setShowRoot(true);

        /* -----------------------------------------
           DEFINE COMO CADA ITEM DA ÃRVORE SERÃ
           DESENHADO
        ----------------------------------------- */

        this.treeView.setCellFactory(tv -> new TreeCell<>() {
            @Override
            protected void updateItem(File file, boolean empty) {
                super.updateItem(file, empty);

                // se item estiver vazio, limpa conteÃºdo visual
                if (empty || file == null) {
                    setText(null);
                    setGraphic(null);
                    return;
                }

                TreeItem<File> currentItem = getTreeItem();
                boolean expanded = currentItem != null && currentItem.isExpanded();

                // nome visÃ­vel do arquivo/pasta
                String name = file.getName();
                if (name == null || name.isBlank()) {
                    name = file.getAbsolutePath();
                }

                setText(name);

                // Ã­cone vindo do FileIconManager
                try {
                    setGraphic(FileIconManager.getIcon(file, expanded));
                } catch (Exception e) {
                    // Se houver erro ao carregar o Ã­cone, registra mas deixa o arquivo visÃ­vel
                    System.err.println("Cannot load icon for " + name + ": " + e.getMessage());
                    setGraphic(null); // Remove grÃ¡fico e apenas mostra texto
                }
            }
        });

        /* -----------------------------------------
           ABRIR ARQUIVO COM DUPLO CLIQUE
        ----------------------------------------- */

        this.treeView.setOnMouseClicked(event -> {
            if (event.getButton() == MouseButton.PRIMARY && event.getClickCount() == 2) {
                TreeItem<File> selected = treeView.getSelectionModel().getSelectedItem();

                if (selected != null) {
                    File file = selected.getValue();

                    // sÃ³ abre se for arquivo, nÃ£o pasta
                    if (file != null && file.isFile()) {
                        onFileOpen.accept(file);
                    }
                }
            }
        });

        /* -----------------------------------------
           BOTÃƒO PARA ABRIR PASTA
           Mostrado no estado vazio
        ----------------------------------------- */

        Button openFolderButton = new Button("Open Folder");
        openFolderButton.getStyleClass().addAll("welcome-action", "button-primary");
        openFolderButton.setOnAction(event -> openFolderFromDialog());

        /* -----------------------------------------
           TÃTULO DO ESTADO VAZIO
        ----------------------------------------- */

        Label emptyTitle = new Label("Nenhuma pasta aberta");
        emptyTitle.getStyleClass().add("welcome-title");
        emptyTitle.setStyle("-fx-font-size: 18px;");

        /* -----------------------------------------
           SUBTÃTULO DO ESTADO VAZIO
        ----------------------------------------- */

        Label emptySubtitle = new Label("Abra uma pasta para exibir os arquivos no Explorer.");
        emptySubtitle.getStyleClass().add("welcome-subtitle");
        emptySubtitle.setWrapText(true);
        emptySubtitle.setMaxWidth(220);

        /* -----------------------------------------
           CONTAINER DO ESTADO VAZIO
        ----------------------------------------- */

        this.emptyState = new VBox(12, emptyTitle, emptySubtitle, openFolderButton);
        this.emptyState.getStyleClass().add("explorer-empty-state");
        this.emptyState.setAlignment(Pos.CENTER);
        this.emptyState.setPadding(new Insets(24));

        /* -----------------------------------------
           HOST CENTRAL
           Ele contÃ©m os dois:
           - Ã¡rvore
           - estado vazio
        ----------------------------------------- */

        this.contentHost = new StackPane(treeView, emptyState);
        this.contentHost.getStyleClass().add("explorer-content-host");

        /* -----------------------------------------
           VIEW FINAL DO EXPLORER
        ----------------------------------------- */

        this.view = new VBox(contentHost);
        this.view.getStyleClass().add("explorer-pane");

        VBox.setVgrow(contentHost, Priority.ALWAYS);

        // define visibilidade inicial
        refreshVisibility();
    }

    /* =========================================
       RETORNA A VIEW PRINCIPAL DO PAINEL
    ========================================= */

    public Node getView() {
        return view;
    }

    /* =========================================
       RETORNA A PASTA RAIZ ATUAL
    ========================================= */

    public File getCurrentRootFolder() {
        return currentRootFolder;
    }

    /* =========================================
       ABRE DIÃLOGO PARA ESCOLHER PASTA
    ========================================= */

    public void openFolderFromDialog() {
        DirectoryChooser chooser = new DirectoryChooser();
        chooser.setTitle("Selecionar pasta");

        // se jÃ¡ houver pasta aberta, comeÃ§a nela
        if (currentRootFolder != null && currentRootFolder.exists()) {
            chooser.setInitialDirectory(currentRootFolder);
        } else {
            // senÃ£o tenta abrir na home do usuÃ¡rio
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

    /* =========================================
       ABRE UMA PASTA NO EXPLORER
       Monta toda a Ã¡rvore a partir dela
    ========================================= */

    public void openFolder(File folder) {
        if (folder == null || !folder.exists() || !folder.isDirectory()) {
            return;
        }

        currentRootFolder = folder;

        // cria nÃ³ raiz da Ã¡rvore
        TreeItem<File> rootItem = createNode(folder);
        rootItem.setExpanded(true);

        treeView.setRoot(rootItem);
        treeView.getSelectionModel().clearSelection();

        refreshVisibility();
    }

    /* =========================================
       LIMPA A PASTA ATUAL
       Volta ao estado vazio
    ========================================= */

    public void clearFolder() {
        currentRootFolder = null;
        treeView.setRoot(null);
        refreshVisibility();
    }

    /* =========================================
       ATUALIZA VISIBILIDADE ENTRE:
       - Ã¡rvore
       - estado vazio
    ========================================= */

    private void refreshVisibility() {
        boolean hasFolder = currentRootFolder != null && treeView.getRoot() != null;

        treeView.setVisible(hasFolder);
        treeView.setManaged(hasFolder);

        emptyState.setVisible(!hasFolder);
        emptyState.setManaged(!hasFolder);
    }

    /* =========================================
       CRIA UM NÃ“ DA ÃRVORE PARA ARQUIVO/PASTA
       Se for pasta, cria tambÃ©m seus filhos
    ========================================= */

    private TreeItem<File> createNode(File file) {
        TreeItem<File> item = new TreeItem<>(file);
        item.setExpanded(false);

        if (file.isDirectory()) {

            // quando expandir/recolher, troca Ã­cone da pasta
            item.expandedProperty().addListener((obs, oldVal, expanded) -> {
                item.setGraphic(FileIconManager.getIcon(file, expanded));
            });

            // Ã­cone inicial de pasta fechada
            item.setGraphic(FileIconManager.getIcon(file, false));

            // adiciona filhos
            item.getChildren().setAll(buildChildren(file));

        } else {
            // Ã­cone de arquivo comum
            item.setGraphic(FileIconManager.getIcon(file, false));
        }

        return item;
    }

    /* =========================================
       MONTA FILHOS DE UM DIRETÃ“RIO
       - ignora ocultos
       - ordena pastas antes de arquivos
       - ordena alfabeticamente
    ========================================= */

    @SuppressWarnings("unchecked")
    private TreeItem<File>[] buildChildren(File directory) {

        File[] files = directory.listFiles(file -> !file.isHidden());

        if (files == null) {
            return new TreeItem[0];
        }

        /* -----------------------------------------
           ORDENAÃ‡ÃƒO:
           1) pastas primeiro
           2) depois arquivos
           3) nome em ordem alfabÃ©tica
        ----------------------------------------- */

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

