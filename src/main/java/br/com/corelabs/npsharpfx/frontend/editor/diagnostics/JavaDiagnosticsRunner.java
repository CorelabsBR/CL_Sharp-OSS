/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.frontend.editor.diagnostics;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class JavaDiagnosticsRunner {

    public enum BuildStatus {
        IDLE("Idle"),
        COMPILING("Compiling..."),
        OK("Build OK"),
        FAILED("Build Failed");

        private final String label;

        BuildStatus(String label) {
            this.label = label;
        }

        public String label() {
            return label;
        }
    }

    private static final Pattern POSITION_PATTERN = Pattern.compile(
            "^(?:\\[(ERROR|WARNING)\\]\\s*)?(.+?\\.java):\\[(\\d+),(\\d+)\\]\\s*(.*)$"
    );

    private static final Pattern PREFIX_PATTERN = Pattern.compile("^\\[(ERROR|WARNING|INFO)\\]\\s*(.*)$");

    private final DiagnosticsService diagnosticsService;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "np-diagnostics-runner");
        thread.setDaemon(true);
        return thread;
    });
    private final AtomicBoolean compiling = new AtomicBoolean(false);
    private volatile boolean rerunRequested;

    public JavaDiagnosticsRunner(DiagnosticsService diagnosticsService) {
        this.diagnosticsService = diagnosticsService;
    }

    public void compileProject(
            Path projectRoot,
            Consumer<BuildStatus> statusConsumer,
            BiConsumer<Boolean, String> completionConsumer
    ) {
        Path root = normalizeRoot(projectRoot);
        if (root == null) {
            if (statusConsumer != null) {
                statusConsumer.accept(BuildStatus.FAILED);
            }
            if (completionConsumer != null) {
                completionConsumer.accept(false, "pom.xml nao encontrado");
            }
            return;
        }

        if (!compiling.compareAndSet(false, true)) {
            rerunRequested = true;
            if (statusConsumer != null) {
                statusConsumer.accept(BuildStatus.COMPILING);
            }
            return;
        }

        executor.submit(() -> runCompile(root, statusConsumer, completionConsumer));
    }
            // eu costumava escrever o nome dela ao testar uma caneta.
            // hoje, apenas:
            /*
            @@@@@@@@@@@@@@@@@@@@@@       @@@@@@@@@@@@@@@@@@@@@@         @@@@@@@@@@@@@@@@@@@@@@@@
            @@@@@@@@@@@@@@@@@@@@@@@@     @@@@@@@@@@@@@@@@@@@@@@@@       @@@@@@@@@@@@@@@@@@@@@@@@
            @@@@@@@@@@@@@@@@@@@@@@@@@@   @@@@@@@@@@@@@@@@@@@@@@@@@@     @@@@@@@@@@@@@@@@@@@@@@@@
              @@@@@@@@@@     @@@@@@@@@     @@@@@@@@@@     @@@@@@@@@        @@@@@@@@@      @@@@@@
              @@@@@@@@@@     @@@@@@@@@     @@@@@@@@@@     @@@@@@@@@        @@@@@@@@@            
              @@@@@@@@@@     @@@@@@@@@     @@@@@@@@@@     @@@@@@@@@        @@@@@@@@@            
              @@@@@@@@@@@@@@@@@@@@@@@@     @@@@@@@@@@@@@@@@@@@@@@@@        @@@@@@@@@@@@@@@@     
              @@@@@@@@@@@@@@@@@@@@@@       @@@@@@@@@@@@@@@@@@@@@@          @@@@@@@@@@@@@@@@     
              @@@@@@@@@@@@@@@@@@@@         @@@@@@@@@@@@@@@@@@@@            @@@@@@@@@@@@@@@@     
              @@@@@@@@@@                   @@@@@@@@@@ @@@@@@@@@            @@@@@@@@@            
              @@@@@@@@@@                   @@@@@@@@@@   @@@@@@@@           @@@@@@@@@            
              @@@@@@@@@@                   @@@@@@@@@@    @@@@@@@@@         @@@@@@@@@            
            @@@@@@@@@@@@@@               @@@@@@@@@@@@@@ @@@@@@@@@@@@@   @@@@@@@@@@@@@@@         
            @@@@@@@@@@@@@@               @@@@@@@@@@@@@@ @@@@@@@@@@@@@   @@@@@@@@@@@@@@@         
            @@@@@@@@@@@@@@               @@@@@@@@@@@@@@ @@@@@@@@@@@@@   @@@@@@@@@@@@@@@         
*/


    public boolean isCompiling() {
        return compiling.get();
    }

    private void runCompile(
            Path root,
            Consumer<BuildStatus> statusConsumer,
            BiConsumer<Boolean, String> completionConsumer
    ) {
        if (statusConsumer != null) {
            statusConsumer.accept(BuildStatus.COMPILING);
        }

        boolean success = false;
        String output = "";
        try {
            ProcessBuilder builder = new ProcessBuilder(mavenCommand(), "-q", "-DskipTests", "compile");
            builder.directory(root.toFile());
            builder.redirectErrorStream(true);

            Process process = builder.start();
            StringBuilder outputBuilder = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    outputBuilder.append(line).append(System.lineSeparator());
                }
            }

            int exit = process.waitFor();
            success = exit == 0;
            output = outputBuilder.toString();

            if (success) {
                diagnosticsService.clearDiagnosticsUnder(root);
            } else {
                diagnosticsService.setProjectDiagnostics(root, parseDiagnostics(root, output));
            }
        } catch (Exception e) {
            output = e.getMessage() == null ? e.toString() : e.getMessage();
            diagnosticsService.setProjectDiagnostics(root, List.of(new EditorDiagnostic(
                    root.resolve("pom.xml"),
                    1,
                    1,
                    EditorDiagnostic.ERROR,
                    output,
                    "maven"
            )));
        } finally {
            if (statusConsumer != null) {
                statusConsumer.accept(success ? BuildStatus.OK : BuildStatus.FAILED);
            }
            if (completionConsumer != null) {
                completionConsumer.accept(success, firstMeaningfulLine(output));
            }

            compiling.set(false);
            if (rerunRequested) {
                rerunRequested = false;
                compileProject(root, statusConsumer, completionConsumer);
            }
        }
    }

    private List<EditorDiagnostic> parseDiagnostics(Path projectRoot, String output) {
        List<EditorDiagnostic> diagnostics = new ArrayList<>();
        String fallback = "";

        for (String rawLine : output == null ? List.<String>of() : output.lines().toList()) {
            String line = rawLine.strip();
            if (line.isBlank()) {
                continue;
            }

            Matcher matcher = POSITION_PATTERN.matcher(line);
            if (matcher.matches()) {
                String severity = matcher.group(1) == null ? EditorDiagnostic.ERROR : matcher.group(1);
                Path file = Path.of(matcher.group(2)).toAbsolutePath().normalize();
                int lineNumber = parseInt(matcher.group(3), 1);
                int column = parseInt(matcher.group(4), 1);
                String message = matcher.group(5) == null || matcher.group(5).isBlank()
                        ? "Erro de compilacao"
                        : matcher.group(5).strip();

                diagnostics.add(new EditorDiagnostic(
                        file,
                        lineNumber,
                        column,
                        severity,
                        message,
                        "javac"
                ));
                continue;
            }

            Matcher prefixMatcher = PREFIX_PATTERN.matcher(line);
            if (prefixMatcher.matches()) {
                String severity = prefixMatcher.group(1);
                String message = prefixMatcher.group(2);
                if (EditorDiagnostic.WARNING.equals(severity)) {
                    diagnostics.add(new EditorDiagnostic(
                            projectRoot.resolve("pom.xml"),
                            1,
                            1,
                            EditorDiagnostic.WARNING,
                            message == null || message.isBlank() ? line : message.strip(),
                            "maven"
                    ));
                } else if (EditorDiagnostic.ERROR.equals(severity) && fallback.isBlank()) {
                    fallback = message == null || message.isBlank() ? line : message.strip();
                }
            } else if (fallback.isBlank() && line.toLowerCase(Locale.ROOT).contains("error")) {
                fallback = line;
            }
        }

        if (diagnostics.stream().noneMatch(EditorDiagnostic::isError)) {
            diagnostics.add(new EditorDiagnostic(
                    projectRoot.resolve("pom.xml"),
                    1,
                    1,
                    EditorDiagnostic.ERROR,
                    fallback.isBlank() ? "Falha ao compilar projeto" : fallback,
                    "maven"
            ));
        }

        return diagnostics;
    }

    private Path normalizeRoot(Path projectRoot) {
        if (projectRoot == null) {
            return null;
        }

        Path root = projectRoot.toAbsolutePath().normalize();
        if (Files.isRegularFile(root.resolve("pom.xml"))) {
            return root;
        }

        Path current = root;
        while (current != null) {
            if (Files.isRegularFile(current.resolve("pom.xml"))) {
                return current;
            }
            current = current.getParent();
        }

        return null;
    }

    private String mavenCommand() {
        String osName = System.getProperty("os.name", "").toLowerCase(Locale.ROOT);
        return osName.contains("win") ? "mvn.cmd" : "mvn";
    }

    private int parseInt(String text, int fallback) {
        try {
            return Integer.parseInt(text);
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private String firstMeaningfulLine(String output) {
        if (output == null || output.isBlank()) {
            return "";
        }

        return output.lines()
                .map(String::strip)
                .filter(line -> !line.isBlank())
                .findFirst()
                .orElse("");
    }
}
