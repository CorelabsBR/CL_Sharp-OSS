package br.com.corelabs.npsharpfx.backend.debugger;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Consumer;

import br.com.corelabs.npsharpfx.backend.portugol.runtime.PortugolInterpreter;

public class DebuggerService {

    private final Map<String, FileDebugger> debuggers = new HashMap<>();

    public DebuggerService() {
        registerDefaults();
    }

    private void registerDefaults() {

        /*
         * Portugol
         */
        register(".gol", new FileDebugger() {
            @Override
            public void debug(
    Path file,
    Consumer<String> output,
    java.util.function.Supplier<String> input
) {
                try {
                    output.accept("[DEBUG] Runtime Portugol selecionado");

                    String source = Files.readString(file);

                    PortugolInterpreter interpreter =
                            new PortugolInterpreter();
                            interpreter.setInputProvider(input);

                    interpreter.executeWithOutput(
                            source,
                            line -> output.accept("[PORTUGOL] " + line)
                    );

                    output.accept("[DEBUG] Execução finalizada");

                } catch (Exception e) {
                    output.accept("[ERRO] " + e.getMessage());
                    e.printStackTrace();
                }
            }
        });

        register(".por", debuggers.get(".gol"));
        register(".portugol", debuggers.get(".gol"));
    }

    public void register(String extension, FileDebugger debugger) {

        if (extension == null || debugger == null) {
            return;
        }

        debuggers.put(
                normalizeExtension(extension),
                debugger
        );
    }

    public boolean supports(Path file) {

        String extension = getExtension(file);

        return debuggers.containsKey(extension);
    }
    
    

    public void debug(
        Path file,
        Consumer<String> output,
        java.util.function.Supplier<String> input
) {

    if (file == null) {
        output.accept("[ERRO] Arquivo nulo.");
        return;
    }

    String extension = getExtension(file);

    FileDebugger debugger = debuggers.get(extension);

    if (debugger == null) {
        output.accept("[ERRO] Nenhum debugger encontrado para: " + extension);
        return;
    }

    output.accept("[DEBUG] Arquivo detectado: " + file.getFileName());
    output.accept("[DEBUG] Extensão detectada: " + extension);

    debugger.debug(file, output, input);
}

    private String getExtension(Path file) {

        String fileName =
                file.getFileName()
                        .toString()
                        .toLowerCase();

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
                java.util.function.Supplier<String> input
        );
    }
    
}