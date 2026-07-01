package br.com.corelabs.npsharpfx.frontend.ui.remote;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.function.Consumer;

import br.com.corelabs.npsharpfx.backend.filesystem.WorkspaceEntry;
import br.com.corelabs.npsharpfx.backend.remote.RemoteHostConfig;
import br.com.corelabs.npsharpfx.backend.remote.RemoteHostService;
import br.com.corelabs.npsharpfx.backend.remote.RemoteHostStore;
import br.com.corelabs.npsharpfx.backend.remote.RemoteTerminalService;
import javafx.concurrent.Task;
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
import javafx.scene.layout.GridPane;
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
        getStyleClass().addAll("settings-panel", "remote-host-panel");
        setPadding(new Insets(0));
        setSpacing(0);

        auth.getItems().setAll("password", "key");
        auth.getSelectionModel().select("password");
        password.setPromptText("Senha (nao salva)");
        password.getStyleClass().add("search-input");
        port.setText("22");
        remotePath.setText(".");
        keyPath.setVisible(false);
        keyPath.setManaged(false);
        auth.setOnAction(e -> updateAuthFields());

        hostPicker.setMaxWidth(Double.MAX_VALUE);
        hostPicker.getStyleClass().add("remote-host-picker");
        hostPicker.setCellFactory(view -> new ListCell<>() {
            @Override
            protected void updateItem(RemoteHostConfig item, boolean empty) {
                super.updateItem(item, empty);
                setText(empty || item == null ? null : item.displayName());
            }
        });
        hostPicker.setButtonCell(hostPicker.getCellFactory().call(null));
        hostPicker.setOnAction(e -> fill(hostPicker.getSelectionModel().getSelectedItem()));
        hostPicker.setOnMouseClicked(e -> {
            if (e.getClickCount() >= 2) {
                connect();
            }
        });

        files.getStyleClass().add("remote-file-list");
        files.setCellFactory(view -> new ListCell<>() {
            @Override
            protected void updateItem(WorkspaceEntry item, boolean empty) {
                super.updateItem(item, empty);
                if (empty || item == null) {
                    setText(null);
                    getStyleClass().removeAll("remote-dir-cell", "remote-file-cell");
                    return;
                }
                setText((item.directory() ? ">  " : "   ") + item.name());
                getStyleClass().removeAll("remote-dir-cell", "remote-file-cell");
                getStyleClass().add(item.directory() ? "remote-dir-cell" : "remote-file-cell");
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
        output.getStyleClass().add("remote-output");
        command.getStyleClass().add("terminal-input");

        getChildren().addAll(
                header(),
                section("Host", hostPicker, form(), row(button("Salvar", this::saveHost), primaryButton("Conectar", this::connect), button("Desconectar", this::disconnect))),
                section("Arquivos", pathBar(), row(button("Subir", this::up), button("Novo Arquivo", this::newFile), button("Nova Pasta", this::newFolder), button("Renomear", this::rename), dangerButton("Excluir", this::delete)), files),
                section("Terminal remoto", command, row(primaryButton("Executar", this::executeRemote), button("Reconectar", this::connect)), output)
        );
    }

    private VBox header() {
        Label title = new Label("Remote Host");
        title.getStyleClass().add("remote-title");
        connection.getStyleClass().add("remote-status");
        connection.setText("Desconectado");
        VBox header = new VBox(4, title, connection);
        header.getStyleClass().add("remote-header");
        return header;
    }

    private VBox section(String title, javafx.scene.Node... nodes) {
        Label label = new Label(title);
        label.getStyleClass().add("remote-section-title");
        VBox box = new VBox(8);
        box.getStyleClass().add("remote-section");
        box.getChildren().add(label);
        box.getChildren().addAll(nodes);
        return box;
    }

    private GridPane form() {
        GridPane grid = new GridPane();
        grid.getStyleClass().add("remote-form");
        grid.setHgap(8);
        grid.setVgap(8);
        addFormRow(grid, 0, "Nome", name);
        addFormRow(grid, 1, "Host", host);
        addFormRow(grid, 2, "Porta", port);
        addFormRow(grid, 3, "Usuario", username);
        addFormRow(grid, 4, "Auth", auth);
        addFormRow(grid, 5, "Senha", password);
        addFormRow(grid, 6, "Chave", keyPath);
        addFormRow(grid, 7, "Path", remotePath);
        return grid;
    }

    private void addFormRow(GridPane grid, int row, String title, javafx.scene.Node field) {
        Label label = new Label(title);
        label.getStyleClass().add("remote-field-label");
        GridPane.setHgrow(field, Priority.ALWAYS);
        grid.add(label, 0, row);
        grid.add(field, 1, row);
    }

    private HBox pathBar() {
        Label path = new Label();
        path.textProperty().bind(connection.textProperty());
        path.getStyleClass().add("remote-path");
        HBox box = new HBox(path);
        box.setAlignment(Pos.CENTER_LEFT);
        return box;
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
        String validation = validate(config);
        if (validation != null) {
            statusConsumer.accept(validation);
            connection.setText(validation);
            return;
        }
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
        String validation = validate(config);
        if (validation != null) {
            connection.setText(validation);
            statusConsumer.accept(validation);
            return;
        }

        runRemoteTask("Conectando...", () -> {
            service.connect(config, password.getText());
            return null;
        }, ignored -> {
            currentPath = config.getDefaultPath();
            connection.setText("Conectado: " + config.displayName());
            statusConsumer.accept(connection.getText());
            browse(currentPath);
        }, error -> {
            connection.setText("Erro: " + friendly(error));
            statusConsumer.accept(connection.getText());
        });
    }

    private void disconnect() {
        service.disconnect();
        connection.setText("Desconectado");
        files.getItems().clear();
    }

    private void browse(String path) {
        currentPath = path == null || path.isBlank() ? "." : path;
        connection.setText(service.isConnected() ? "Listando " + currentPath : "Desconectado");
        String requestedPath = currentPath;
        runRemoteTask(null, () -> service.list(requestedPath), entries -> {
            files.getItems().setAll(entries);
            currentPath = requestedPath;
            connection.setText("Remoto: " + requestedPath);
        }, error -> {
            statusConsumer.accept("Falha ao listar remoto: " + friendly(error));
            connection.setText("Erro ao listar: " + requestedPath);
        });
    }

    private void openRemoteFile(String path) {
        runRemoteTask("Abrindo " + displayName(path) + "...", () -> service.readText(path), content -> {
            fileOpener.open(path.substring(path.lastIndexOf('/') + 1), "remote://" + path, content, updated -> {
                try {
                    service.writeText(path, updated);
                } catch (Exception e) {
                    throw new IllegalStateException(e);
                }
            });
            statusConsumer.accept("Arquivo remoto aberto: " + displayName(path));
        }, error -> statusConsumer.accept("Falha ao abrir remoto: " + friendly(error)));
    }

    private void executeRemote() {
        String text = command.getText();
        if (text == null || text.isBlank()) {
            return;
        }
        if (!service.isConnected()) {
            output.appendText("[remote] Host desconectado." + System.lineSeparator());
            return;
        }
        output.appendText(currentPath + " $ " + text + System.lineSeparator());
        runRemoteTask("Executando comando remoto...", () -> terminalService.execute(text), result ->
                output.appendText((result == null || result.isBlank() ? "[remote] comando concluido" : result) + System.lineSeparator()),
                error -> output.appendText("[remote] " + friendly(error) + System.lineSeparator()));
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
        browse(parentPath(currentPath));
    }

    private void mutate(RemoteMutation mutation) {
        runRemoteTask("Aplicando operacao remota...", () -> {
            mutation.run();
            return null;
        }, ignored -> {
            browse(currentPath);
            statusConsumer.accept("Operacao remota concluida");
        }, error -> {
            statusConsumer.accept("Operacao remota falhou: " + friendly(error));
            browse(currentPath);
        });
    }

    private <T> void runRemoteTask(String busyMessage, Callable<T> operation, Consumer<T> onSuccess, Consumer<Throwable> onError) {
        if (busyMessage != null && !busyMessage.isBlank()) {
            connection.setText(busyMessage);
            statusConsumer.accept(busyMessage);
        }

        Task<T> task = new Task<>() {
            @Override
            protected T call() throws Exception {
                return operation.call();
            }
        };

        task.setOnSucceeded(event -> {
            if (onSuccess != null) {
                onSuccess.accept(task.getValue());
            }
        });
        task.setOnFailed(event -> {
            Throwable error = task.getException();
            if (onError != null) {
                onError.accept(error);
            } else {
                statusConsumer.accept("Operacao remota falhou: " + friendly(error));
            }
        });

        Thread thread = new Thread(task, "npsharp-remote-task");
        thread.setDaemon(true);
        thread.start();
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
        updateAuthFields();
    }

    private void updateAuthFields() {
        boolean keyAuth = "key".equalsIgnoreCase(auth.getValue());
        keyPath.setVisible(keyAuth);
        keyPath.setManaged(keyAuth);
        password.setVisible(!keyAuth);
        password.setManaged(!keyAuth);
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

    private Button primaryButton(String text, Runnable action) {
        Button button = button(text, action);
        button.getStyleClass().add("remote-primary-button");
        return button;
    }

    private Button dangerButton(String text, Runnable action) {
        Button button = button(text, action);
        button.getStyleClass().add("remote-danger-button");
        return button;
    }

    private HBox row(Button... buttons) {
        HBox row = new HBox(6, buttons);
        row.setAlignment(Pos.CENTER_LEFT);
        row.getStyleClass().add("remote-actions");
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
        String cleanName = name == null ? "" : name.trim();
        return currentPath.endsWith("/") ? currentPath + cleanName : currentPath + "/" + cleanName;
    }

    private String displayName(String path) {
        if (path == null || path.isBlank()) {
            return "";
        }
        int index = path.lastIndexOf('/');
        return index >= 0 && index < path.length() - 1 ? path.substring(index + 1) : path;
    }

    private String parentPath(String path) {
        if (path == null || path.isBlank() || ".".equals(path) || "/".equals(path)) {
            return ".";
        }
        String clean = path.endsWith("/") && path.length() > 1 ? path.substring(0, path.length() - 1) : path;
        int idx = clean.lastIndexOf('/');
        if (idx <= 0) {
            return clean.startsWith("/") ? "/" : ".";
        }
        return clean.substring(0, idx);
    }

    private String validate(RemoteHostConfig config) {
        if (config.getHost() == null || config.getHost().isBlank()) {
            return "Informe o host remoto.";
        }
        if (config.getUsername() == null || config.getUsername().isBlank()) {
            return "Informe o usuario remoto.";
        }
        if ("key".equalsIgnoreCase(config.getAuthMethod())
                && (config.getPrivateKeyPath() == null || config.getPrivateKeyPath().isBlank())) {
            return "Informe o caminho da chave privada.";
        }
        return null;
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
