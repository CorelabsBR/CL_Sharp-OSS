package br.com.corelabs.npsharpfx.frontend.ui.terminal;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.function.DoubleConsumer;
import java.util.function.Supplier;
import java.util.function.UnaryOperator;

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
import javafx.scene.control.TextFormatter;
import javafx.scene.control.Tooltip;
import javafx.scene.input.KeyCode;
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
    private DoubleConsumer heightChangeHandler;
    private Supplier<File> workingDirectorySupplier;
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

public void setHeightChangeHandler(DoubleConsumer heightChangeHandler) {
    this.heightChangeHandler = heightChangeHandler;
}

public void setWorkingDirectorySupplier(Supplier<File> workingDirectorySupplier) {
    this.workingDirectorySupplier = workingDirectorySupplier;
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

    Label currentShell = new Label(resolveShellLabel());
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

private static String resolveShellLabel() {
    String os = System.getProperty(
            "os.name",
            ""
    ).toLowerCase(Locale.ROOT);

    if (os.contains("win")) {
        return findWindowsBash() == null ? "cmd" : "bash";
    }

    return "bash";
}

private static File findWindowsBash() {
    String configuredShell = System.getenv("NPSHARP_TERMINAL");
    if (configuredShell != null && !configuredShell.isBlank()) {
        File configured = new File(configuredShell);
        if (configured.isFile()) {
            return configured;
        }
    }

    String path = System.getenv("PATH");
    if (path != null && !path.isBlank()) {
        for (String entry : path.split(java.util.regex.Pattern.quote(File.pathSeparator))) {
            File bash = new File(entry, "bash.exe");
            if (bash.isFile()) {
                return bash;
            }
        }
    }

    List<String> candidates = List.of(
            "C:\\Program Files\\Git\\bin\\bash.exe",
            "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
            "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
            "C:\\Program Files (x86)\\Git\\usr\\bin\\bash.exe"
    );

    for (String candidate : candidates) {
        File bash = new File(candidate);
        if (bash.isFile()) {
            return bash;
        }
    }

    return null;
}

    public void newTerminal() {

        TerminalSession session =
        new TerminalSession(false);
        

        sessions.add(session);

        Tab tab = new Tab(resolveShellLabel());

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

        if (heightChangeHandler != null) {
            heightChangeHandler.accept(newHeight);
        }
    }

    public void decreaseHeight() {

        double newHeight = Math.max(
                currentHeight - 50,
                minHeight
        );

        setPrefHeight(newHeight);

        currentHeight = newHeight;

        if (heightChangeHandler != null) {
            heightChangeHandler.accept(newHeight);
        }
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

    private final TextArea terminalArea = outputArea;

    private final BorderPane view = new BorderPane();

    private Process process;

    private BufferedWriter writer;

    private int commandStart = 0;

    private File currentDirectory =
            resolveInitialDirectory();

    private boolean commandRunning = false;

    private TerminalSession(boolean debugger) {

        this.debugger = debugger;

        outputArea.setEditable(true);

        outputArea.setFocusTraversable(true);

        outputArea.setWrapText(false);

        outputArea.getStyleClass().add("terminal-output");

        view.setCenter(outputArea);

        view.getStyleClass().add("terminal-session");

        Platform.runLater(() -> view.setUserData(this));

        terminalArea.setTextFormatter(new TextFormatter<>(createTerminalEditGuard()));

        terminalArea.setOnKeyPressed(event -> {
            if (commandRunning) {
                event.consume();
                return;
            }

            /*
             * NÃO DEIXA APAGAR O PROMPT
             */
            if (event.getCode() == KeyCode.BACK_SPACE) {

                if (terminalArea.getCaretPosition()
                        <= commandStart) {

                    event.consume();
                }
            }

            /*
             * NÃO DEIXA MOVER PRA ESQUERDA
             */
            if (event.getCode() == KeyCode.LEFT) {

                if (terminalArea.getCaretPosition()
                        <= commandStart) {

                    event.consume();
                }
            }

            /*
             * ENTER
             */
            if (event.getCode() == KeyCode.ENTER) {

                event.consume();

                processCommand();
            }
        });

        /*
         * BLOQUEIA CURSOR ANTES DO PROMPT
         */
        terminalArea.caretPositionProperty()
                .addListener((obs, oldV, newV) -> {

                    if (newV.intValue() < commandStart) {

                        Platform.runLater(() ->
                                terminalArea.positionCaret(
                                        commandStart
                                )
                        );
                    }
                });

    }

    public BorderPane getView() {

        return view;
    }

    public void requestInputFocus() {

        Platform.runLater(terminalArea::requestFocus);
    }

    public void start() {

        appendPrompt();

        /*
         * DEBUG NÃO ABRE SHELL
         */
        if (debugger) {

            appendLine("[NPSharp Debug Console]");

            return;
        }

        // Commands are executed per request so the UI prompt never fights cmd/bash prompts.
    }

    private void processCommand() {
        if (commandRunning) {
            return;
        }

        String fullText =
                terminalArea.getText();

        String command =
                fullText.substring(
                                Math.min(commandStart, fullText.length())
                        )
                        .trim();

        appendRaw(System.lineSeparator());

        /*
         * DEBUG CONSOLE
         */
        if (debugger) {

            inputQueue.offer(command);

            appendPrompt();

            return;
        }

        /*
         * TERMINAL NORMAL
         */
        if (command.isBlank()) {

            appendPrompt();

            return;
        }

        if (isClearCommand(command)) {
            clear();
            return;
        }

        if (isChangeDirectoryCommand(command)) {
            updateCurrentDirectory(command);
            appendPrompt();
            return;
        }

        runCommand(command);
    }

    private UnaryOperator<TextFormatter.Change> createTerminalEditGuard() {
        return change -> {
            if (!change.isContentChange()) {
                return change;
            }

            if (change.getRangeStart() < commandStart) {
                return null;
            }

            return change;
        };
    }

    private void runCommand(String command) {
        commandRunning = true;
        terminalArea.setEditable(false);

        Thread commandThread = new Thread(
                () -> {
                    try {
                        ProcessBuilder pb = new ProcessBuilder(resolveCommand(command));
                        pb.directory(currentDirectory);
                        pb.redirectErrorStream(true);

                        Process commandProcess = pb.start();

                        try (
                                BufferedReader reader =
                                        new BufferedReader(
                                                new InputStreamReader(
                                                        commandProcess.getInputStream(),
                                                        resolveCharset()
                                                )
                                        )
                        ) {
                            String line;
                            while ((line = reader.readLine()) != null) {
                                if (!isWindowsStartupBanner(line)) {
                                    appendLine(line);
                                }
                            }
                        }

                        commandProcess.waitFor();
                    } catch (IOException e) {
                        appendLine("[erro] Falha ao executar comando: " + e.getMessage());
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        appendLine("[erro] Comando interrompido.");
                    } finally {
                        appendPrompt();
                    }
                },
                "terminal-command"
        );

        commandThread.setDaemon(true);
        commandThread.start();
    }

    private List<String> resolveCommand(String command) {
        String os = System.getProperty(
                "os.name",
                ""
        ).toLowerCase(Locale.ROOT);

        if (!os.contains("win")) {
            return List.of("/bin/bash", "-lc", command);
        }

        File bash = findWindowsBash();
        if (bash != null) {
            return List.of(bash.getAbsolutePath(), "-lc", command);
        }

        return List.of("cmd.exe", "/D", "/Q", "/C", normalizeCmdCommand(command));
    }

    private String normalizeCmdCommand(String command) {
        String trimmed = command == null ? "" : command.trim();
        String lower = trimmed.toLowerCase(Locale.ROOT);

        if (lower.equals("pwd")) {
            return "cd";
        }

        if (lower.equals("ls")) {
            return "dir";
        }

        if (lower.startsWith("ls ")) {
            return "dir " + trimmed.substring(3);
        }

        if (lower.equals("clear")) {
            return "cls";
        }

        return command;
    }

    private boolean isChangeDirectoryCommand(String command) {
        String trimmed = command == null ? "" : command.trim().toLowerCase(Locale.ROOT);

        return trimmed.equals("cd")
                || trimmed.equals("cd ~")
                || trimmed.equals("cd..")
                || trimmed.startsWith("cd ")
                || trimmed.startsWith("chdir ");
    }

    private boolean isClearCommand(String command) {
        String trimmed = command == null ? "" : command.trim().toLowerCase(Locale.ROOT);
        return trimmed.equals("clear") || trimmed.equals("cls");
    }

    private void readOutputLoop() {

        try (
                BufferedReader reader =
                        new BufferedReader(
                                new InputStreamReader(
                                        process.getInputStream(),
                                        resolveCharset()
                                )
                        )
        ) {

            String line;

            while ((line = reader.readLine()) != null) {

                if (isWindowsStartupBanner(line)) {
                    continue;
                }

                appendLine(line);
            }

        } catch (IOException e) {

            appendLine(
                    "[erro] Leitura do terminal falhou: "
                            + e.getMessage()
            );
        }
    }

    private boolean isWindowsStartupBanner(String line) {
        String normalized = line == null
                ? ""
                : line.trim().toLowerCase(Locale.ROOT);

        return normalized.startsWith("microsoft windows [version")
                || normalized.startsWith("(c) microsoft corporation. all rights reserved");
    }

    private File resolveInitialDirectory() {
        File directory = workingDirectorySupplier == null
                ? null
                : workingDirectorySupplier.get();

        if (directory != null && directory.isFile()) {
            directory = directory.getParentFile();
        }

        if (directory == null || !directory.isDirectory()) {
            directory = new File(System.getProperty("user.dir"));
        }

        try {
            return directory.getCanonicalFile();
        } catch (IOException ignored) {
            return directory.getAbsoluteFile();
        }
    }

    private void appendPrompt() {

        Platform.runLater(() -> {

            String user =
                    System.getProperty("user.name");

            String host = "npsharp";

            try {
                host = java.net.InetAddress
                        .getLocalHost()
                        .getHostName();
            } catch (Exception ignored) {
            }

            String path = currentDirectory
                    .getAbsolutePath()
                    .replace("\\", "/");

            String home = System.getProperty("user.home")
                    .replace("\\", "/");

            if (path.startsWith(home)) {
                path = "~" + path.substring(home.length());
            }

            /*
            * PROMPT ESTILO LINUX
            *
            * ┌──(kelvin@npsharp)-[~/Projetos]
            * └─$
            */

            String prompt =
                    "┌──("
                    + user
                    + "@"
                    + host
                    + ")-["
                    + path
                    + "]"
                    + System.lineSeparator()
                    + "└─$ ";

            terminalArea.setEditable(true);

            terminalArea.appendText(prompt);

            commandStart =
                    terminalArea.getText().length();

            terminalArea.positionCaret(commandStart);

            commandRunning = false;

            terminalArea.requestFocus();
        });
    }

    private void updateCurrentDirectory(String command) {
        String trimmed = command == null ? "" : command.trim();

        if (trimmed.equals("cd") || trimmed.equals("cd ~")) {
            currentDirectory = new File(System.getProperty("user.home")).getAbsoluteFile();
            return;
        }

        if (trimmed.equals("cd..")) {
            targetParentDirectory();
            return;
        }

        if (!trimmed.startsWith("cd ") && !trimmed.startsWith("chdir ")) {
            return;
        }

        String target = trimmed.startsWith("chdir ")
                ? trimmed.substring(6).trim()
                : trimmed.substring(3).trim();

        if (target.toLowerCase(Locale.ROOT).startsWith("/d ")) {
            target = target.substring(3).trim();
        }

        if (target.isBlank()) {
            return;
        }

        if ((target.startsWith("\"") && target.endsWith("\""))
                || (target.startsWith("'") && target.endsWith("'"))) {
            target = target.substring(1, target.length() - 1);
        }

        File nextDirectory = new File(target);
        if (!nextDirectory.isAbsolute()) {
            nextDirectory = new File(currentDirectory, target);
        }

        try {
            nextDirectory = nextDirectory.getCanonicalFile();
        } catch (IOException ignored) {
            nextDirectory = nextDirectory.getAbsoluteFile();
        }

        if (nextDirectory.isDirectory()) {
            currentDirectory = nextDirectory;
        }
    }

    private void targetParentDirectory() {
        File parent = currentDirectory.getParentFile();
        if (parent != null && parent.isDirectory()) {
            currentDirectory = parent;
        }
    }

    private void appendRaw(String text) {

        Platform.runLater(() -> {

            terminalArea.appendText(text);

            terminalArea.positionCaret(
                    terminalArea.getText().length()
            );
        });
    }

    private void appendLine(String text) {

        Platform.runLater(() -> {

            terminalArea.appendText(
                    text + System.lineSeparator()
            );

            terminalArea.positionCaret(
                    terminalArea.getText().length()
            );
        });
    }

    public void clear() {

        Platform.runLater(() -> {

            terminalArea.clear();

            appendPrompt();
        });
    }

    public void destroy() {

        /*
         * DEBUG NÃO TEM PROCESSO
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

        if (process != null
                && process.isAlive()) {

            process.destroy();
        }
    }

    private static List<String> resolveShellCommand() {

        String os = System.getProperty(
                "os.name",
                ""
        ).toLowerCase(Locale.ROOT);

        if (os.contains("win")) {

            File bash = findWindowsBash();
            if (bash != null) {
                return List.of(
                        bash.getAbsolutePath(),
                        "-i"
                );
            }

            return List.of("cmd.exe", "/Q");
        }

        return List.of("/bin/bash", "-i");
    }

    private static Charset resolveCharset() {

        String os = System.getProperty(
                "os.name",
                ""
        ).toLowerCase(Locale.ROOT);

        if (os.contains("win")) {

            if (findWindowsBash() != null) {
                return StandardCharsets.UTF_8;
            }

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
