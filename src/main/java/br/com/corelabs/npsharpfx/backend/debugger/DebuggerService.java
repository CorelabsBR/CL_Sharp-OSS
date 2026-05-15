package br.com.corelabs.npsharpfx.backend.debugger;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.Supplier;

import br.com.corelabs.npsharpfx.backend.portugol.runtime.PortugolInterpreter;
import javafx.application.Platform;

public class DebuggerService {

    private final Map<String, FileDebugger> debuggers = new HashMap<>();

    public DebuggerService() {
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

                safeOutput(output, "[DEBUG] Execução finalizada");

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
        return debuggers.containsKey(getExtension(file));
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

        if (debugger == null) {
            safeOutput(output, "[ERRO] Nenhum debugger encontrado para: " + extension);
            return;
        }

        safeOutput(output, "[DEBUG] Arquivo detectado: " + file.getFileName());
        safeOutput(output, "[DEBUG] Extensão detectada: " + extension);

        Thread thread = new Thread(
                () -> debugger.debug(file, output, input),
                "npsharp-debugger-" + extension
        );

        thread.setDaemon(true);
        thread.start();
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