package br.com.corelabs.npsharpfx.frontend.ui.remote;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

import br.com.corelabs.npsharpfx.backend.filesystem.WorkspaceEntry;
import br.com.corelabs.npsharpfx.backend.remote.RemoteHostConfig;
import br.com.corelabs.npsharpfx.backend.remote.RemoteHostService;
import br.com.corelabs.npsharpfx.backend.remote.RemoteHostStore;
import br.com.corelabs.npsharpfx.backend.remote.RemoteTerminalService;
import javafx.application.Platform;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.control.ListView;
import javafx.scene.control.PasswordField;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.control.TextInputDialog;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;

public class RemoteHostPanel extends VBox {

    private final RemoteHostService service;
    private final RemoteTerminalService terminalService;
    private final RemoteHostStore store = new RemoteHostStore();
    private final Consumer<String> statusConsumer;
    private final RemoteFileOpener fileOpener;
    private final List<RemoteHostConfig> hosts = new ArrayList<>();

    private final ComboBox<RemoteHostConfig> hostPicker = new ComboBox<>();
    private final TextField name = field("Nome");
    private final TextField host = field("Host");
    private final TextField port = field("Porta");
    private final TextField username = field("Usuario");
    private final ComboBox<String> auth = new ComboBox<>();
    private final PasswordField password = new PasswordField();
    private final TextField keyPath = field("Caminho da chave privada");
    private final TextField remotePath = field("Caminho remoto padrao");
    private final Label connection = new Label("Desconectado");
    private final ListView<WorkspaceEntry> files = new ListView<>();
    private final TextField command = field("Comando remoto");
    private final TextArea output = new TextArea();
    private String currentPath = ".";

    public RemoteHostPanel(RemoteHostService service, Consumer<String> statusConsumer, RemoteFileOpener fileOpener) {
        this.service = service;
        this.terminalService = new RemoteTerminalService(service);
        this.statusConsumer = statusConsumer;
        this.fileOpener = fileOpener;
        build();
        loadHosts();
    }

    private void build() {
        getStyleClass().add("settings-panel");
        setPadding(new Insets(10));
        setSpacing(8);

        auth.getItems().setAll("password", "key");
        auth.getSelectionModel().select("password");
        password.setPromptText("Senha (nao salva)");
        password.getStyleClass().add("search-input");
        port.setText("22");
        remotePath.setText(".");

        hostPicker.setMaxWidth(Double.MAX_VALUE);
        hostPicker.setCellFactory(view -> new ListCell<>() {
            @Override
            protected void updateItem(RemoteHostConfig item, boolean empty) {
                super.updateItem(item, empty);
                setText(empty || item == null ? null : item.displayName());
            }
        });
        hostPicker.setButtonCell(hostPicker.getCellFactory().call(null));
        hostPicker.setOnAction(e -> fill(hostPicker.getSelectionModel().getSelectedItem()));

        files.setCellFactory(view -> new ListCell<>() {
            @Override
            protected void updateItem(WorkspaceEntry item, boolean empty) {
                super.updateItem(item, empty);
                setText(empty || item == null ? null : (item.directory() ? "[dir] " : "      ") + item.name());
            }
        });
        files.setOnMouseClicked(e -> {
            WorkspaceEntry entry = files.getSelectionModel().getSelectedItem();
            if (entry == null || e.getClickCount() < 2) {
                return;
            }
            if (entry.directory()) {
                browse(entry.path());
            } else {
                openRemoteFile(entry.path());
            }
        });
        VBox.setVgrow(files, Priority.ALWAYS);

        output.setEditable(false);
        output.setPrefRowCount(5);

        getChildren().addAll(
                label("Hosts"), hostPicker,
                name, host, port, username, auth, password, keyPath, remotePath,
                row(button("Salvar Host", this::saveHost), button("Conectar", this::connect), button("Desconectar", this::disconnect)),
                connection,
                row(button("Subir", this::up), button("Novo Arquivo", this::newFile), button("Nova Pasta", this::newFolder), button("Renomear", this::rename), button("Excluir", this::delete)),
                files,
                command,
                row(button("Executar", this::executeRemote), button("Reconectar", this::connect)),
                output
        );
    }

    private void loadHosts() {
        hosts.clear();
        hosts.addAll(store.load());
        hostPicker.getItems().setAll(hosts);
        if (!hosts.isEmpty()) {
            hostPicker.getSelectionModel().select(0);
            fill(hosts.get(0));
        }
    }

    private void saveHost() {
        RemoteHostConfig config = readForm();
        hosts.removeIf(h -> h.displayName().equals(config.displayName()));
        hosts.add(config);
        try {
            store.save(hosts);
            hostPicker.getItems().setAll(hosts);
            hostPicker.getSelectionModel().select(config);
            statusConsumer.accept("Host remoto salvo: " + config.displayName());
        } catch (Exception e) {
            statusConsumer.accept("Falha ao salvar host: " + e.getMessage());
        }
    }

    private void connect() {
        RemoteHostConfig config = readForm();
        connection.setText("Conectando...");
        service.connectAsync(config, password.getText()).whenComplete((ignored, error) -> Platform.runLater(() -> {
            if (error != null) {
                connection.setText("Erro: " + friendly(error));
                statusConsumer.accept(connection.getText());
                return;
            }
            currentPath = config.getDefaultPath();
            connection.setText("Conectado: " + config.displayName());
            statusConsumer.accept(connection.getText());
            browse(currentPath);
        }));
    }

    private void disconnect() {
        service.disconnect();
        connection.setText("Desconectado");
        files.getItems().clear();
    }

    private void browse(String path) {
        currentPath = path == null || path.isBlank() ? "." : path;
        connection.setText(service.isConnected() ? "Listando " + currentPath : "Desconectado");
        java.util.concurrent.CompletableFuture.supplyAsync(() -> {
            try {
                return service.list(currentPath);
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }).whenComplete((entries, error) -> Platform.runLater(() -> {
            if (error != null) {
                statusConsumer.accept("Falha ao listar remoto: " + friendly(error));
                return;
            }
            files.getItems().setAll(entries);
            connection.setText("Remoto: " + currentPath);
        }));
    }

    private void openRemoteFile(String path) {
        java.util.concurrent.CompletableFuture.supplyAsync(() -> {
            try {
                return service.readText(path);
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }).whenComplete((content, error) -> Platform.runLater(() -> {
            if (error != null) {
                statusConsumer.accept("Falha ao abrir remoto: " + friendly(error));
                return;
            }
            fileOpener.open(path.substring(path.lastIndexOf('/') + 1), "remote://" + path, content, updated -> {
                try {
                    service.writeText(path, updated);
                } catch (Exception e) {
                    throw new IllegalStateException(e);
                }
            });
        }));
    }

    private void executeRemote() {
        String text = command.getText();
        if (text == null || text.isBlank()) {
            return;
        }
        output.appendText("$ " + text + System.lineSeparator());
        terminalService.executeAsync(text).whenComplete((result, error) -> Platform.runLater(() ->
                output.appendText((error == null ? result : friendly(error)) + System.lineSeparator())));
    }

    private void newFile() {
        prompt("Novo arquivo", "Nome:").ifPresent(path -> mutate(() -> service.touch(join(path))));
    }

    private void newFolder() {
        prompt("Nova pasta", "Nome:").ifPresent(path -> mutate(() -> service.mkdir(join(path))));
    }

    private void rename() {
        WorkspaceEntry selected = files.getSelectionModel().getSelectedItem();
        if (selected == null) {
            return;
        }
        prompt("Renomear", "Novo nome:").ifPresent(path -> mutate(() -> service.rename(selected.path(), join(path))));
    }

    private void delete() {
        WorkspaceEntry selected = files.getSelectionModel().getSelectedItem();
        if (selected != null) {
            mutate(() -> service.delete(selected.path()));
        }
    }

    private void up() {
        int idx = currentPath.lastIndexOf('/');
        browse(idx > 0 ? currentPath.substring(0, idx) : ".");
    }

    private void mutate(RemoteMutation mutation) {
        java.util.concurrent.CompletableFuture.runAsync(() -> {
            try {
                mutation.run();
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }).whenComplete((ignored, error) -> Platform.runLater(() -> {
            if (error != null) {
                statusConsumer.accept("Operacao remota falhou: " + friendly(error));
            }
            browse(currentPath);
        }));
    }

    private RemoteHostConfig readForm() {
        RemoteHostConfig config = new RemoteHostConfig();
        config.setName(name.getText());
        config.setHost(host.getText());
        config.setUsername(username.getText());
        try {
            config.setPort(Integer.parseInt(port.getText()));
        } catch (Exception e) {
            config.setPort(22);
        }
        config.setAuthMethod(auth.getValue());
        config.setPrivateKeyPath(keyPath.getText());
        config.setDefaultPath(remotePath.getText());
        return config;
    }

    private void fill(RemoteHostConfig config) {
        if (config == null) {
            return;
        }
        name.setText(config.getName());
        host.setText(config.getHost());
        port.setText(String.valueOf(config.getPort()));
        username.setText(config.getUsername());
        auth.getSelectionModel().select(config.getAuthMethod());
        keyPath.setText(config.getPrivateKeyPath());
        remotePath.setText(config.getDefaultPath());
    }

    private TextField field(String prompt) {
        TextField field = new TextField();
        field.setPromptText(prompt);
        field.getStyleClass().add("search-input");
        return field;
    }

    private Label label(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("settings-title");
        return label;
    }

    private Button button(String text, Runnable action) {
        Button button = new Button(text);
        button.getStyleClass().add("terminal-control-button");
        button.setOnAction(e -> action.run());
        return button;
    }

    private HBox row(Button... buttons) {
        HBox row = new HBox(6, buttons);
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }

    private java.util.Optional<String> prompt(String title, String text) {
        TextInputDialog dialog = new TextInputDialog();
        dialog.setTitle(title);
        dialog.setHeaderText(title);
        dialog.setContentText(text);
        return dialog.showAndWait().filter(s -> !s.isBlank());
    }

    private String join(String name) {
        return currentPath.endsWith("/") ? currentPath + name : currentPath + "/" + name;
    }

    private String friendly(Throwable error) {
        Throwable cause = error;
        while (cause.getCause() != null) {
            cause = cause.getCause();
        }
        return cause.getMessage() == null ? "Falha remota." : cause.getMessage();
    }

    @FunctionalInterface
    private interface RemoteMutation {
        void run() throws Exception;
    }

    @FunctionalInterface
    public interface RemoteFileOpener {
        void open(String displayName, String uri, String content, Consumer<String> saveHandler);
    }
}
