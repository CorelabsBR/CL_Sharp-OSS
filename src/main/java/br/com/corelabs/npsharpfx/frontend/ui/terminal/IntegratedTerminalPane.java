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
    private final double maxHeight = 600;

    private double currentHeight = 220;
    private boolean resizing = false;
    private java.util.function.Consumer<String> inputListener;
    private final BorderPane debugConsolePane = new BorderPane();
private final TextArea debugOutputArea = new TextArea();
private final TextField debugInputField = new TextField();

    private final java.util.concurrent.BlockingQueue<String> inputQueue =
        new java.util.concurrent.LinkedBlockingQueue<>();

    public IntegratedTerminalPane() {

        getStyleClass().add("integrated-terminal");

        setPrefHeight(currentHeight);
        setMinHeight(minHeight);
        setMaxHeight(maxHeight);
        setMinSize(0, 0);
        setMaxSize(Double.MAX_VALUE, Double.MAX_VALUE);
        tabPane.setMinSize(0, 0);
        HBox header = buildHeader();

        VBox topContainer = new VBox(
                header
        );

        setTop(topContainer);
        setCenter(tabPane);
        setupDebugConsole();
        setCenter(tabPane);
    }

    public String waitInput() {
    try {
        return inputQueue.take();
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        return "";
    }
}

private void setupDebugConsole() {
    debugOutputArea.setEditable(false);
    debugOutputArea.getStyleClass().add("terminal-output");

    debugInputField.setPromptText("Entrada do programa...");
    debugInputField.getStyleClass().add("terminal-input");

    debugInputField.setOnAction(e -> {
        String text = debugInputField.getText();

        if (text == null) {
            return;
        }

        debugOutputArea.appendText("> " + text + System.lineSeparator());
        debugOutputArea.positionCaret(debugOutputArea.getText().length());

        inputQueue.offer(text);

        debugInputField.clear();
    });

    HBox inputBox = new HBox(debugInputField);
    inputBox.setPadding(new Insets(8));
    HBox.setHgrow(debugInputField, Priority.ALWAYS);

    debugConsolePane.setCenter(debugOutputArea);
    debugConsolePane.setBottom(inputBox);
}

public void showDebugConsolePanel() {
    setCenter(debugConsolePane);
    debugInputField.requestFocus();
}

public void showTerminalPanel() {
    setCenter(tabPane);

    if (!hasTerminal()) {
        newTerminal();
    }

    focusCurrentTerminal();
}

public void clearDebugConsole() {
    debugOutputArea.clear();
    inputQueue.clear();
}

public void appendDebugOutput(String text) {
    Platform.runLater(() -> {
        debugOutputArea.appendText(text + System.lineSeparator());
        debugOutputArea.positionCaret(debugOutputArea.getText().length());
    });
}

    private HBox buildHeader() {
    Label problems = createPanelTab("PROBLEMS");
    Label output = createPanelTab("OUTPUT");
    Label debugConsole = createPanelTab("DEBUG CONSOLE");
    Label terminal = createPanelTab("TERMINAL");
    Label ports = createPanelTab("PORTS");
    Label gitlens = createPanelTab("GIT");

    terminal.getStyleClass().add("integrated-terminal-tab-active");

    problems.setOnMouseClicked(e -> {
        showTerminalPanel();
        appendOutput("[Problems] Nenhum problema registrado nesta sessao.");
    });
    output.setOnMouseClicked(e -> {
        showTerminalPanel();
        appendOutput("[Output] Canal de saida ativo.");
    });
debugConsole.setOnMouseClicked(e -> showDebugConsolePanel());
terminal.setOnMouseClicked(e -> showTerminalPanel());
    ports.setOnMouseClicked(e -> {
        showTerminalPanel();
        appendOutput("[Ports] Nenhuma porta encaminhada.");
    });
    gitlens.setOnMouseClicked(e -> {
        showTerminalPanel();
        appendOutput("[Git] Use o painel Source Control para branch, stage e commit.");
    });

    Label currentShell = new Label("powershell");
    currentShell.getStyleClass().add("integrated-terminal-shell-label");

    Button newTerminalBtn = createHeaderButton("+", "Novo Terminal");
    newTerminalBtn.setOnAction(e -> newTerminal());

    Button dropdownBtn = createHeaderButton("v", "Selecionar Terminal");
    dropdownBtn.setOnAction(e -> showTerminalPanel());

    Button splitTerminalBtn = createHeaderButton("|", "Dividir Terminal");
    splitTerminalBtn.setOnAction(e -> splitTerminal());

    Button killTerminalBtn = createHeaderButton("x", "Fechar Terminal");
    killTerminalBtn.setOnAction(e -> killCurrentTerminal());

    Button moreBtn = createHeaderButton("...", "Mais acoes");
    moreBtn.setOnAction(e -> appendOutput("[Terminal] AÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes: novo, dividir, limpar ou fechar terminal."));

    Button maximizeBtn = createHeaderButton("^", "Maximizar painel");
    maximizeBtn.setOnAction(e -> increaseHeight());

    Button closePanelBtn = createHeaderButton("x", "Fechar painel");
    closePanelBtn.setOnAction(e -> {
        setManaged(false);
        setVisible(false);
    });

    HBox tabs = new HBox(
            22,
            problems,
            output,
            debugConsole,
            terminal,
            ports,
            gitlens
    );
    tabs.setAlignment(Pos.CENTER_LEFT);

    HBox controls = new HBox(
            8,
            currentShell,
            newTerminalBtn,
            dropdownBtn,
            splitTerminalBtn,
            killTerminalBtn,
            moreBtn,
            maximizeBtn,
            closePanelBtn
    );
    controls.setAlignment(Pos.CENTER_RIGHT);

    HBox spacer = new HBox();
    HBox.setHgrow(spacer, Priority.ALWAYS);

    HBox box = new HBox(
            tabs,
            spacer,
            controls
    );

    box.getStyleClass().add("integrated-terminal-header");
    box.setAlignment(Pos.CENTER_LEFT);
    box.setPadding(new Insets(6, 10, 6, 10));

    return box;
}

private Label createPanelTab(String text) {
    Label label = new Label(text);
    label.getStyleClass().add("integrated-terminal-tab");
    return label;
}

private Button createHeaderButton(String text, String tooltip) {
    Button button = new Button(text);
    button.getStyleClass().add("terminal-control-button");
    button.setMinWidth(26);
    button.setPrefWidth(30);

    Tooltip.install(button, new Tooltip(tooltip));

    return button;
}

    public void newTerminal() {

        TerminalSession session =
        new TerminalSession(false);
        

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


   public void newDebuggerConsole() {
    inputQueue.clear();

    for (Tab tab : tabPane.getTabs()) {
        if (tab.getContent() instanceof BorderPane pane) {
            Object obj = pane.getUserData();

            if (obj instanceof TerminalSession session && session.isDebugger()) {
                tabPane.getSelectionModel().select(tab);
                session.clear();
                session.requestInputFocus();
                session.append("[NPSharp Debug Console]");
                return;
            }
        }
    }

    TerminalSession session = new TerminalSession(true);
    sessions.add(session);

    Tab tab = new Tab("debug");
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

   private final class TerminalSession {

    private final boolean debugger;

    public boolean isDebugger() {
    return debugger;
}

    private final TextArea outputArea = new TextArea();

    private final TextField inputField = new TextField();

    private final BorderPane view = new BorderPane();

    private Process process;

    private BufferedWriter writer;

    private TerminalSession(boolean debugger) {

        this.debugger = debugger;

        outputArea.setEditable(false);

        outputArea.setWrapText(false);

        outputArea.getStyleClass().add("terminal-output");

        inputField.setPromptText(
                debugger
                        ? "Entrada do programa..."
                        : "Digite um comando e pressione Enter..."
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

            if (command == null) {
                return;
            }

            appendLine("> " + command);

            inputField.clear();

            /*
             * DEBUG CONSOLE
             */
            if (debugger) {

                inputQueue.offer(command);

                return;
            }

            /*
             * TERMINAL NORMAL
             */
            if (command.isBlank() || writer == null) {
                return;
            }

            try {

                writer.write(command);

                writer.newLine();

                writer.flush();

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

        /*
         * DEBUG NÃƒÆ’Ã†â€™O ABRE CMD
         */
        if (debugger) {

            appendLine("[NPSharp Debug Console]");

            return;
        }

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
                    "[erro] Nao foi possivel iniciar terminal: "
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

        /*
         * DEBUG NÃƒÆ’Ã†â€™O TEM PROCESSO
         */
        if (debugger) {
            return;
        }

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
