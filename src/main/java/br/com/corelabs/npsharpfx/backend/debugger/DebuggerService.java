package br.com.corelabs.npsharpfx.backend.debugger;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.Supplier;

import br.com.corelabs.npsharpfx.backend.portugol.runtime.PortugolInterpreter;
import br.com.corelabs.npsharpfx.backend.runtime.DebuggerProcess;
import br.com.corelabs.npsharpfx.backend.runtime.LanguageRuntime;
import br.com.corelabs.npsharpfx.backend.runtime.RuntimePaths;
import br.com.corelabs.npsharpfx.backend.runtime.RuntimeRegistry;
import javafx.application.Platform;

public class DebuggerService {

    private final Map<String, FileDebugger> debuggers = new HashMap<>();
    private final RuntimeRegistry runtimeRegistry = new RuntimeRegistry(RuntimePaths.appDataDir());
    private final DebuggerProcess debuggerProcess = new DebuggerProcess(runtimeRegistry);

    public DebuggerService() {
        reloadRegistry();
        registerDefaults();
    }

    private void registerDefaults() {
        FileDebugger portugolDebugger = (file, output, input) -> {
            try {
                safeOutput(output, "[DEBUG] Runtime Portugol selecionado");

                String source = Files.readString(file);

                PortugolInterpreter interpreter = new PortugolInterpreter();
                interpreter.setInputProvider(input);

                interpreter.executeWithOutput(
                        source,
                        line -> safeOutput(output, "[PORTUGOL] " + line)
                );

                safeOutput(output, "[DEBUG] Execucao finalizada");
            } catch (Exception e) {
                safeOutput(output, "[ERRO] " + e.getMessage());
                e.printStackTrace();
            }
        };

        register(".gol", portugolDebugger);
        register(".por", portugolDebugger);
        register(".portugol", portugolDebugger);
    }

    public void register(String extension, FileDebugger debugger) {
        if (extension == null || debugger == null) {
            return;
        }

        debuggers.put(normalizeExtension(extension), debugger);
    }

    public boolean supports(Path file) {
        if (file == null) {
            return false;
        }

        reloadRegistry();

        if (debuggers.containsKey(getExtension(file))) {
            return true;
        }

        LanguageRuntime language = LanguageRuntime.fromFileName(file.getFileName().toString());
        return language != null && language != LanguageRuntime.GIT && runtimeRegistry.isInstalled(language);
    }

    public void debug(
            Path file,
            Consumer<String> output,
            Supplier<String> input
    ) {
        if (file == null) {
            safeOutput(output, "[ERRO] Arquivo nulo.");
            return;
        }

        String extension = getExtension(file);
        FileDebugger debugger = debuggers.get(extension);
        LanguageRuntime language = LanguageRuntime.fromFileName(file.getFileName().toString());

        if (debugger == null && language == null) {
            safeOutput(output, "[ERRO] Nenhum debugger encontrado para: " + extension);
            return;
        }

        safeOutput(output, "[DEBUG] Arquivo detectado: " + file.getFileName());
        safeOutput(output, "[DEBUG] Extensao detectada: " + extension);
        if (language != null) {
            safeOutput(output, "[DEBUG] Runtime selecionado: " + language.displayName());
        }

        Thread thread = new Thread(
                () -> {
                    if (debugger != null) {
                        debugger.debug(file, output, input);
                    } else {
                        runExternalRuntime(file, language, output);
                    }
                },
                "npsharp-debugger-" + extension
        );

        thread.setDaemon(true);
        thread.start();
    }

    private void runExternalRuntime(Path file, LanguageRuntime language, Consumer<String> output) {
        try {
            reloadRegistry();
            debuggerProcess.runFile(file, new DebuggerProcess.OutputListener() {
                @Override
                public void onLine(String line) {
                    safeOutput(output, "[" + language.displayName().toUpperCase() + "] " + line);
                }

                @Override
                public void onExit(int code) {
                    safeOutput(output, "[DEBUG] Processo finalizado com codigo " + code);
                }
            });
        } catch (Exception e) {
            safeOutput(output, "[ERRO] " + e.getMessage());
        }
    }

    private void reloadRegistry() {
        try {
            runtimeRegistry.load();
        } catch (Exception ignored) {
        }
    }

    private static void safeOutput(Consumer<String> output, String text) {
        if (output == null) {
            return;
        }

        if (Platform.isFxApplicationThread()) {
            output.accept(text);
        } else {
            Platform.runLater(() -> output.accept(text));
        }
    }

    private String getExtension(Path file) {
        String fileName = file.getFileName().toString().toLowerCase();
        int index = fileName.lastIndexOf('.');

        if (index == -1) {
            return "";
        }

        return fileName.substring(index);
    }

    private String normalizeExtension(String extension) {
        extension = extension.toLowerCase();

        if (!extension.startsWith(".")) {
            extension = "." + extension;
        }

        return extension;
    }

    public interface FileDebugger {
        void debug(
                Path file,
                Consumer<String> output,
                Supplier<String> input
        );
    }
}
