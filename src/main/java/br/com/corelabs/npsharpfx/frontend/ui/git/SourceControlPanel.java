package br.com.corelabs.npsharpfx.frontend.ui.git;

import java.io.File;
import java.util.List;
import java.util.Optional;
import java.util.function.Consumer;
import java.util.function.Supplier;

import br.com.corelabs.npsharpfx.backend.git.GitCommit;
import br.com.corelabs.npsharpfx.backend.git.GitFileStatus;
import br.com.corelabs.npsharpfx.backend.git.GitOperationResult;
import br.com.corelabs.npsharpfx.backend.git.GitRepositoryStatus;
import br.com.corelabs.npsharpfx.backend.git.GitService;
import br.com.corelabs.npsharpfx.backend.git.GitService.ConflictResolution;
import javafx.application.Platform;
import javafx.animation.KeyFrame;
import javafx.animation.Timeline;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Alert;
import javafx.scene.control.Button;
import javafx.scene.control.ButtonBar;
import javafx.scene.control.ButtonType;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ChoiceDialog;
import javafx.scene.control.Label;
import javafx.scene.control.ListView;
import javafx.scene.control.Separator;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextInputDialog;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.util.Duration;

public class SourceControlPanel extends BorderPane {

    private final GitService gitService;
    private final Supplier<File> workspaceSupplier;
    private final Consumer<String> statusConsumer;
    private final Consumer<String> gitStatusConsumer;
    private final Consumer<String> outputConsumer;

    private final VBox repoBox = new VBox(8);
    private final Label summary = new Label("Abra uma pasta para inspecionar Git.");
    private final TextArea message = new TextArea();
    private final CheckBox allowEmpty = new CheckBox("Permitir commit vazio");
    private List<GitRepositoryStatus> currentStatuses = List.of();
    private boolean refreshRunning;

    public SourceControlPanel(
            GitService gitService,
            Supplier<File> workspaceSupplier,
            Consumer<String> statusConsumer,
            Consumer<String> gitStatusConsumer,
            Consumer<String> outputConsumer) {
        this.gitService = gitService;
        this.workspaceSupplier = workspaceSupplier;
        this.statusConsumer = statusConsumer;
        this.gitStatusConsumer = gitStatusConsumer;
        this.outputConsumer = outputConsumer;
        build();
        Timeline autoRefresh = new Timeline(new KeyFrame(Duration.seconds(5), event -> {
            if (getScene() != null && isVisible()) {
                refresh();
            }
        }));
        autoRefresh.setCycleCount(Timeline.INDEFINITE);
        autoRefresh.play();
    }

    private void build() {
        getStyleClass().add("source-control-panel");
        VBox root = new VBox(8);
        root.setPadding(new Insets(10));
        root.getStyleClass().add("settings-panel");

        summary.setWrapText(true);
        summary.getStyleClass().add("settings-description");

        message.setPromptText("Mensagem de commit");
        message.setPrefRowCount(3);
        message.getStyleClass().add("source-control-message");

        HBox toolbar = new HBox(6,
                button("Refresh", this::refresh),
                button("Stage All", this::stageAll),
                button("Unstage All", this::unstageAll));
        toolbar.setAlignment(Pos.CENTER_LEFT);

        HBox remote = new HBox(6,
                button("Fetch", () -> runOnFirstRepo("fetch")),
                button("Pull", () -> runOnFirstRepo("pull", "--ff-only")),
                button("Push", () -> runOnFirstRepo("push")));
        remote.setAlignment(Pos.CENTER_LEFT);

        Button commit = button("Commit", this::commit);
        commit.setMaxWidth(Double.MAX_VALUE);

        VBox.setVgrow(repoBox, Priority.ALWAYS);
        root.getChildren().addAll(summary, message, allowEmpty, commit, toolbar, remote, new Separator(), repoBox);
        setCenter(root);
        refresh();
    }

    public void refresh() {
        if (refreshRunning) {
            return;
        }
        refreshRunning = true;
        File workspace = workspaceSupplier.get();
        summary.setText("Atualizando Git...");
        repoBox.getChildren().setAll(new Label("Carregando..."));
        gitService.statusAsync(workspace).whenComplete((statuses, error) -> Platform.runLater(() -> {
            if (error != null) {
                refreshRunning = false;
                summary.setText("Falha ao ler Git: " + friendly(error));
                repoBox.getChildren().clear();
                gitStatusConsumer.accept("$(git) erro");
                return;
            }
            currentStatuses = statuses == null ? List.of() : statuses;
            refreshRunning = false;
            render();
        }));
    }

    private void render() {
        repoBox.getChildren().clear();
        if (currentStatuses.isEmpty()) {
            summary.setText("Nenhum repositorio Git detectado no workspace.");
            gitStatusConsumer.accept("$(git) sem repo");
            return;
        }

        int changes = currentStatuses.stream().mapToInt(s -> s.changes().size()).sum();
        GitRepositoryStatus first = currentStatuses.get(0);
        summary.setText(currentStatuses.size() + " repo(s), " + changes + " alteracao(oes)");
        gitStatusConsumer.accept("$(git) " + first.branch()
                + aheadBehind(first)
                + (changes > 0 ? " *" + changes : ""));

        for (GitRepositoryStatus repo : currentStatuses) {
            VBox box = new VBox(5);
            box.getStyleClass().add("source-control-repo");

            HBox head = new HBox(6);
            head.setAlignment(Pos.CENTER_LEFT);
            Label title = new Label(repo.name() + "  " + repo.branch() + aheadBehind(repo));
            title.getStyleClass().add("settings-title");
            Button branch = button("Branch", () -> chooseBranch(repo));
            Button history = button("History", () -> showHistory(repo));
            head.getChildren().addAll(title, spacer(), branch, history);

            box.getChildren().add(head);
            if (repo.changes().isEmpty()) {
                Label clean = new Label("Sem alteracoes");
                clean.getStyleClass().add("settings-description");
                box.getChildren().add(clean);
            } else {
                for (GitFileStatus file : repo.changes()) {
                    box.getChildren().add(fileRow(repo, file));
                }
            }
            repoBox.getChildren().add(box);
        }
    }

    private Node fileRow(GitRepositoryStatus repo, GitFileStatus file) {
        HBox row = new HBox(6);
        row.getStyleClass().add(file.conflicted() ? "source-control-conflict-row" : "source-control-file-row");
        row.setAlignment(Pos.CENTER_LEFT);

        Label state = new Label(shortKind(file));
        state.getStyleClass().add("source-control-badge");
        Label path = new Label(file.path());
        path.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(path, Priority.ALWAYS);

        Button diff = button("Diff", () -> showDiff(repo, file));
        Button stage = button(file.staged() ? "Unstage" : "Stage", () -> run(repo.root(), file.staged() ? gitService.unstage(repo.root(), file) : gitService.stage(repo.root(), file)));
        Button discard = button("Discard", () -> discard(repo, file));
        row.getChildren().addAll(state, path, diff, stage);
        if (file.conflicted()) {
            row.getChildren().add(button("Resolve", () -> resolveConflict(repo, file)));
        }
        row.getChildren().add(discard);
        return row;
    }

    private void commit() {
        GitRepositoryStatus repo = firstRepo();
        if (repo == null) {
            return;
        }
        String text = message.getText() == null ? "" : message.getText().trim();
        if (text.isBlank()) {
            statusConsumer.accept("Informe uma mensagem de commit.");
            return;
        }
        summary.setText("Executando commit...");
        gitService.runAsync(repo.root(), "status", "--short").thenCompose(ignored ->
                java.util.concurrent.CompletableFuture.supplyAsync(() -> gitService.commit(repo.root(), text, allowEmpty.isSelected()))
        ).whenComplete((result, error) -> Platform.runLater(() -> {
            if (error != null) {
                statusConsumer.accept("Commit falhou: " + friendly(error));
            } else {
                statusConsumer.accept(result.firstLine());
                outputConsumer.accept("[git] " + result.output());
                if (result.success()) {
                    message.clear();
                }
            }
            refresh();
        }));
    }

    private void stageAll() {
        GitRepositoryStatus repo = firstRepo();
        if (repo != null) {
            runAsync(repo.root(), "add", "-A");
        }
    }

    private void unstageAll() {
        GitRepositoryStatus repo = firstRepo();
        if (repo != null) {
            runAsync(repo.root(), "restore", "--staged", ".");
        }
    }

    private void runOnFirstRepo(String... args) {
        GitRepositoryStatus repo = firstRepo();
        if (repo != null) {
            runAsync(repo.root(), args);
        }
    }

    private void runAsync(File repo, String... args) {
        summary.setText("Git em andamento...");
        gitService.runAsync(repo, args).whenComplete((result, error) -> Platform.runLater(() -> {
            if (error != null) {
                statusConsumer.accept("Git falhou: " + friendly(error));
            } else {
                statusConsumer.accept(result.firstLine());
                outputConsumer.accept("[git] " + result.output());
            }
            refresh();
        }));
    }

    private void run(File repo, GitOperationResult result) {
        statusConsumer.accept(result.firstLine());
        outputConsumer.accept("[git] " + result.output());
        refresh();
    }

    private void chooseBranch(GitRepositoryStatus repo) {
        ChoiceDialog<String> dialog = new ChoiceDialog<>(repo.branch(), repo.branches());
        dialog.setTitle("Branches");
        dialog.setHeaderText("Trocar branch em " + repo.name());
        dialog.setContentText("Branch local:");
        Optional<String> selected = dialog.showAndWait();
        selected.ifPresent(branch -> {
            if (!branch.equals(repo.branch())) {
                GitOperationResult result = gitService.checkout(repo.root(), branch);
                statusConsumer.accept(result.firstLine());
                refresh();
            }
        });

        TextInputDialog create = new TextInputDialog();
        create.setTitle("Criar branch");
        create.setHeaderText("Criar nova branch a partir da atual");
        create.setContentText("Nome:");
        create.showAndWait().filter(s -> !s.isBlank()).ifPresent(name -> {
            GitOperationResult result = gitService.createBranch(repo.root(), name);
            statusConsumer.accept(result.firstLine());
            refresh();
        });
    }

    private void showHistory(GitRepositoryStatus repo) {
        gitService.historyAsync(repo.root()).whenComplete((commits, error) -> Platform.runLater(() -> {
            ListView<GitCommit> list = new ListView<>();
            list.getItems().setAll(commits);
            list.setCellFactory(view -> new javafx.scene.control.ListCell<>() {
                @Override
                protected void updateItem(GitCommit item, boolean empty) {
                    super.updateItem(item, empty);
                    setText(empty || item == null ? null : item.hash().substring(0, Math.min(8, item.hash().length())) + "  " + item.subject() + "  " + item.author());
                }
            });
            list.setOnMouseClicked(e -> {
                GitCommit commit = list.getSelectionModel().getSelectedItem();
                if (commit != null && e.getClickCount() >= 2) {
                    showText("Commit " + commit.hash(), commit.subject() + "\n\n" + commit.author() + "  " + commit.date() + "\n\n" + commit.body());
                }
            });
            showNode("Historico: " + repo.name(), list);
        }));
    }

    private void showDiff(GitRepositoryStatus repo, GitFileStatus file) {
        gitService.diffAsync(repo.root(), file, file.staged()).whenComplete((diff, error) -> Platform.runLater(() ->
                showText("Diff: " + file.path(), error == null ? diff : friendly(error))));
    }

    private void discard(GitRepositoryStatus repo, GitFileStatus file) {
        Alert alert = new Alert(Alert.AlertType.WARNING);
        alert.setTitle("Descartar alteracoes");
        alert.setHeaderText("Descartar alteracoes em " + file.path() + "?");
        alert.setContentText("Esta acao altera arquivos no disco e nao pode ser desfeita pelo NPSharp.");
        ButtonType discard = new ButtonType("Descartar", ButtonBar.ButtonData.OK_DONE);
        alert.getButtonTypes().setAll(discard, ButtonType.CANCEL);
        if (alert.showAndWait().orElse(ButtonType.CANCEL) == discard) {
            run(repo.root(), gitService.discard(repo.root(), file));
        }
    }

    private void resolveConflict(GitRepositoryStatus repo, GitFileStatus file) {
        ChoiceDialog<String> dialog = new ChoiceDialog<>("Abrir diff manual", "Aceitar atual", "Aceitar recebido", "Aceitar ambos", "Abrir diff manual");
        dialog.setTitle("Resolver conflito");
        dialog.setHeaderText(file.path());
        dialog.setContentText("Escolha a resolucao:");
        dialog.showAndWait().ifPresent(choice -> {
            ConflictResolution resolution = switch (choice) {
                case "Aceitar atual" -> ConflictResolution.CURRENT;
                case "Aceitar recebido" -> ConflictResolution.INCOMING;
                case "Aceitar ambos" -> ConflictResolution.BOTH;
                default -> ConflictResolution.MANUAL;
            };
            if (resolution == ConflictResolution.MANUAL) {
                showDiff(repo, file);
            } else {
                run(repo.root(), gitService.acceptConflict(repo.root(), file, resolution));
            }
        });
    }

    private GitRepositoryStatus firstRepo() {
        if (currentStatuses.isEmpty()) {
            statusConsumer.accept("Nenhum repositorio Git ativo.");
            return null;
        }
        return currentStatuses.get(0);
    }

    private String shortKind(GitFileStatus file) {
        if (file.conflicted()) {
            return "!";
        }
        return switch (file.kind()) {
            case ADDED -> "A";
            case DELETED -> "D";
            case RENAMED -> "R";
            case UNTRACKED -> "U";
            case IGNORED -> "I";
            default -> "M";
        };
    }

    private String aheadBehind(GitRepositoryStatus repo) {
        StringBuilder builder = new StringBuilder();
        if (repo.ahead() > 0) {
            builder.append(" ↑").append(repo.ahead());
        }
        if (repo.behind() > 0) {
            builder.append(" ↓").append(repo.behind());
        }
        return builder.toString();
    }

    private Button button(String text, Runnable action) {
        Button button = new Button(text);
        button.getStyleClass().add("terminal-control-button");
        button.setOnAction(e -> action.run());
        return button;
    }

    private Node spacer() {
        HBox spacer = new HBox();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        return spacer;
    }

    private void showText(String title, String text) {
        TextArea area = new TextArea(text == null || text.isBlank() ? "Sem saida." : text);
        area.setEditable(false);
        area.setWrapText(false);
        area.setPrefSize(860, 520);
        showNode(title, area);
    }

    private void showNode(String title, Node node) {
        Alert alert = new Alert(Alert.AlertType.INFORMATION);
        alert.setTitle(title);
        alert.setHeaderText(title);
        alert.getDialogPane().setContent(node);
        alert.setResizable(true);
        alert.showAndWait();
    }

    private String friendly(Throwable error) {
        Throwable cause = error;
        while (cause.getCause() != null) {
            cause = cause.getCause();
        }
        return cause.getMessage() == null ? "Falha desconhecida." : cause.getMessage();
    }
}
