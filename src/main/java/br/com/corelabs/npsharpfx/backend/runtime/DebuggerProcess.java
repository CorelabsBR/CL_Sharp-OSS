package br.com.corelabs.npsharpfx.backend.runtime;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

public final class DebuggerProcess {

    public interface OutputListener {
        void onLine(String line);
        void onExit(int code);
    }

    private final RuntimeRegistry registry;

    public DebuggerProcess(RuntimeRegistry registry) {
        this.registry = registry;
    }

    public Process runFile(Path file, OutputListener listener) throws Exception {
        LanguageRuntime lang = LanguageRuntime.fromFileName(file.getFileName().toString());

        if (lang == null) {
            throw new IllegalStateException("Linguagem não reconhecida: " + file);
        }

        InstalledRuntime runtime = registry.get(lang)
                .orElseThrow(() -> new IllegalStateException("Runtime não instalado: " + lang.displayName()));

        List<String> command = buildRunCommand(lang, runtime, file);

        ProcessBuilder builder = new ProcessBuilder(command);
        builder.directory(file.getParent().toFile());
        builder.redirectErrorStream(true);

        Map<String, String> env = builder.environment();
        env.put("NPSHARP_RUNTIME_HOME", runtime.rootPath().toString());

        Process process = builder.start();

        Thread reader = new Thread(() -> readOutput(process, listener), "npsharp-runtime-output");
        reader.setDaemon(true);
        reader.start();

        return process;
    }

    public Process startDebugAdapter(LanguageRuntime lang, OutputListener listener) throws Exception {
        InstalledRuntime runtime = registry.get(lang)
                .orElseThrow(() -> new IllegalStateException("Runtime não instalado: " + lang.displayName()));

        List<String> command = buildDebugAdapterCommand(lang, runtime);

        ProcessBuilder builder = new ProcessBuilder(command);
        builder.directory(runtime.rootPath().toFile());
        builder.redirectErrorStream(true);

        Process process = builder.start();

        Thread reader = new Thread(() -> readOutput(process, listener), "npsharp-debug-adapter-output");
        reader.setDaemon(true);
        reader.start();

        return process;
    }

    private List<String> buildRunCommand(
            LanguageRuntime lang,
            InstalledRuntime runtime,
            Path file
    ) {
        String exe = runtime.executablePath().toString();
        String source = file.toAbsolutePath().toString();

        return switch (lang) {
            case PYTHON -> List.of(exe, source);
            case NODE -> List.of(exe, source);
            case JAVA -> List.of(exe, source);
            case PHP -> List.of(exe, source);
            case RUBY -> List.of(exe, source);
            case LUA -> List.of(exe, source);
            case GO -> List.of(exe, "run", source);
            case RUST -> List.of(exe, source);
            case CPP -> List.of(exe, source);
            case CSHARP -> List.of(exe, "run", "--project", file.getParent().toString());
            case KOTLIN -> List.of(exe, "-script", source);
            case PORTUGOL -> List.of("internal-portugol", source);
        };
    }

    private List<String> buildDebugAdapterCommand(
            LanguageRuntime lang,
            InstalledRuntime runtime
    ) {
        String exe = runtime.executablePath().toString();

        return switch (lang) {
            case PYTHON -> List.of(exe, "-m", "debugpy.adapter");
            case NODE -> List.of(exe, runtime.debuggerPath().toString());
            case JAVA -> List.of(exe, "-jar", runtime.debuggerPath().toString());
            case GO -> List.of(runtime.debuggerPath().toString(), "dap");
            case RUST, CPP -> List.of(runtime.debuggerPath().toString(), "--port", "0");
            case CSHARP -> List.of(runtime.debuggerPath().toString(), "--interpreter=vscode");
            case PHP -> List.of(exe, runtime.debuggerPath().toString());
            case RUBY -> List.of(runtime.debuggerPath().toString(), "--open", "--port", "0");
            case LUA -> List.of(exe, runtime.debuggerPath().toString());
            case KOTLIN -> List.of(exe, "-jar", runtime.debuggerPath().toString());
            case PORTUGOL -> List.of("internal-portugol-debugger");
        };
    }

    private void readOutput(Process process, OutputListener listener) {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream())
        )) {
            String line;

            while ((line = reader.readLine()) != null) {
                listener.onLine(line);
            }

            listener.onExit(process.waitFor());
        } catch (Exception e) {
            listener.onLine("[ERRO] " + e.getMessage());
        }
    }
}