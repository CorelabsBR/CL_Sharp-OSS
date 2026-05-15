package br.com.corelabs.npsharpfx.frontend.ui.terminal;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import javafx.application.Platform;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Cursor;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.Tab;
import javafx.scene.control.TabPane;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;

public class IntegratedTerminalPane extends BorderPane {

    private final TabPane tabPane = new TabPane();
    private final List<TerminalSession> sessions = new ArrayList<>();

    private final double minHeight = 50;
    private final double maxHeight = Double.MAX_VALUE;

    private double currentHeight = 220;

    public IntegratedTerminalPane() {

        getStyleClass().add("integrated-terminal");

        setPrefHeight(currentHeight);
        setMinHeight(minHeight);
        setMaxHeight(maxHeight);

        HBox header = buildHeader();

        VBox topContainer = new VBox(
                buildResizeHandle(),
                header
        );

        setTop(topContainer);
        setCenter(tabPane);

        newTerminal();
    }

    private HBox buildHeader() {

        Label title = new Label("TERMINAL");
        title.getStyleClass().add("integrated-terminal-title");

        Button newTerminalBtn = new Button("+");
        newTerminalBtn.getStyleClass().add("terminal-control-button");
        newTerminalBtn.setPrefWidth(30);
        newTerminalBtn.setOnAction(e -> newTerminal());

        Tooltip.install(
                newTerminalBtn,
                new Tooltip("Novo Terminal (Ctrl+Shift+`)")
        );

        Button splitTerminalBtn = new Button("⊞");
        splitTerminalBtn.getStyleClass().add("terminal-control-button");
        splitTerminalBtn.setPrefWidth(30);
        splitTerminalBtn.setOnAction(e -> splitTerminal());

        Tooltip.install(
                splitTerminalBtn,
                new Tooltip("Split Terminal")
        );

        Button killTerminalBtn = new Button("✕");
        killTerminalBtn.getStyleClass().add("terminal-control-button");
        killTerminalBtn.setPrefWidth(30);
        killTerminalBtn.setOnAction(e -> killCurrentTerminal());

        Tooltip.install(
                killTerminalBtn,
                new Tooltip("Fechar Terminal")
        );

        Button clearTerminalBtn = new Button("C");
        clearTerminalBtn.getStyleClass().add("terminal-control-button");
        clearTerminalBtn.setPrefWidth(30);
        clearTerminalBtn.setOnAction(e -> clearCurrentTerminal());

        Tooltip.install(
                clearTerminalBtn,
                new Tooltip("Limpar Terminal")
        );

        HBox controls = new HBox(
                5,
                newTerminalBtn,
                splitTerminalBtn,
                killTerminalBtn,
                clearTerminalBtn
        );

        controls.setAlignment(Pos.CENTER_RIGHT);
        controls.setPadding(new Insets(0, 10, 0, 0));

        HBox box = new HBox(title);

        box.getStyleClass().add("integrated-terminal-header");

        box.setAlignment(Pos.CENTER_LEFT);

        box.setPadding(new Insets(6, 10, 6, 10));

        HBox.setHgrow(title, Priority.ALWAYS);

        box.getChildren().add(controls);

        HBox.setHgrow(controls, Priority.NEVER);

        return box;
    }

    private VBox buildResizeHandle() {

        VBox handle = new VBox();

        handle.getStyleClass().add("terminal-resize-handle");

        handle.setPrefHeight(5);

        handle.setCursor(Cursor.V_RESIZE);

        final double[] startY = new double[1];
        final double[] startHeight = new double[1];

        handle.setOnMousePressed(event -> {

            startY[0] = event.getScreenY();

            startHeight[0] = getPrefHeight();
        });

        handle.setOnMouseDragged(event -> {

            double delta = startY[0] - event.getScreenY();

            double newHeight = startHeight[0] + delta;

            newHeight = Math.max(
                    minHeight,
                    Math.min(maxHeight, newHeight)
            );

            setPrefHeight(newHeight);

            currentHeight = newHeight;
        });

        return handle;
    }

    public void newTerminal() {

        TerminalSession session = new TerminalSession();

        sessions.add(session);

        Tab tab = new Tab("powershell");

        tab.setClosable(true);

        tab.setContent(session.getView());

        tab.setOnClosed(e -> {

            session.destroy();

            sessions.remove(session);
        });

        tabPane.getTabs().add(tab);

        tabPane.getSelectionModel().select(tab);

        session.start();

        session.requestInputFocus();
    }

    public void splitTerminal() {

        newTerminal();
    }

    public void killCurrentTerminal() {

        Tab selected = tabPane
                .getSelectionModel()
                .getSelectedItem();

        if (selected == null) {
            return;
        }

        if (selected.getContent() instanceof BorderPane pane) {

            Object sessionObj = pane.getUserData();

            if (sessionObj instanceof TerminalSession session) {

                session.destroy();

                sessions.remove(session);
            }
        }

        tabPane.getTabs().remove(selected);
    }

    public void clearCurrentTerminal() {

        Tab selected = tabPane
                .getSelectionModel()
                .getSelectedItem();

        if (selected == null) {
            return;
        }

        if (selected.getContent() instanceof BorderPane pane) {

            Object sessionObj = pane.getUserData();

            if (sessionObj instanceof TerminalSession session) {

                session.clear();
            }
        }
    }

    public void focusCurrentTerminal() {

        Tab selected = tabPane
                .getSelectionModel()
                .getSelectedItem();

        if (selected == null) {
            return;
        }

        if (selected.getContent() instanceof BorderPane pane) {

            Object sessionObj = pane.getUserData();

            if (sessionObj instanceof TerminalSession session) {

                session.requestInputFocus();
            }
        }
    }

    public boolean hasTerminal() {

        return !tabPane.getTabs().isEmpty();
    }

    public void increaseHeight() {

        double newHeight = Math.min(
                currentHeight + 50,
                maxHeight
        );

        setPrefHeight(newHeight);

        currentHeight = newHeight;
    }

    public void decreaseHeight() {

        double newHeight = Math.max(
                currentHeight - 50,
                minHeight
        );

        setPrefHeight(newHeight);

        currentHeight = newHeight;
    }

    public void appendOutput(String text) {

        Tab selected = tabPane
                .getSelectionModel()
                .getSelectedItem();

        if (selected == null) {
            return;
        }

        if (selected.getContent() instanceof BorderPane pane) {

            Object sessionObj = pane.getUserData();

            if (sessionObj instanceof TerminalSession session) {

                session.append(text);
            }
        }
    }

    private static final class TerminalSession {

        private final TextArea outputArea = new TextArea();

        private final TextField inputField = new TextField();

        private final BorderPane view = new BorderPane();

        private Process process;

        private BufferedWriter writer;

        private TerminalSession() {

            outputArea.setEditable(false);

            outputArea.setWrapText(false);

            outputArea.getStyleClass().add("terminal-output");

            inputField.setPromptText(
                    "Digite um comando e pressione Enter..."
            );

            inputField.getStyleClass().add("terminal-input");

            HBox inputBox = new HBox(inputField);

            inputBox.setPadding(new Insets(8));

            HBox.setHgrow(
                    inputField,
                    Priority.ALWAYS
            );

            view.setCenter(outputArea);

            view.setBottom(inputBox);

            view.getStyleClass().add("terminal-session");

            Platform.runLater(() -> view.setUserData(this));

            inputField.setOnAction(e -> {

                String command = inputField.getText();

                if (command == null
                        || command.isBlank()
                        || writer == null) {

                    return;
                }

                try {

                    writer.write(command);

                    writer.newLine();

                    writer.flush();

                    appendLine("> " + command);

                    inputField.clear();

                } catch (IOException ex) {

                    appendLine(
                            "[erro] Falha ao enviar comando: "
                                    + ex.getMessage()
                    );
                }
            });
        }

        public BorderPane getView() {

            return view;
        }

        public void requestInputFocus() {

            Platform.runLater(inputField::requestFocus);
        }

        public void start() {

            try {

                ProcessBuilder pb = new ProcessBuilder(
                        resolveShellCommand()
                );

                pb.redirectErrorStream(true);

                process = pb.start();

                writer = new BufferedWriter(
                        new OutputStreamWriter(
                                process.getOutputStream(),
                                resolveCharset()
                        )
                );

                Thread readerThread = new Thread(
                        this::readOutputLoop,
                        "terminal-reader"
                );

                readerThread.setDaemon(true);

                readerThread.start();

            } catch (IOException e) {

                appendLine(
                        "[erro] Não foi possível iniciar terminal: "
                                + e.getMessage()
                );
            }
        }

        private void readOutputLoop() {

            try (
                    BufferedReader reader = new BufferedReader(
                            new InputStreamReader(
                                    process.getInputStream(),
                                    resolveCharset()
                            )
                    )
            ) {

                String line;

                while ((line = reader.readLine()) != null) {

                    appendLine(line);
                }

            } catch (IOException e) {

                appendLine(
                        "[erro] Leitura do terminal falhou: "
                                + e.getMessage()
                );
            }
        }

        private void appendLine(String text) {

            Platform.runLater(() -> {

                outputArea.appendText(
                        text + System.lineSeparator()
                );

                outputArea.positionCaret(
                        outputArea.getText().length()
                );
            });
        }

        public void clear() {

            Platform.runLater(outputArea::clear);
        }

        public void destroy() {

            try {

                if (writer != null) {

                    writer.write("exit");

                    writer.newLine();

                    writer.flush();
                }

            } catch (Exception ignored) {
            }

            if (process != null && process.isAlive()) {

                process.destroy();
            }
        }

        private static List<String> resolveShellCommand() {

            String os = System.getProperty(
                    "os.name",
                    ""
            ).toLowerCase(Locale.ROOT);

            if (os.contains("win")) {

                return List.of(
                        "cmd.exe",
                        "/Q"
                );
            }

            return List.of("/bin/bash");
        }

        private static Charset resolveCharset() {

            String os = System.getProperty(
                    "os.name",
                    ""
            ).toLowerCase(Locale.ROOT);

            if (os.contains("win")) {

                try {

                    return Charset.forName("Cp850");

                } catch (Exception ignored) {

                    return StandardCharsets.UTF_8;
                }
            }

            return StandardCharsets.UTF_8;
        }

        public void append(String text) {

            appendLine(text);
        }
    }
}